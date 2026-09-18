"""Ability definitions. Pure data — `CombatSystem.process_ability` interprets it.

Every field the HUD needs (icon, keybind slot, cooldown, cost) and every field
the simulation needs (damage, range, area, projectile, effect tags) lives here,
so adding an ability is adding a row.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from mirrorbound.game.combat.weapons import ProjectileSpec


class AbilityType(Enum):
    PROJECTILE = "projectile"
    CONE = "cone"
    DASH = "dash"
    NOVA = "nova"
    HEAL = "heal"


@dataclass(frozen=True)
class AbilityDef:
    id: str
    name: str
    type: AbilityType
    slot: int                  # 1-4 default keybind
    icon: str                  # client icon key
    cooldown: float
    cost: float                # mana
    cast_time: float           # seconds of wind-up (0 = instant)
    range: float
    damage: float
    area: float                # radius for NOVA / AoE, cone length for CONE
    tags: tuple[str, ...]
    effect_tags: tuple[str, ...] = ()
    projectile: ProjectileSpec | None = None
    cone_angle: float = 1.2    # radians, CONE only
    duration: float = 0.0      # effect duration (slow, invulnerability)
    effect_value: float = 0.0  # dash distance, slow factor, heal amount
    vfx: str = ""
    animation: str = "cast"
    sound: str = "cast"
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "slot": self.slot,
            "icon": self.icon,
            "cooldown": self.cooldown,
            "cost": self.cost,
            "castTime": self.cast_time,
            "range": self.range,
            "damage": self.damage,
            "area": self.area,
            "tags": list(self.tags),
            "description": self.description,
        }


ARCANE_BOLT = AbilityDef(
    id="arcane_bolt",
    name="Arcane Bolt",
    type=AbilityType.PROJECTILE,
    slot=1,
    icon="arcane_bolt",
    cooldown=1.2,
    cost=8,
    cast_time=0.0,
    range=420,
    damage=22,
    area=0,
    tags=("RANGED", "SPELL", "MAGIC"),
    projectile=ProjectileSpec(kind="arcane_bolt", speed=560, radius=7, lifetime=0.9, pierce=True),
    vfx="arcane",
    sound="arcane",
    description="A piercing bolt of violet light fired in your facing direction.",
)

FLAME_BURST = AbilityDef(
    id="flame_burst",
    name="Flame Burst",
    type=AbilityType.CONE,
    slot=2,
    icon="flame_burst",
    cooldown=5.0,
    cost=22,
    cast_time=0.0,
    range=170,
    damage=38,
    area=170,
    cone_angle=1.35,
    tags=("RANGED", "SPELL", "MAGIC", "AOE", "BURST"),
    effect_tags=("BURN",),
    vfx="flame",
    sound="fire",
    description="A cone of fire in front of you. Heavy damage, long cooldown.",
)

SHADOW_DASH = AbilityDef(
    id="shadow_dash",
    name="Shadow Dash",
    type=AbilityType.DASH,
    slot=3,
    icon="shadow_dash",
    cooldown=2.6,
    cost=10,
    cast_time=0.0,
    range=0,
    damage=0,
    area=0,
    tags=("MOBILITY",),
    effect_value=190,      # dash distance in world units
    duration=0.28,         # invulnerability window
    vfx="shadow",
    animation="dash",
    sound="dash",
    description="Blink a short distance in your facing direction. You cannot be hit while dashing.",
)

BINDING_NOVA = AbilityDef(
    id="binding_nova",
    name="Binding Nova",
    type=AbilityType.NOVA,
    slot=4,
    icon="binding_nova",
    cooldown=8.0,
    cost=28,
    cast_time=0.0,
    range=0,
    damage=18,
    area=150,
    tags=("SPELL", "MAGIC", "AOE", "DEFENSIVE"),
    effect_tags=("SLOW",),
    effect_value=0.35,     # slowed enemies move at 35%
    duration=2.6,
    vfx="nova",
    sound="nova",
    description="A ring of binding light. Damages and heavily slows every enemy around you.",
)

ABILITIES: dict[str, AbilityDef] = {
    a.id: a for a in (ARCANE_BOLT, FLAME_BURST, SHADOW_DASH, BINDING_NOVA)
}

DEFAULT_SLOTS: tuple[str, str, str, str] = (
    ARCANE_BOLT.id, FLAME_BURST.id, SHADOW_DASH.id, BINDING_NOVA.id,
)


def get_ability(name: str) -> AbilityDef:
    if name not in ABILITIES:
        raise ValueError(f"Unknown ability: {name}")
    return ABILITIES[name]


def get_ability_by_slot(slot: int, slots: tuple[str, ...] | list[str] = DEFAULT_SLOTS) -> AbilityDef | None:
    if 1 <= slot <= len(slots):
        return ABILITIES.get(slots[slot - 1])
    return None
