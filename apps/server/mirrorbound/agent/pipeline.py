"""Composes telemetry collection, player trait modeling, and sequence prediction
into the one artifact this slice is required to produce: a snapshot the
twin/utility AI teammate and the debug HUD can both read (doc section 34).

Deliberately does not decide anything — no TwinIntent, no utility scoring. That
half of agent/ is a different owner's scope; see AGENTS.md.
"""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.agent.player_model.traits import PlayerTraitModel
from mirrorbound.agent.prediction.predictor import PredictionCandidate, SequencePredictor
from mirrorbound.agent.telemetry.collector import TelemetryCollector
from mirrorbound.agent.telemetry.event_buffer import DEFAULT_CAPACITY
from mirrorbound.game.core.events import Event, EventBus


@dataclass
class PlayerModelSnapshot:
    tick: int
    traits: dict[str, dict[str, float]]
    predictions: list[PredictionCandidate]

    def to_json_dict(self) -> dict:
        """Plain, JSON-serializable view for the WebSocket snapshot / AI debug HUD."""
        return {
            "tick": self.tick,
            "traits": self.traits,
            "predictions": [
                {
                    "token": p.token,
                    "confidence": p.confidence,
                    "order": p.order,
                    "weight": p.weight,
                }
                for p in self.predictions
            ],
        }


class PlayerModelPipeline:
    def __init__(
        self,
        max_order: int = 3,
        half_life_seconds: float = 30.0,
        tick_hz: float = 60.0,
        buffer_capacity: int = DEFAULT_CAPACITY,
    ) -> None:
        self.tick_hz = tick_hz
        self.traits = PlayerTraitModel()
        self.predictor = SequencePredictor(
            max_order=max_order, half_life_seconds=half_life_seconds, tick_hz=tick_hz
        )
        self.collector = TelemetryCollector(
            predictor=self.predictor, traits=self.traits, buffer_capacity=buffer_capacity
        )

    def attach(self, bus: EventBus) -> None:
        """Wire this pipeline to a live game session's EventBus."""
        self.collector.attach(bus)

    def ingest(self, event: Event) -> None:
        """Direct ingestion for tests/scenarios and replay tooling that don't need
        a full EventBus in the loop.
        """
        self.collector.ingest(event)

    def snapshot(self, top_k: int = 3) -> PlayerModelSnapshot:
        tick = self.predictor.tick
        return PlayerModelSnapshot(
            tick=tick,
            traits=self.traits.snapshot(),
            predictions=self.predictor.predict(top_k=top_k, tick=tick),
        )
