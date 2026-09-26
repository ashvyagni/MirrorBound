"""The shape of the difficulty ramp, as a contract rather than as a feeling.

§20 asks for a substantially harder game that is still fair, and is specific
about the one thing not to do: "do NOT simply inflate enemy HP". It also gives
the curve in so many words -- Early: learning, Mid: mastery, Late: challenge,
Final: high mastery requirement.

Numbers drift. These are the properties that should not.
"""

from __future__ import annotations

import pytest

from mirrorbound.game.entities.enemy import (
    ARCHETYPES, DAMAGE_SCALING, HEALTH_SCALING, get_archetype,
)
from mirrorbound.game.world.campaign import AREAS

#: The campaign in the order a player meets it.
LADDER = ("wakewood_crypt", "stonecount_barrow", "glasswork", "ashen_deep", "mirror_sanctum")


def test_going_deeper_costs_you_more_rather_than_taking_longer():
    """The §20 rule, as arithmetic.

    It used to be the other way round: health took the full region multiplier
    and damage took 70% of it, so a deeper region mostly meant the same fight
    for longer -- which is what inflating HP means.
    """
    assert DAMAGE_SCALING > HEALTH_SCALING
    base = ARCHETYPES["skeleton"]
    deep = get_archetype("skeleton", 1.8)
    health_growth = deep.health / base.health
    damage_growth = deep.damage / base.damage
    assert damage_growth > health_growth, (damage_growth, health_growth)


def test_the_ramp_only_ever_goes_up():
    steps = [AREAS[a].difficulty for a in LADDER]
    assert steps == sorted(steps), steps
    assert len(set(steps)) == len(steps), "two areas at the same difficulty is a flat step"


def test_the_ramp_climbs_without_a_cliff():
    """A step that doubles is a wall, and a wall reads as unfair rather than hard."""
    steps = [AREAS[a].difficulty for a in LADDER]
    for before, after in zip(steps, steps[1:]):
        assert 1.0 < after / before <= 1.25, (before, after)


def test_the_opening_is_gentler_than_the_ending_by_a_real_margin():
    assert AREAS["mirror_sanctum"].difficulty >= AREAS["wakewood_crypt"].difficulty * 1.5


@pytest.mark.parametrize("area_id", LADDER)
def test_scaling_never_touches_what_the_player_has_learned_to_read(area_id):
    """Speed, range and wind-up stay put at every depth.

    Those are the telegraph. Scaling them would make a later skeleton a
    different enemy wearing the same tell, which is the unfair kind of hard.
    """
    difficulty = AREAS[area_id].difficulty
    for enemy_id, base in ARCHETYPES.items():
        scaled = get_archetype(enemy_id, difficulty)
        assert scaled.speed == base.speed, enemy_id
        assert scaled.attack_range == base.attack_range, enemy_id
        assert scaled.attack_windup == base.attack_windup, enemy_id
        assert scaled.attack_cooldown == base.attack_cooldown, enemy_id


def test_every_creature_announces_its_basic_attack():
    """The floor under all of it: a hit you could not have seen coming is not
    difficulty, and §21 wants telegraphs to be the vocabulary of the fight."""
    for enemy_id, enemy in ARCHETYPES.items():
        if enemy_id == "dummy":
            continue          # a post with straw on it; it never attacks
        assert enemy.attack_windup > 0, enemy_id
