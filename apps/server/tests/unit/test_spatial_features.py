from mirrorbound.agent.features.spatial_features import position, zone_layers
from mirrorbound.game.core.events import Event


def test_position_extracted_from_a_two_element_list():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"position": [12.4, 8.2]})
    assert position(event) == (12.4, 8.2)


def test_position_extracted_from_a_vec2_style_mapping():
    # Vec2.to_dict() shape, which is what game/combat events actually publish.
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"position": {"x": 3.0, "y": 4.5}})
    assert position(event) == (3.0, 4.5)


def test_position_mapping_missing_an_axis_yields_none():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"position": {"x": 3.0}})
    assert position(event) is None


def test_position_missing_yields_none():
    event = Event(tick=1, type="PLAYER_ATTACKED")
    assert position(event) is None


def test_position_with_wrong_shape_yields_none():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"position": [1.0, 2.0, 3.0]})
    assert position(event) is None


def test_attack_is_a_combat_zone():
    event = Event(tick=1, type="PLAYER_ATTACKED")
    assert zone_layers(event) == ["combat"]


def test_melee_tagged_attack_is_combat_and_melee():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]})
    assert set(zone_layers(event)) == {"combat", "melee"}


def test_spell_tagged_ability_cast_is_combat_and_spell():
    event = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"tags": ["SPELL", "BURST"]})
    assert set(zone_layers(event)) == {"combat", "spell"}


def test_retreat_dodge_and_death_map_to_their_own_layer():
    assert zone_layers(Event(tick=1, type="PLAYER_RETREATED")) == ["retreat"]
    assert zone_layers(Event(tick=1, type="PLAYER_DODGED")) == ["dodge"]
    assert zone_layers(Event(tick=1, type="PLAYER_DIED")) == ["death"]


def test_high_risk_tag_adds_the_high_risk_layer_on_top_of_others():
    event = Event(
        tick=1, type="PLAYER_ABILITY_CAST", data={"tags": ["MELEE", "HIGH_RISK"]}
    )
    assert set(zone_layers(event)) == {"combat", "melee", "high_risk"}


def test_unrelated_event_maps_to_no_layer():
    event = Event(tick=1, type="ENEMY_KILLED")
    assert zone_layers(event) == []
