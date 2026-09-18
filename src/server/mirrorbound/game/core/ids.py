"""Deterministic entity ID allocation — sequential, never uuid4/random."""

from __future__ import annotations

EntityId = str


class IdAllocator:
    def __init__(self) -> None:
        self._counters: dict[str, int] = {}

    def next(self, kind: str) -> EntityId:
        """Allocate the next id for a kind, e.g. next('enemy') -> 'enemy_1', 'enemy_2', ..."""
        count = self._counters.get(kind, 0) + 1
        self._counters[kind] = count
        return f"{kind}_{count}"
