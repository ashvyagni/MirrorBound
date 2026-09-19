"""Trait signals derived from combat action events (doc section 15).

An event contributes a signal to a trait only when the information that trait
needs is actually present on it — see docs/contracts/telemetry-events.md for
exactly which fields are expected on which events. No field -> no observation
for that trait; a missing tag is never treated as "tag is absent" evidence,
it's treated as "we don't know," which is not the same thing.

Classification here keys off `event.type`, not the action token: the token
(`action_features.action_token`) is meant to be overridden per-ability for
richer sequence prediction (e.g. `"AERIAL_ATTACK"` instead of the generic
`"ATTACK"`), so it can't double as a stable category label — an overridden
token would silently stop being recognized as offensive.
"""

from __future__ import annotations

from mirrorbound.agent.features.action_features import ABILITY_CAST_TYPE
from mirrorbound.game.core.events import Event

# MELEE/RANGED come from the doc's own ability tag vocabulary (section 30).
# SPELL is a project-specific addition — the doc's tags don't separate "cast a
# spell" from "shoot a projectile", but ranged_dependency and spell_dependency
# are two different traits, so we need a tag that can distinguish them (e.g. a
# thrown weapon is RANGED but not SPELL).
TAG_TO_DEPENDENCY_TRAIT = {
    "MELEE": "melee_dependency",
    "RANGED": "ranged_dependency",
    "SPELL": "spell_dependency",
}
COMBAT_CATEGORY_TAGS = set(TAG_TO_DEPENDENCY_TRAIT)

OFFENSIVE_TYPES = {"PLAYER_ATTACKED"}
DEFENSIVE_TYPES = {"PLAYER_BLOCKED", "PLAYER_RETREATED"}
DEFENSIVE_TAG = "DEFENSIVE"


def dependency_signals(event: Event) -> dict[str, float]:
    """One signal per known tag category, only when data["tags"] is present AND
    contains at least one combat category (MELEE/RANGED/SPELL).

    A melee attack (tags=["MELEE"]) reads as melee_dependency=1.0 AND
    ranged_dependency=0.0 AND spell_dependency=0.0 for the same observation —
    it's a mutually exclusive category choice for this one action, not three
    independent yes/no questions. A movement action tagged only MOBILITY (no
    combat category at all) doesn't assert or deny any of the three, so — same
    "missing info -> skip" rule as everywhere else — it's not an observation
    for these traits either, even though `tags` is technically present.
    """
    tags = event.data.get("tags")
    if tags is None:
        return {}
    tag_set = set(tags)
    if not tag_set & COMBAT_CATEGORY_TAGS:
        return {}
    return {
        trait: (1.0 if tag in tag_set else 0.0) for tag, trait in TAG_TO_DEPENDENCY_TRAIT.items()
    }


def combo_signal(event: Event) -> float | None:
    """1.0 when this attack landed as part of an active combo chain, 0.0 for
    an opening hit that didn't chain off a previous one, None when there's no
    combo information to read at all.

    Reads `data["comboStep"]` directly rather than inferring "attacks close
    together in time" from tick deltas -- the game already computes this
    authoritatively per weapon (`Player.start_attack`/`weapon.combo_window` in
    game/entities/player.py resets the chain if you wait too long between
    swings, and every weapon's window differs), so re-deriving it here would
    just be a worse, stateful copy of logic that already exists. `comboStep`
    is 1-indexed: 1 is the opening hit of a (possible) chain, 2+ means the
    previous hit landed recently enough for this one to extend it.
    """
    combo_step = event.data.get("comboStep")
    if combo_step is None:
        return None
    return 1.0 if combo_step >= 2 else 0.0


def aggression_signal(event: Event) -> float | None:
    """1.0 for a clearly offensive action, 0.0 for a clearly defensive one, None
    (no observation) for anything ambiguous — movement, an unrecognized type, or
    an ability cast with no tags to judge it by. We'd rather skip an observation
    than dilute the trait with a guess.
    """
    tags = event.data.get("tags")

    if event.type in OFFENSIVE_TYPES:
        return 0.0 if tags is not None and DEFENSIVE_TAG in tags else 1.0
    if event.type in DEFENSIVE_TYPES:
        return 0.0
    if event.type == ABILITY_CAST_TYPE:
        if tags is None:
            return None
        return 0.0 if DEFENSIVE_TAG in tags else 1.0
    return None
