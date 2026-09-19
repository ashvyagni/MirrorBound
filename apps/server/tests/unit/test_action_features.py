from mirrorbound.agent.features.action_features import action_token
from mirrorbound.game.core.events import Event


def test_explicit_override_wins_over_type_mapping():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"action_token": "AERIAL_ATTACK"})
    assert action_token(event) == "AERIAL_ATTACK"


def test_known_type_maps_to_its_token():
    event = Event(tick=1, type="PLAYER_DASHED")
    assert action_token(event) == "DASH"


def test_ability_cast_uses_the_ability_name_as_token():
    event = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"ability": "FIRE_BURST"})
    assert action_token(event) == "FIRE_BURST"


def test_ability_cast_without_an_ability_field_yields_no_token():
    event = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"tags": ["RANGED"]})
    assert action_token(event) is None


def test_unrecognized_type_yields_no_token():
    event = Event(tick=1, type="ENEMY_KILLED", data={"enemy": "enemy_1"})
    assert action_token(event) is None
