"""Subscribes to the game's EventBus, buffers raw events, and feeds the
sequence predictor, the player trait model, the spatial heatmap model, and
pattern detection (doc section 14). This is the one place that turns "events
happened" into "here's what we believe about the player" — game/combat code
never imports this; it only publishes events, per AGENTS.md's dependency
direction.
"""

from __future__ import annotations

from mirrorbound.agent.features.action_features import action_token
from mirrorbound.agent.patterns.detector import PatternDetector
from mirrorbound.agent.player_model.traits import PlayerTraitModel
from mirrorbound.agent.player_model.updater import apply_event
from mirrorbound.agent.prediction.predictor import SequencePredictor
from mirrorbound.agent.spatial.zones import SpatialModel
from mirrorbound.agent.telemetry.event_buffer import DEFAULT_CAPACITY, EventBuffer
from mirrorbound.game.core.events import Event, EventBus


class TelemetryCollector:
    def __init__(
        self,
        predictor: SequencePredictor,
        traits: PlayerTraitModel,
        spatial: SpatialModel | None = None,
        pattern_detector: PatternDetector | None = None,
        buffer_capacity: int = DEFAULT_CAPACITY,
    ) -> None:
        self.predictor = predictor
        self.traits = traits
        self.spatial = spatial
        self.pattern_detector = pattern_detector
        self.buffer = EventBuffer(capacity=buffer_capacity)
        self.tick: int = 0

    def attach(self, bus: EventBus) -> None:
        bus.subscribe_all(self.ingest)

    def ingest(self, event: Event) -> None:
        self.tick = event.tick
        self.buffer.append(event)
        apply_event(self.traits, event)
        token = action_token(event)
        if token is not None:
            self.predictor.observe(token, tick=event.tick)
        if self.spatial is not None:
            self.spatial.record(event)
        if self.pattern_detector is not None:
            # Runs on every event, not just ones with an action token: a
            # pattern can go stale (LOST) purely from elapsed ticks, which
            # combat/movement events without a token still carry.
            self.pattern_detector.check(event.tick)
