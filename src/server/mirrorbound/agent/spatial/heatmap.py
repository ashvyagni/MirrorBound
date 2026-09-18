"""A single decaying 2D heatmap layer (doc section 18): a sparse grid of world
position -> decay-weighted activity, e.g. "how much fighting has happened near
here recently." Same decay/prune shape as agent/prediction/markov.py —
half-life expressed in real ticks (see AGENTS.md's decay-calibration rule), and
storage actually pruned, not just filtered at read time.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

MIN_WEIGHT = 1e-3
Cell = tuple[int, int]


@dataclass
class _Entry:
    weight: float
    last_tick: int


class GridHeatmap:
    def __init__(self, cell_size: float = 2.0, half_life_ticks: float = 1800.0) -> None:
        """cell_size: world units per grid cell. half_life_ticks: see MarkovModel —
        a deliberately chosen real-time half-life in the caller's tick units, not
        an opaque per-tick fraction. Pass float('inf') for no decay.
        """
        assert cell_size > 0
        assert half_life_ticks > 0
        self.cell_size = cell_size
        self.half_life_ticks = half_life_ticks
        self.decay_per_tick = (
            1.0 if half_life_ticks == float("inf") else 0.5 ** (1.0 / half_life_ticks)
        )
        self._cells: dict[Cell, _Entry] = {}

    def cell_of(self, x: float, y: float) -> Cell:
        return (math.floor(x / self.cell_size), math.floor(y / self.cell_size))

    def record(self, x: float, y: float, tick: int, amount: float = 1.0) -> None:
        cell = self.cell_of(x, y)
        entry = self._cells.get(cell)
        current = self._decayed_weight(entry, tick) if entry else 0.0
        self._cells[cell] = _Entry(weight=current + amount, last_tick=tick)

    def _decayed_weight(self, entry: _Entry, tick: int) -> float:
        elapsed = max(0, tick - entry.last_tick)
        weight = entry.weight * (self.decay_per_tick**elapsed)
        return weight if weight >= MIN_WEIGHT else 0.0

    def weight_at(self, x: float, y: float, tick: int) -> float:
        """Decay-adjusted weight for the cell containing (x, y), as of `tick`.
        Read-only — does not mutate storage.
        """
        entry = self._cells.get(self.cell_of(x, y))
        return self._decayed_weight(entry, tick) if entry else 0.0

    def prune(self, tick: int) -> int:
        """Actually remove cells that have decayed to zero, not just skip them at
        read time — see MarkovModel.prune() for the same reasoning. Returns the
        number of cells removed.
        """
        stale = [cell for cell, entry in self._cells.items() if self._decayed_weight(entry, tick) <= 0.0]
        for cell in stale:
            del self._cells[cell]
        return len(stale)

    def top_cells(self, tick: int, n: int = 10) -> list[tuple[Cell, float]]:
        """The n most active cells, highest weight first, as of `tick`."""
        weights = ((cell, self._decayed_weight(entry, tick)) for cell, entry in self._cells.items())
        active = [(cell, w) for cell, w in weights if w > 0.0]
        active.sort(key=lambda item: item[1], reverse=True)
        return active[:n]

    def __len__(self) -> int:
        """Number of distinct cells currently stored — bounded-memory check."""
        return len(self._cells)
