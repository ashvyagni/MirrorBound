"""The event bus (architecture doc section 12): combat/movement/etc. publish events,
telemetry / replay / the agent / debug tooling subscribe. Combat code never imports
the agent — it just emits an AbilityCastEvent and lets listeners react.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any

EventListener = Callable[["Event"], None]


@dataclass(frozen=True)
class Event:
    tick: int
    type: str
    data: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # frozen=True only stops fields being reassigned; without this, one
        # subscriber could still mutate `data` in place before later subscribers,
        # telemetry, or the replay recorder see it — order-dependent behavior that
        # would silently break determinism. Copy-and-freeze at construction time
        # instead of trusting every future caller not to mutate the dict they pass in.
        object.__setattr__(self, "data", MappingProxyType(dict(self.data)))


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
