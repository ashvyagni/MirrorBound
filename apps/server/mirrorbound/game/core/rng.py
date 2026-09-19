"""Deterministic RNG: same run_seed + same call sequence => same numbers, always.

Nothing in the simulation may call `random` directly (see AGENTS.md determinism rule) —
every random decision goes through a DeterministicRNG instance so runs are replayable.
"""

from __future__ import annotations

import random
import zlib
from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T")


class DeterministicRNG:
    def __init__(self, seed: int) -> None:
        self.seed = seed
        self._random = random.Random(seed)

    def next_float(self) -> float:
        """Uniform float in [0.0, 1.0)."""
        return self._random.random()

    def randint(self, low: int, high: int) -> int:
        """Random int in [low, high], inclusive on both ends."""
        return self._random.randint(low, high)

    def uniform(self, low: float, high: float) -> float:
        """Uniform float in [low, high]."""
        return self._random.uniform(low, high)

    def choice(self, options: Sequence[T]) -> T:
        return self._random.choice(options)

    def shuffled(self, options: Sequence[T]) -> list[T]:
        items = list(options)
        self._random.shuffle(items)
        return items

    def chance(self, probability: float) -> bool:
        """True with the given probability (0.0-1.0)."""
        return self.next_float() < probability

    def spawn(self, label: str) -> "DeterministicRNG":
        """A child stream derived from this one's seed + a label.

        Independent systems (dungeon generation, combat rolls, loot) should each get
        their own spawned stream instead of sharing one: that way calling them in a
        different order, or adding/removing calls in one system, can't perturb the
        random sequence seen by another.

        Uses zlib.crc32 rather than Python's built-in hash() because str hashing is
        randomized per-process (PYTHONHASHSEED) unless disabled — that would silently
        break replay determinism across different runs of the server.
        """
        payload = f"{self.seed}:{label}".encode()
        derived_seed = zlib.crc32(payload)
        return DeterministicRNG(derived_seed)
