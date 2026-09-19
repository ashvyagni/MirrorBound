"""Maps a raw gameplay Event into the semantic action token SequencePredictor
consumes (doc section 16: DASH -> FIRE -> AERIAL_ATTACK, etc.).

Contract (see docs/contracts/telemetry-events.md): an event is recognized as a
player action either by an explicit `data["action_token"]` override, or by a
known `type`. Anything else — enemy events, outcome events like ENEMY_KILLED,
events with neither a known type nor an override — yields no token. We never
guess at what a player action "must have been" from incomplete data.
"""

from __future__ import annotations

from mirrorbound.game.core.events import Event

# type -> token, for events whose type alone is enough to identify the action.
KNOWN_ACTION_TOKENS = {
    "PLAYER_DASHED": "DASH",
    "PLAYER_DODGED": "DODGE",
    "PLAYER_ATTACKED": "ATTACK",
    "PLAYER_RETREATED": "RETREAT",
    "PLAYER_BLOCKED": "BLOCK",
}

# Content-driven: the ability's own name becomes the token, so a new ability
# added purely as data (doc section 30) needs no code change here.
ABILITY_CAST_TYPE = "PLAYER_ABILITY_CAST"


def action_token(event: Event) -> str | None:
    override = event.data.get("action_token")
    if override:
        return str(override)
    if event.type == ABILITY_CAST_TYPE:
        ability = event.data.get("ability")
        return str(ability) if ability else None
    return KNOWN_ACTION_TOKENS.get(event.type)
