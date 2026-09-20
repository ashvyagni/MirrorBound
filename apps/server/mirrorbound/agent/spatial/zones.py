"""Composes the named heatmap layers from doc section 18 into one model fed
straight from gameplay Events: "not just player position, but separate layers —
combat zones, retreat zones, dodge zones, spell zones, melee zones, high-risk
zones, death zones."
"""

from __future__ import annotations

from mirrorbound.agent.features.spatial_features import position, zone_layers
from mirrorbound.agent.spatial.heatmap import Cell, GridHeatmap
from mirrorbound.game.core.events import Event

LAYER_NAMES = ("combat", "retreat", "dodge", "spell", "melee", "high_risk", "death")

DEFAULT_PRUNE_INTERVAL_TICKS = 300.0


class SpatialModel:
    def __init__(
        self,
        cell_size: float = 2.0,
        half_life_seconds: float = 60.0,
        tick_hz: float = 60.0,
        prune_interval_ticks: float = DEFAULT_PRUNE_INTERVAL_TICKS,
    ) -> None:
        half_life_ticks = (
            float("inf") if half_life_seconds == float("inf") else half_life_seconds * tick_hz
        )
        self.layers: dict[str, GridHeatmap] = {
            name: GridHeatmap(cell_size=cell_size, half_life_ticks=half_life_ticks)
            for name in LAYER_NAMES
        }
        self.prune_interval_ticks = prune_interval_ticks
        self.tick: int = 0
        self._last_prune_tick: int = 0

    def record(self, event: Event) -> None:
        pos = position(event)
        if pos is None:
            return
        x, y = pos
        self.tick = event.tick
        for layer_name in zone_layers(event):
            self.layers[layer_name].record(x, y, event.tick)
        if self.tick - self._last_prune_tick >= self.prune_interval_ticks:
            self.prune(self.tick)

    def prune(self, tick: int | None = None) -> int:
        query_tick = tick if tick is not None else self.tick
        removed = sum(layer.prune(query_tick) for layer in self.layers.values())
        self._last_prune_tick = query_tick
        return removed

    def snapshot(self, tick: int | None = None, top_n: int = 10) -> dict[str, list[tuple[Cell, float]]]:
        query_tick = tick if tick is not None else self.tick
        return {
            name: layer.top_cells(query_tick, n=top_n) for name, layer in self.layers.items()
        }

    def to_json_dict(self, tick: int | None = None, top_n: int = 10) -> dict:
        """Plain, JSON-serializable view for the debug HUD / AI teammate."""
        return {
            name: [{"cell": list(cell), "weight": weight} for cell, weight in cells]
            for name, cells in self.snapshot(tick=tick, top_n=top_n).items()
        }
