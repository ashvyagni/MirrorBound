from mirrorbound.agent.patterns.detector import PatternDetector
from mirrorbound.agent.player_model.traits import PlayerTraitModel
from mirrorbound.agent.prediction.predictor import SequencePredictor
from mirrorbound.agent.spatial.zones import SpatialModel
from mirrorbound.agent.telemetry.collector import TelemetryCollector
from mirrorbound.game.core.events import Event, EventBus


def test_collector_buffers_every_event_and_updates_traits_and_predictor():
    predictor = SequencePredictor()
    traits = PlayerTraitModel()
    collector = TelemetryCollector(predictor=predictor, traits=traits)

    collector.ingest(Event(tick=1, type="PLAYER_DASHED", data={"distance": 5.0}))
    collector.ingest(Event(tick=2, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]}))
    collector.ingest(Event(tick=3, type="ENEMY_KILLED"))  # buffered, but no token/trait signal

    assert len(collector.buffer) == 3
    assert predictor.history == ["DASH", "ATTACK"]
    assert traits.get("melee_dependency").samples == 1


def test_collector_attaches_to_a_live_event_bus():
    predictor = SequencePredictor()
    traits = PlayerTraitModel()
    collector = TelemetryCollector(predictor=predictor, traits=traits)
    bus = EventBus()
    collector.attach(bus)

    bus.publish(Event(tick=1, type="PLAYER_DASHED", data={"distance": 5.0}))

    assert len(collector.buffer) == 1
    assert predictor.history == ["DASH"]


def test_collector_feeds_the_spatial_model_when_one_is_given():
    predictor = SequencePredictor()
    traits = PlayerTraitModel()
    spatial = SpatialModel(half_life_seconds=float("inf"))
    collector = TelemetryCollector(predictor=predictor, traits=traits, spatial=spatial)

    collector.ingest(
        Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "position": [1.0, 1.0]})
    )

    assert spatial.layers["combat"].weight_at(1.0, 1.0, tick=1) == 1.0


def test_collector_without_a_spatial_model_still_works():
    predictor = SequencePredictor()
    traits = PlayerTraitModel()
    collector = TelemetryCollector(predictor=predictor, traits=traits)  # spatial=None

    collector.ingest(
        Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "position": [1.0, 1.0]})
    )

    assert len(collector.buffer) == 1


def test_collector_runs_pattern_detection_on_every_event_including_tokenless_ones():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    traits = PlayerTraitModel()
    detector = PatternDetector(predictor, detection_threshold=0.7, staleness_ticks=5.0)
    collector = TelemetryCollector(predictor=predictor, traits=traits, pattern_detector=detector)

    tick = 1
    for _ in range(20):
        collector.ingest(Event(tick=tick, type="PLAYER_DASHED"))
        tick += 1
        collector.ingest(Event(tick=tick, type="PLAYER_ABILITY_CAST", data={"ability": "FIRE"}))
        tick += 1

    assert ("DASH",) in detector.active

    # An event with no action token (so predictor.observe is never called) still
    # runs check() -- which is how staleness-driven LOST events get a chance to
    # fire even during a stretch of non-action gameplay events.
    collector.ingest(Event(tick=tick + 100, type="ENEMY_KILLED"))
    assert ("DASH",) not in detector.active
