"""Ability definitions and data."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AbilityType(Enum):
    """Types of abilities."""
    DASH = "dash"
    AOE = "aoe"
    HEAL = "heal"
    BUFF = "buff"


@dataclass
class AbilityDef:
    """Ability definition."""
    name: str
    type: AbilityType
    slot: int  # 1-4
    cooldown: float  # Seconds
    cost: float  # Mana cost (reserved for future)
    effect_value: float  # Damage, heal amount, etc.
    duration: float  # For buffs, 0 for instant
    range: float  # 0 = self-centered
    tags: list[str]  # For telemetry


# Concrete abilities
DASH = AbilityDef(
    name="dash",
    type=AbilityType.DASH,
    slot=1,
    cooldown=3.0,
    cost=10,
    effect_value=150,  # Distance in world units
    duration=0,
    range=0,
    tags=["MOBILITY"],
)

FIRE_BURST = AbilityDef(
    name="fire_burst",
    type=AbilityType.AOE,
    slot=2,
    cooldown=5.0,
    cost=25,
    effect_value=30,  # Damage
    duration=0,
    range=100,  # AoE radius
    tags=["RANGED", "AOE", "BURST"],
)

HEAL = AbilityDef(
    name="heal",
    type=AbilityType.HEAL,
    slot=3,
    cooldown=8.0,
    cost=20,
    effect_value=40,  # Heal amount
    duration=0,
    range=0,
    tags=["DEFENSIVE"],
)

SHIELD = AbilityDef(
    name="shield",
    type=AbilityType.BUFF,
    slot=4,
    cooldown=6.0,
    cost=15,
    effect_value=0.5,  # 50% damage reduction
    duration=3.0,  # Seconds
    range=0,
    tags=["DEFENSIVE"],
)

# Ability registry
ABILITIES: dict[str, AbilityDef] = {
    "dash": DASH,
    "fire_burst": FIRE_BURST,
    "heal": HEAL,
    "shield": SHIELD,
}

# Slot to ability mapping
SLOT_ABILITIES: dict[int, AbilityDef] = {
    1: DASH,
    2: FIRE_BURST,
    3: HEAL,
    4: SHIELD,
}


def get_ability(name: str) -> AbilityDef:
    """Get ability by name."""
    if name not in ABILITIES:
        raise ValueError(f"Unknown ability: {name}")
    return ABILITIES[name]


def get_ability_by_slot(slot: int) -> AbilityDef | None:
    """Get ability by slot number."""
    return SLOT_ABILITIES.get(slot)
