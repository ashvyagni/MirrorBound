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
    # Six, not four. Two hands used to grant two abilities each and fill four
    # keys exactly; a staff grants three, so a sword and a staff come to five
    # and a cap of four would make the last spell unreachable rather than
    # merely inconvenient.
    ability: int | None = Field(None, ge=1, le=6)
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
    "TWIN_REQUEST", "TWIN_CALL", "SAVE", "RESPEC",
    # Save slots. SAVE writes the slot the run is already playing; SAVE_AS
    # makes a new named one, LOAD_SAVE restarts the run from one, DELETE_SAVE
    # throws one away and RESET_DATA throws away every slot this profile has.
    "SAVE_AS", "NEW_SAVE", "LOAD_SAVE", "DELETE_SAVE", "RESET_DATA",
    # Debug. Puts a real enemy in the room -- not a prop: it spawns through the
    # ordinary spawn path, so it is driven by the ordinary AI and is hostile in
    # the ordinary way. The console is the only thing that sends it.
    "SPAWN",
    # Sandbox tools. GIVE drops a weapon on the ground in front of the player
    # rather than putting it in a bag, so picking it up is the ordinary pickup
    # path; CONFIGURE_BOSS arms the Mirror and sets how much of you it starts
    # out already knowing.
    "GIVE", "CONFIGURE_BOSS",
]


class CommandMessage(BaseModel):
    """Discrete, menu-driven actions."""
    type: Literal["COMMAND"] = "COMMAND"
    action: CommandAction
    weaponId: str | None = None
    skillId: str | None = None
    itemId: str | None = None
    abilityId: str | None = None
    slot: int | None = Field(None, ge=1, le=6)
    stance: str | None = None
    seed: int | None = None
    areaId: str | None = None
    npcId: str | None = None
    # Length-capped here as well as sanitised server-side: the contract is the
    # first place a hostile client meets, and it should not accept a megabyte.
    playerName: str | None = Field(None, max_length=64)
    twinName: str | None = Field(None, max_length=64)
    enemyType: str | None = None   # SPAWN
    # Save slots. The id is one the server handed out; the name is the player's
    # own text and is length-capped here and sanitised again before it is
    # written, for the same reason the character names are.
    saveId: str | None = Field(None, max_length=64)
    saveName: str | None = Field(None, max_length=48)
    # CONFIGURE_BOSS. `bossSkill` is 0..1 and stands for how much of the player
    # the Mirror starts out having learned; the weapons are what it fights with.
    bossWeapon: str | None = None
    bossOffhand: str | None = None
    bossSkill: float | None = Field(None, ge=0.0, le=1.0)



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
