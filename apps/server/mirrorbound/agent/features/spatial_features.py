"""Extracts world position and zone-layer membership from a gameplay Event
(doc section 18): which heatmap layer(s) — combat, retreat, dodge, spell,
melee, high_risk, death — this event belongs at its position.

Only computed when data["position"] is present — see
docs/contracts/telemetry-events.md. A single event can belong to several
layers at once (e.g. a melee attack is both "combat" and "melee").
"""

from __future__ import annotations

from collections.abc import Mapping

from mirrorbound.agent.features.action_features import ABILITY_CAST_TYPE
from mirrorbound.game.core.events import Event

ATTACK_TYPE = "PLAYER_ATTACKED"
RETREAT_TYPE = "PLAYER_RETREATED"
DODGE_TYPE = "PLAYER_DODGED"
DEATH_TYPE = "PLAYER_DIED"

MELEE_TAG = "MELEE"
SPELL_TAG = "SPELL"
HIGH_RISK_TAG = "HIGH_RISK"

COMBAT_TYPES = {ATTACK_TYPE, ABILITY_CAST_TYPE}


def position(event: Event) -> tuple[float, float] | None:
    """World position of the event, or None when it carries none.

    Two shapes are accepted: the contract's `[x, y]` list, and the `{"x": .., "y": ..}`
    mapping that `Vec2.to_dict()` produces — the game's combat/movement events were
    already publishing the latter before the spatial layer landed, and rejecting it
    would silently drop every real gameplay position from the heatmaps.
    """
    raw = event.data.get("position")
    if isinstance(raw, Mapping):
        if "x" not in raw or "y" not in raw:
            return None
        return float(raw["x"]), float(raw["y"])
    if not isinstance(raw, (list, tuple)) or len(raw) != 2:
        return None
    return float(raw[0]), float(raw[1])


def zone_layers(event: Event) -> list[str]:
    tags = event.data.get("tags")
    tag_set = set(tags) if tags else set()
    layers = []

    if event.type in COMBAT_TYPES:
        layers.append("combat")
    if event.type == RETREAT_TYPE:
        layers.append("retreat")
    if event.type == DODGE_TYPE:
        layers.append("dodge")
    if event.type == DEATH_TYPE:
        layers.append("death")
    if event.type in COMBAT_TYPES and MELEE_TAG in tag_set:
        layers.append("melee")
    if event.type == ABILITY_CAST_TYPE and SPELL_TAG in tag_set:
        layers.append("spell")
    if HIGH_RISK_TAG in tag_set:
        layers.append("high_risk")

    return layers
