from mirrorbound.agent.features.movement_features import MOBILITY_DISTANCE_NORM, mobility_signal
from mirrorbound.game.core.events import Event


def test_distance_normalizes_into_zero_one_range():
    event = Event(tick=1, type="PLAYER_DASHED", data={"distance": MOBILITY_DISTANCE_NORM / 2})
    assert mobility_signal(event) == 0.5


def test_distance_above_norm_clamps_to_one():
    event = Event(tick=1, type="PLAYER_DASHED", data={"distance": MOBILITY_DISTANCE_NORM * 5})
    assert mobility_signal(event) == 1.0


def test_norm_is_calibrated_to_real_movement():
    # A third-of-a-second walk sample (~58 units) must not read as fully mobile,
    # while a sprint sample (~96) or a Shadow Dash (190) does.
    assert mobility_signal(Event(tick=1, type="PLAYER_MOVED", data={"distance": 58.0})) < 0.7
    assert mobility_signal(Event(tick=1, type="PLAYER_MOVED", data={"distance": 96.0})) == 1.0
    assert mobility_signal(Event(tick=1, type="PLAYER_DASHED", data={"distance": 190.0})) == 1.0


def test_missing_distance_yields_no_observation():
    event = Event(tick=1, type="PLAYER_DASHED")
    assert mobility_signal(event) is None
