"""Incoming-damage reduction: the one place that decides how much of a hit
actually lands on the player or the twin.

Two sources stack, and only two:

* **Shield** — the Aegis ability, held as a timed status effect on the entity.
* **Twin Protect** — the twin is *currently* running its PROTECT intent and is
  close enough to the player to be credibly in the way. It is not a buff the
  twin casts; it is a read of what the twin is doing right now, so it appears
  and disappears exactly when the twin's behaviour does.

They stack additively and are then held under `MAX_REDUCTION`. The ceiling
exists so no combination ever approaches immunity: dashing is the only way to
take zero, and that costs mana and has a cooldown. Without the cap, Shield plus
Protect plus a future third source would quietly make a build unkillable, which
is the kind of thing that only shows up after balance is already built on it.
"""

from __future__ import annotations

SHIELD_REDUCTION = 0.40
TWIN_PROTECT_REDUCTION = 0.25
# Rule: no stack of reductions may exceed this. See the module docstring.
MAX_REDUCTION = 0.60
# How close the twin must be to the player for PROTECT to actually mitigate.
PROTECT_RADIUS = 150.0


def reductions_for(state, target_id: str) -> tuple[float, list[str]]:
    """Total damage reduction for `target_id`, plus the names that produced it.

    The names are returned so DAMAGE_TAKEN can say *why* a hit was small; a
    number the player cannot explain reads as the game being inconsistent.
    """
    sources: list[str] = []
    total = 0.0

    target = state.entity_by_id(target_id)
    if target is None:
        return 0.0, sources

    if "shield" in target.status_effects:
        total += SHIELD_REDUCTION
        sources.append("shield")

    # Twin Protect only ever shields the player, and only while the twin is
    # actually alive, nearby, and running PROTECT.
    if target_id == state.player.id:
        twin = state.twin
        if (
            twin.available
            and twin.intent.intent_type == "PROTECT"
            and (twin.position - state.player.position).length() <= PROTECT_RADIUS
        ):
            total += TWIN_PROTECT_REDUCTION
            sources.append("twin_protect")

    return min(total, MAX_REDUCTION), sources


def apply_reduction(state, target_id: str, amount: float) -> tuple[float, list[str]]:
    """Returns (reduced amount, source names)."""
    reduction, sources = reductions_for(state, target_id)
    return amount * (1.0 - reduction), sources


__all__ = [
    "SHIELD_REDUCTION",
    "TWIN_PROTECT_REDUCTION",
    "MAX_REDUCTION",
    "PROTECT_RADIUS",
    "reductions_for",
    "apply_reduction",
]
