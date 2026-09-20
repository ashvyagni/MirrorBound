from mirrorbound.agent.player_model.traits import PlayerTraitModel
from mirrorbound.agent.player_model.updater import apply_event
from mirrorbound.game.core.events import Event


def test_melee_attack_pulls_aggression_and_melee_dependency_up():
    traits = PlayerTraitModel()
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]})
    apply_event(traits, event)

    assert traits.get("aggression").value > 0.5
    assert traits.get("melee_dependency").value > 0.5
    assert traits.get("ranged_dependency").value < 0.5


def test_dash_with_distance_only_updates_mobility():
    traits = PlayerTraitModel()
    event = Event(tick=1, type="PLAYER_DASHED", data={"distance": 190.0})  # a full Shadow Dash
    apply_event(traits, event)

    assert traits.get("mobility").value > 0.5
    assert traits.get("mobility").samples == 1
    # No tags/aggression-relevant info on this event -> untouched.
    assert traits.get("aggression").samples == 0
    assert traits.get("melee_dependency").samples == 0


def test_single_taps_raise_aggression_without_raising_combo_dependency():
    """A player who attacks often but never chains (every hit resets to
    comboStep 1, e.g. spacing swings out or using a single-step weapon) must
    read as aggressive but NOT combo-heavy -- that separation is the whole
    point of tracking this as its own dimension.
    """
    traits = PlayerTraitModel()
    for _ in range(10):
        apply_event(traits, Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "comboStep": 1}))

    assert traits.get("aggression").value > 0.8
    assert traits.get("combo_dependency").value < 0.2
    assert traits.get("combo_dependency").samples == 10  # observed, just consistently "not chaining"


def test_sustained_chains_raise_both_aggression_and_combo_dependency():
    traits = PlayerTraitModel()
    for _ in range(10):
        apply_event(traits, Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "comboStep": 1}))
        apply_event(traits, Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "comboStep": 2}))
        apply_event(traits, Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "comboStep": 3}))

    assert traits.get("aggression").value > 0.8
    assert traits.get("combo_dependency").value > 0.5  # 2 of every 3 hits chain


def test_event_with_no_relevant_fields_updates_nothing():
    traits = PlayerTraitModel()
    event = Event(tick=1, type="ENEMY_KILLED", data={"enemy": "enemy_1"})
    apply_event(traits, event)

    snapshot = traits.snapshot()
    assert all(trait["samples"] == 0 for trait in snapshot.values())
