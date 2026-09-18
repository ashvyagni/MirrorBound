"""Weapon definitions and data."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class WeaponType(Enum):
    """Types of weapons."""
    MELEE = "melee"
    RANGED = "ranged"
    PROJECTILE = "projectile"


@dataclass
class WeaponDef:
    """Weapon definition."""
    name: str
    type: WeaponType
    damage: float
    range: float  # World units
    cooldown: float  # Seconds
    hitbox_size: float  # Width for melee, radius for projectile
    knockback: float
    tags: list[str]  # For telemetry: MELEE, RANGED, SPELL, AOE, etc.
    projectile_speed: float = 0.0
    projectile_count: int = 1
    crit_chance: float = 0.1
    crit_multiplier: float = 1.5

    def get_tags(self) -> list[str]:
        """Get tags for telemetry events."""
        return self.tags.copy()


# Concrete weapons
SWORD = WeaponDef(
    name="sword",
    type=WeaponType.MELEE,
    damage=15,
    range=50,
    cooldown=0.4,
    hitbox_size=40,
    knockback=100,
    tags=["MELEE"],
)

BATTLE_AXE = WeaponDef(
    name="battle_axe",
    type=WeaponType.MELEE,
    damage=25,
    range=55,
    cooldown=0.7,
    hitbox_size=50,
    knockback=150,
    tags=["MELEE", "AOE"],
)

BOW = WeaponDef(
    name="bow",
    type=WeaponType.RANGED,
    damage=20,
    range=250,
    cooldown=0.8,
    hitbox_size=4,
    knockback=50,
    tags=["RANGED"],
    projectile_speed=400,
    projectile_count=1,
)

FIRE_STAFF = WeaponDef(
    name="fire_staff",
    type=WeaponType.PROJECTILE,
    damage=18,
    range=200,
    cooldown=1.0,
    hitbox_size=30,
    knockback=80,
    tags=["RANGED", "SPELL", "AOE", "BURST"],
    projectile_speed=300,
    projectile_count=1,
)

ICE_STAFF = WeaponDef(
    name="ice_staff",
    type=WeaponType.PROJECTILE,
    damage=12,
    range=220,
    cooldown=0.6,
    hitbox_size=5,
    knockback=30,
    tags=["RANGED", "SPELL"],
    projectile_speed=350,
    projectile_count=1,
)

# Weapon registry
WEAPONS: dict[str, WeaponDef] = {
    "sword": SWORD,
    "battle_axe": BATTLE_AXE,
    "bow": BOW,
    "fire_staff": FIRE_STAFF,
    "ice_staff": ICE_STAFF,
}


def get_weapon(name: str) -> WeaponDef:
    """Get weapon by name."""
    if name not in WEAPONS:
        raise ValueError(f"Unknown weapon: {name}")
    return WEAPONS[name]
