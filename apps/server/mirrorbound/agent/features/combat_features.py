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


# --- preferred_range, risk_tolerance, defensive_tendency -------------------------
#
# These three traits existed in the trait model but no event ever fed them, so
# they sat at 0.5 with zero confidence for the whole run. Same rule as above:
# a signal is produced only when the event carries the information the trait
# needs, and "we don't know" is never turned into evidence.

# preferred_range: 0.0 = fights at sword reach, 1.0 = fights from staff/bow
# reach. The band edges are the sword's reach and roughly the longest staff's
# reach. `nearestEnemyDistance` is the nearest enemy, not the enemy being
# fought, so a reading beyond ENGAGED_MAX_DISTANCE means nothing is really
# engaged (a swing at empty air) and is skipped rather than read as "ranged".
RANGE_NEAR = 48.0
RANGE_FAR = 320.0
ENGAGED_MAX_DISTANCE = 450.0

# Attacking while hurt reads as risk-tolerant. Same mapping the twin's own style
# model uses for the same event, so the two models agree on what "risky" means.
RISK_HEALTH_WEIGHT = 0.8

HEALTH_FRACTION_KEYS = ("healthFraction", "health_fraction")
DEFENSIVE_ALWAYS_TYPES = {"PLAYER_DODGED", "PLAYER_BLOCKED", "PLAYER_RETREATED"}


def _clamp01(value: float) -> float:
    return min(1.0, max(0.0, value))


def _health_fraction(event: Event) -> float | None:
    """`healthFraction` is the contract's name; PLAYER_RETREATED has historically
    emitted `health_fraction`, so both spellings are read.
    """
    for key in HEALTH_FRACTION_KEYS:
        value = event.data.get(key)
        if value is not None:
            return _clamp01(float(value))
    return None


def _is_offensive_action(event: Event) -> bool:
    tags = event.data.get("tags")
    if event.type == "PLAYER_ATTACKED":
        return tags is None or DEFENSIVE_TAG not in tags
    if event.type == ABILITY_CAST_TYPE:
        if tags is None:
            return False
        tag_set = set(tags)
        return DEFENSIVE_TAG not in tag_set and bool(tag_set & COMBAT_CATEGORY_TAGS)
    return False


def preferred_range_signal(event: Event) -> float | None:
    """How far from the nearest enemy the player chose to attack, on 0..1."""
    if not _is_offensive_action(event):
        return None
    distance = event.data.get("nearestEnemyDistance")
    if distance is None:
        return None
    distance = float(distance)
    if distance > ENGAGED_MAX_DISTANCE:
        return None
    return _clamp01((distance - RANGE_NEAR) / (RANGE_FAR - RANGE_NEAR))


def risk_tolerance_signal(event: Event) -> float | None:
    """1.0 = pressing on at very low health, 0.0 = only acting while healthy.

    Attacks read the health they were made at. A retreat reads the health it
    happened at too, inverted: retreating early (high health) is caution,
    retreating only when nearly dead is a high tolerance for risk.
    """
    health = _health_fraction(event)
    if health is None:
        return None
    if event.type == "PLAYER_ATTACKED":
        return _clamp01(1.0 - health * RISK_HEALTH_WEIGHT)
    if event.type == "PLAYER_RETREATED":
        return 1.0 - health
    return None


def defensive_signal(event: Event) -> float | None:
    """1.0 for a defensive action (dodge, block, retreat, a DEFENSIVE cast, a
    healing item), 0.0 for an offensive one, None when the event says nothing
    either way.

    Related to `aggression` but not its mirror image: aggression ignores dodges
    and healing items entirely, and a mobility-only cast is neither here nor
    there for this trait. The value reads as "share of the player's decisions
    that were defensive", so it is dominated by how often they attack.
    """
    if event.type in DEFENSIVE_ALWAYS_TYPES:
        return 1.0
    if event.type == "ITEM_USED":
        healed = event.data.get("healed")
        return 1.0 if healed is not None and float(healed) > 0 else None
    tags = event.data.get("tags")
    if event.type in ("PLAYER_ATTACKED", ABILITY_CAST_TYPE) and tags is not None and DEFENSIVE_TAG in tags:
        return 1.0
    if _is_offensive_action(event):
        return 0.0
    return None
