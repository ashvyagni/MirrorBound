"""Inbound client messages and the agent's intent shape, as Pydantic models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, ValidationError


class InputMessage(BaseModel):
    """Per-frame movement/combat input. Facing is derived server-side."""
    type: Literal["INPUT"] = "INPUT"
    moveX: float = Field(0.0, ge=-1.0, le=1.0)
    moveY: float = Field(0.0, ge=-1.0, le=1.0)
    attack: bool = False
    run: bool = False
    ability: int | None = Field(None, ge=1, le=4)
    # Where the cursor is, as a unit vector from the player. Attacks and spells
    # go this way; movement no longer decides which way you are pointing.
    # Zero means "no cursor", and facing falls back to the way you are walking.
    aimX: float = Field(0.0, ge=-1.0, le=1.0)
    aimY: float = Field(0.0, ge=-1.0, le=1.0)
    seq: int | None = None      # client sequence number, echoed for reconciliation


CommandAction = Literal[
    "EQUIP_WEAPON", "TWIN_EQUIP", "UNLOCK_SKILL", "USE_ITEM", "SET_ABILITY_SLOT",
    "PAUSE", "RESUME", "RESTART", "REQUEST_ROOM", "SET_TWIN_STANCE",
    # World and progression.
    "SWAP_WEAPON", "SET_OFFHAND", "TRAVEL", "TALK", "BUY_ITEM", "SET_NAME",
    "TWIN_REQUEST", "SAVE", "RESPEC",
    # Debug. Puts a real enemy in the room -- not a prop: it spawns through the
    # ordinary spawn path, so it is driven by the ordinary AI and is hostile in
    # the ordinary way. The console is the only thing that sends it.
    "SPAWN",
]


class CommandMessage(BaseModel):
    """Discrete, menu-driven actions."""
    type: Literal["COMMAND"] = "COMMAND"
    action: CommandAction
    weaponId: str | None = None
    skillId: str | None = None
    itemId: str | None = None
    abilityId: str | None = None
    slot: int | None = Field(None, ge=1, le=4)
    stance: str | None = None
    seed: int | None = None
    areaId: str | None = None
    npcId: str | None = None
    # Length-capped here as well as sanitised server-side: the contract is the
    # first place a hostile client meets, and it should not accept a megabyte.
    playerName: str | None = Field(None, max_length=64)
    twinName: str | None = Field(None, max_length=64)
    enemyType: str | None = None   # SPAWN



ClientMessage = InputMessage | CommandMessage


class TwinIntentModel(BaseModel):
    """The shape every twin controller must return (validated in tests)."""
    intentType: str
    targetId: str | None = None
    position: dict | None = None
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    utilities: dict[str, float] = Field(default_factory=dict)
    reason: str = ""
    desiredWeapon: str | None = None


def parse_client_message(raw: dict) -> ClientMessage | None:
    """Return a validated message, or None if the payload is malformed."""
    kind = raw.get("type")
    try:
        if kind == "INPUT":
            return InputMessage.model_validate(raw)
        if kind == "COMMAND":
            return CommandMessage.model_validate(raw)
    except ValidationError:
        return None
    return None
