from mirrorbound.agent.features.movement_features import mobility_signal
from mirrorbound.game.core.events import Event


def test_distance_normalizes_into_zero_one_range():
    event = Event(tick=1, type="PLAYER_DASHED", data={"distance": 2.5})
    assert mobility_signal(event) == 0.5


def test_distance_above_norm_clamps_to_one():
    event = Event(tick=1, type="PLAYER_DASHED", data={"distance": 50.0})
    assert mobility_signal(event) == 1.0


def test_missing_distance_yields_no_observation():
    event = Event(tick=1, type="PLAYER_DASHED")
    assert mobility_signal(event) is None
