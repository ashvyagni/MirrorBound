"""A bounded, fixed-capacity ring buffer of recent telemetry events
(doc section 14: agent/telemetry/event_buffer.py). Bounded so a long play
session can't grow this without limit — see AGENTS.md.
"""

from __future__ import annotations

from collections import deque

from mirrorbound.game.core.events import Event

DEFAULT_CAPACITY = 500


class EventBuffer:
    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        assert capacity > 0
        self.capacity = capacity
        self._events: deque[Event] = deque(maxlen=capacity)

    def append(self, event: Event) -> None:
        self._events.append(event)

    def __len__(self) -> int:
        return len(self._events)

    def recent(self, count: int | None = None) -> list[Event]:
        """Events oldest-first. All of them if count is None, else just the
        most recent `count`.
        """
        items = list(self._events)
        return items if count is None else items[-count:]

    def clear(self) -> None:
        self._events.clear()
