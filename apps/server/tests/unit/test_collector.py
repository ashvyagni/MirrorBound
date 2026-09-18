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
