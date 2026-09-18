"""Weapon definitions. Pure data — the combat system interprets it.

Four families, each of which has a matching swing sheet on the client
(`src/web/public/game/{swordA,swordB,swordC,bow,fireStaff,iceStaff}`), so
every weapon here is something the player can actually see swing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class WeaponType(Enum):
    MELEE = "melee"
    RANGED = "ranged"
    MAGIC = "magic"


class Rarity(Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"


@dataclass(frozen=True)
class ProjectileSpec:
    kind: str            # client texture key: "arrow", "fire_bolt", "ice_bolt", "arcane_bolt"
    speed: float
    radius: float
    lifetime: float
    count: int = 1
    spread: float = 0.0  # radians between projectiles when count > 1
    aoe_radius: float = 0.0
    pierce: bool = False
    slow: float = 0.0    # 0 = none, else target speed multiplier (0.6 = 40% slow)
    slow_duration: float = 0.0


@dataclass(frozen=True)
class WeaponDef:
    id: str
    name: str
    type: WeaponType
    family: str                 # "sword" | "bow" | "staff"
    damage: float
    cooldown: float             # seconds between attacks (attack speed)
    range: float                # melee reach / projectile effective range
    resource_cost: float        # mana per attack (0 for physical weapons)
    knockback: float
    tags: tuple[str, ...]       # telemetry vocabulary: MELEE, RANGED, MAGIC, FAST, HEAVY, AOE, BURST, SPELL
    # Damage multiplier per hit in a combo chain; length 1 = no combo.
    combo_chain: tuple[float, ...] = (1.0,)
    combo_window: float = 0.9
    arc_angle: float = 1.9      # radians, melee only
    projectile: ProjectileSpec | None = None
    crit_chance: float = 0.08
    crit_multiplier: float = 1.6
    rarity: Rarity = Rarity.COMMON
    animation: str = "sword"    # client swing sheet id
    vfx: str = "slash"
    sound: str = "slash"
    description: str = ""

    def get_tags(self) -> list[str]:
        return list(self.tags)

    @property
    def is_melee(self) -> bool:
        return self.type is WeaponType.MELEE

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "family": self.family,
            "damage": self.damage,
            "cooldown": self.cooldown,
            "range": self.range,
            "resourceCost": self.resource_cost,
            "tags": list(self.tags),
            "comboLength": len(self.combo_chain),
            "rarity": self.rarity.value,
            "animation": self.animation,
            "description": self.description,
        }


IRON_SWORD = WeaponDef(
    id="iron_sword",
    name="Iron Sword",
    type=WeaponType.MELEE,
    family="sword",
    damage=14,
    cooldown=0.42,
    range=64,
    resource_cost=0,
    knockback=180,
    tags=("MELEE", "FAST"),
    combo_chain=(1.0, 1.1, 1.5),
    combo_window=0.9,
    arc_angle=2.0,
    animation="sword",
    vfx="slash",
    sound="slash",
    description="Three-hit chain. The finisher hits hardest and knocks back.",
)

HUNTER_BOW = WeaponDef(
    id="hunter_bow",
    name="Hunter's Bow",
    type=WeaponType.RANGED,
    family="bow",
    damage=16,
    cooldown=0.7,
    range=380,
    resource_cost=0,
    knockback=60,
    tags=("RANGED",),
    projectile=ProjectileSpec(kind="arrow", speed=520, radius=5, lifetime=1.1),
    crit_chance=0.15,
    animation="bow",
    vfx="arrow",
    sound="bow",
    rarity=Rarity.UNCOMMON,
    description="Fast arrows with a high critical chance. Keep your distance.",
)

EMBER_STAFF = WeaponDef(
    id="ember_staff",
    name="Ember Staff",
    type=WeaponType.MAGIC,
    family="staff",
    damage=20,
    cooldown=0.85,
    range=320,
    resource_cost=6,
    knockback=120,
    tags=("RANGED", "MAGIC", "SPELL", "AOE", "BURST"),
    projectile=ProjectileSpec(kind="fire_bolt", speed=380, radius=9, lifetime=1.2, aoe_radius=56),
    animation="fireStaff",
    vfx="fire",
    sound="fire",
    rarity=Rarity.RARE,
    description="Slow fireballs that burst on impact and hurt everything nearby.",
)

FROST_STAFF = WeaponDef(
    id="frost_staff",
    name="Frost Staff",
    type=WeaponType.MAGIC,
    family="staff",
    damage=11,
    cooldown=0.5,
    range=340,
    resource_cost=4,
    knockback=40,
    tags=("RANGED", "MAGIC", "SPELL", "FAST"),
    projectile=ProjectileSpec(kind="ice_bolt", speed=440, radius=6, lifetime=1.1, slow=0.55, slow_duration=1.6),
    animation="iceStaff",
    vfx="ice",
    sound="ice",
    rarity=Rarity.RARE,
    description="Rapid frost bolts that slow whatever they touch.",
)

WEAPONS: dict[str, WeaponDef] = {
    w.id: w for w in (IRON_SWORD, HUNTER_BOW, EMBER_STAFF, FROST_STAFF)
}

# Backwards-compatible aliases for callers written against the earlier names.
WEAPONS["sword"] = IRON_SWORD
WEAPONS["bow"] = HUNTER_BOW
WEAPONS["fire_staff"] = EMBER_STAFF
WEAPONS["ice_staff"] = FROST_STAFF

STARTING_WEAPON = IRON_SWORD.id
TWIN_STARTING_WEAPON = FROST_STAFF.id


def get_weapon(name: str) -> WeaponDef:
    if name not in WEAPONS:
        raise ValueError(f"Unknown weapon: {name}")
    return WEAPONS[name]


def canonical_weapon_ids() -> list[str]:
    seen: list[str] = []
    for w in WEAPONS.values():
        if w.id not in seen:
            seen.append(w.id)
    return seen
