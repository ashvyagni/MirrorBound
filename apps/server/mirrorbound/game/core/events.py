"""The event bus (architecture doc section 12): combat/movement/etc. publish events,
telemetry / replay / the agent / debug tooling subscribe. Combat code never imports
the agent — it just emits an AbilityCastEvent and lets listeners react.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any

EventListener = Callable[["Event"], None]

_JsonPrimitive = str | int | float | bool | None


def _freeze(value: Any) -> Any:
    """Recursively convert dicts/lists into read-only equivalents (MappingProxyType
    / tuple), so a subscriber can't mutate nested structures either — only the top
    level was covered before, which left e.g. `data["tags"].append(...)` free to
    silently corrupt what later subscribers, telemetry, and replay see.
    """
    if isinstance(value, Mapping):
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze(v) for v in value)
    return value


def _thaw(value: Any) -> Any:
    """Inverse of _freeze: back to plain dict/list for JSON export."""
    if isinstance(value, Mapping):
        return {k: _thaw(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_thaw(v) for v in value]
    return value


@dataclass(frozen=True)
class Event:
    tick: int
    type: str
    data: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # frozen=True only stops fields being reassigned; without this, one
        # subscriber could still mutate `data` (or a nested dict/list inside it) in
        # place before later subscribers, telemetry, or the replay recorder see it —
        # order-dependent behavior that would silently break determinism. Freeze
        # recursively at construction time instead of trusting every future caller.
        object.__setattr__(self, "data", _freeze(self.data))

    def to_json_dict(self) -> dict[str, _JsonPrimitive | dict | list]:
        """Plain, `json.dumps`-able view for the WebSocket snapshot, the JSONL
        replay log, and any other network/file consumer — MappingProxyType and
        tuple (what `data` is actually made of, post-freeze) aren't JSON-serializable
        on their own.
        """
        return {"tick": self.tick, "type": self.type, "data": _thaw(self.data)}


class EventBus:
    def __init__(self) -> None:
        self._listeners: dict[str, list[EventListener]] = {}
        self._wildcard_listeners: list[EventListener] = []
        self._buffer: list[Event] = []

    def subscribe(self, event_type: str, listener: EventListener) -> None:
        self._listeners.setdefault(event_type, []).append(listener)

    def subscribe_all(self, listener: EventListener) -> None:
        """For consumers like telemetry/replay that care about every event type."""
        self._wildcard_listeners.append(listener)

    def publish(self, event: Event) -> None:
        self._buffer.append(event)
        for listener in self._listeners.get(event.type, ()):
            listener(event)
        for listener in self._wildcard_listeners:
            listener(event)

    def drain(self) -> list[Event]:
        """Pop and return every event published since the last drain, in order.

        Used by per-tick flush consumers (telemetry, JSONL replay recorder) that need
        the full sequential log rather than a live callback.
        """
        events, self._buffer = self._buffer, []
        return events
