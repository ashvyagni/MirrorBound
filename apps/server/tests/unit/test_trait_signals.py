"""Signal functions for the three traits that no event used to feed:
preferred_range, risk_tolerance and defensive_tendency.

The contract is the same as everywhere else in agent/features: a signal is
produced only when the event carries the information the trait needs, and a
missing field is "we don't know", never evidence.
"""

from mirrorbound.agent.features.combat_features import (
    ENGAGED_MAX_DISTANCE,
    RANGE_FAR,
    RANGE_NEAR,
    defensive_signal,
    preferred_range_signal,
    risk_tolerance_signal,
)
from mirrorbound.game.core.events import Event


def attack(distance, tags=("MELEE",), **extra):
    data = {"tags": list(tags), **extra}
    if distance is not None:
        data["nearestEnemyDistance"] = distance
    return Event(tick=1, type="PLAYER_ATTACKED", data=data)


def cast(tags, **extra):
    return Event(tick=1, type="PLAYER_ABILITY_CAST", data={"tags": tags, **extra})


# --- preferred_range -------------------------------------------------------------


def test_preferred_range_is_zero_at_sword_reach_and_one_at_staff_reach():
    assert preferred_range_signal(attack(RANGE_NEAR)) == 0.0
    assert preferred_range_signal(attack(10.0)) == 0.0
    assert preferred_range_signal(attack(RANGE_FAR)) == 1.0


def test_preferred_range_scales_linearly_between_the_band_edges():
    midpoint = (RANGE_NEAR + RANGE_FAR) / 2
    assert abs(preferred_range_signal(attack(midpoint)) - 0.5) < 1e-9


def test_preferred_range_is_clamped_at_the_far_edge_of_the_engagement_window():
    assert preferred_range_signal(attack(ENGAGED_MAX_DISTANCE)) == 1.0


def test_preferred_range_skips_an_attack_at_nothing_in_particular():
    # The nearest enemy is on the far side of the room: a swing at air.
    assert preferred_range_signal(attack(ENGAGED_MAX_DISTANCE + 1)) is None


def test_preferred_range_skips_when_there_is_no_enemy_to_measure_against():
    assert preferred_range_signal(attack(None)) is None


def test_preferred_range_reads_offensive_casts_but_not_defensive_or_mobility_ones():
    assert preferred_range_signal(cast(["SPELL", "AOE"], nearestEnemyDistance=200.0)) is not None
    assert preferred_range_signal(cast(["SPELL", "DEFENSIVE"], nearestEnemyDistance=200.0)) is None
    assert preferred_range_signal(cast(["MOBILITY"], nearestEnemyDistance=200.0)) is None


def test_preferred_range_ignores_non_attack_events():
    event = Event(tick=1, type="PLAYER_MOVED", data={"nearestEnemyDistance": 200.0})
    assert preferred_range_signal(event) is None


# --- risk_tolerance --------------------------------------------------------------


def test_attacking_at_full_health_reads_as_cautious_and_near_death_as_reckless():
    healthy = risk_tolerance_signal(attack(100.0, healthFraction=1.0))
    reckless = risk_tolerance_signal(attack(100.0, healthFraction=0.05))
    assert healthy is not None and reckless is not None
    assert healthy < 0.3
    assert reckless > 0.9


def test_risk_tolerance_matches_the_twin_style_mapping_for_attacks():
    # The player model and the twin's imitation channel must agree on what a
    # given attack says about risk, or two views of one player drift apart.
    assert abs(risk_tolerance_signal(attack(100.0, healthFraction=0.4)) - (1.0 - 0.4 * 0.8)) < 1e-9


def test_risk_tolerance_needs_health_information_to_say_anything():
    assert risk_tolerance_signal(attack(100.0)) is None


def test_health_fraction_outside_zero_one_is_clamped_not_trusted():
    assert risk_tolerance_signal(attack(100.0, healthFraction=-3.0)) == 1.0
    assert abs(risk_tolerance_signal(attack(100.0, healthFraction=7.0)) - 0.2) < 1e-9


def test_retreating_early_is_cautious_and_retreating_nearly_dead_is_risky():
    early = Event(tick=1, type="PLAYER_RETREATED", data={"health_fraction": 0.9})
    late = Event(tick=1, type="PLAYER_RETREATED", data={"health_fraction": 0.1})
    assert abs(risk_tolerance_signal(early) - 0.1) < 1e-9
    assert abs(risk_tolerance_signal(late) - 0.9) < 1e-9


def test_retreat_accepts_the_contract_spelling_of_health_fraction_too():
    event = Event(tick=1, type="PLAYER_RETREATED", data={"healthFraction": 0.25})
    assert abs(risk_tolerance_signal(event) - 0.75) < 1e-9


def test_risk_tolerance_ignores_other_event_types_even_with_health_attached():
    event = Event(tick=1, type="PLAYER_MOVED", data={"healthFraction": 0.1})
    assert risk_tolerance_signal(event) is None


# --- defensive_tendency ----------------------------------------------------------


def test_dodge_block_and_retreat_are_defensive():
    for event_type in ("PLAYER_DODGED", "PLAYER_BLOCKED", "PLAYER_RETREATED"):
        assert defensive_signal(Event(tick=1, type=event_type)) == 1.0


def test_defensive_cast_is_defensive_and_offensive_cast_is_not():
    assert defensive_signal(cast(["DEFENSIVE", "MAGIC"])) == 1.0
    assert defensive_signal(cast(["SPELL", "RANGED"])) == 0.0


def test_plain_attack_is_offensive_for_this_trait():
    assert defensive_signal(attack(100.0)) == 0.0


def test_mobility_only_cast_is_neither_defensive_nor_offensive():
    assert defensive_signal(cast(["MOBILITY"])) is None


def test_cast_without_tags_is_not_guessed_at():
    assert defensive_signal(Event(tick=1, type="PLAYER_ABILITY_CAST")) is None


def test_healing_item_is_defensive_but_a_mana_potion_says_nothing():
    heal = Event(tick=1, type="ITEM_USED", data={"item": "health_potion", "healed": 45.0, "mana": 0.0})
    mana = Event(tick=1, type="ITEM_USED", data={"item": "mana_potion", "healed": 0.0, "mana": 40.0})
    assert defensive_signal(heal) == 1.0
    assert defensive_signal(mana) is None


def test_unrelated_events_say_nothing_about_defensive_tendency():
    assert defensive_signal(Event(tick=1, type="PLAYER_MOVED", data={"distance": 50.0})) is None
    assert defensive_signal(Event(tick=1, type="ENEMY_KILLED")) is None
