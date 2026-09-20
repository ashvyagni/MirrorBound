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
    SHIELD = "shield"
    #: A line out from the caster, resolved instantly, hitting everything on it.
    #:
    #: Not a fast projectile. `arcane_bolt` was one of those and threw a violet
    #: thorn, while its icon and its cast animation were both the ice beam --
    #: which is a lance that grows from the staff and retracts, and cannot fly
    #: across a room without reading as the wrong thing entirely.
    BEAM = "beam"


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
    #: How far out from the caster the effect starts, along their facing.
    #:
    #: A beam leaves the *tip of the staff*, not the middle of the creature
    #: holding it, and the staff is held out in front during the cast. Without
    #: this the hitbox starts inside the caster and the drawn lance starts
    #: somewhere the staff is not.
    muzzle: float = 0.0
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
    type=AbilityType.BEAM,
    slot=1,
    icon="arcane_bolt",
    cooldown=1.2,
    cost=8,
    cast_time=0.0,
    # Long. It is the one attack in the game that crosses a room, which is
    # what a beam is for and what pays for having to aim it -- the view is 960
    # units wide, so this reaches most of the way across whatever you can see.
    range=760,
    damage=22,
    # The beam's half-width. A line with no thickness is a line nothing is ever
    # quite standing on, so this is what makes aiming forgiving enough to use.
    area=26,
    # Measured off the cast animation: the staff is held out and forward, and
    # its head sits about this far along the facing when the lance appears.
    muzzle=52,
    tags=("RANGED", "SPELL", "MAGIC"),
    vfx="arcane",
    sound="arcane",
    description="A lance of light that spears everything in front of you.",
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
    slot=4,
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
    slot=3,
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

MENDING_LIGHT = AbilityDef(
    id="mending_light",
    name="Mending Light",
    type=AbilityType.HEAL,
    slot=4,
    icon="mending_light",
    cooldown=11.0,
    cost=26,
    # The only ability with a real cast time. Heal is meant to be a decision you
    # commit to and can lose, not a reflex -- taking a hit during the cast
    # interrupts it and refunds nothing, so healing under pressure means making
    # space first. See CombatSystem.update for the interrupt.
    cast_time=0.55,
    range=0,
    damage=0,
    area=0,
    tags=("SUPPORT", "DEFENSIVE", "MAGIC"),
    effect_value=45,       # health restored
    vfx="mend",
    sound="heal",
    description="Channel for a moment to restore 45 health. Taking a hit interrupts it.",
)

AEGIS = AbilityDef(
    id="aegis",
    name="Aegis",
    type=AbilityType.SHIELD,
    slot=4,
    icon="aegis",
    cooldown=14.0,
    cost=20,
    cast_time=0.0,
    range=0,
    damage=0,
    area=0,
    tags=("DEFENSIVE", "MAGIC"),
    effect_tags=("SHIELD",),
    duration=5.0,
    vfx="aegis",
    sound="shield",
    description="A ward that cuts incoming damage by 40% for five seconds.",
)

ARROW_VOLLEY = AbilityDef(
    id="arrow_volley",
    name="Arrow Volley",
    type=AbilityType.PROJECTILE,
    slot=1,
    icon="arrow_volley",
    cooldown=2.4,
    cost=12,
    cast_time=0.0,
    range=480,
    damage=15,
    area=0,
    tags=("RANGED", "PHYSICAL"),
    projectile=ProjectileSpec(kind="arrow", speed=620, radius=6, lifetime=1.0, pierce=False),
    vfx="arrow",
    sound="bow",
    description="A fast arrow loosed in your facing direction.",
)

FLAME_PILLAR = AbilityDef(
    id="flame_pillar",
    name="Flame Pillar",
    type=AbilityType.NOVA,
    slot=2,
    icon="flame_pillar",
    cooldown=6.5,
    cost=24,
    cast_time=0.25,
    range=0,
    damage=34,
    area=120,
    tags=("AOE", "SPELL", "FIRE"),
    vfx="fire",
    sound="fire",
    description="A column of fire erupts around you.",
)


#: The two bolts the staves used to fire on M1.
#:
#: Moved off the basic attack and onto a key, which is what turns a staff from
#: a wand you hold down into three spells with a bash to buy time between them.
#: Cheap and short-cooldown compared with the other two each staff grants --
#: this is the spell you open with, not the one you save.
EMBER_BOLT = AbilityDef(
    id="ember_bolt",
    name="Ember Bolt",
    type=AbilityType.PROJECTILE,
    slot=1,
    icon="ember_bolt",
    cooldown=0.85,
    cost=6,
    cast_time=0.0,
    range=320,
    damage=20,
    area=0,
    tags=("RANGED", "SPELL", "MAGIC", "AOE", "BURST"),
    projectile=ProjectileSpec(kind="fire_bolt", speed=380, radius=9, lifetime=1.2, aoe_radius=56),
    vfx="fire",
    sound="fire",
    description="A slow fireball that bursts on impact and hurts everything nearby.",
)

FROST_BOLT = AbilityDef(
    id="frost_bolt",
    name="Frost Bolt",
    type=AbilityType.PROJECTILE,
    slot=1,
    icon="frost_bolt",
    cooldown=0.5,
    cost=4,
    cast_time=0.0,
    range=340,
    damage=11,
    area=0,
    tags=("RANGED", "SPELL", "MAGIC", "FAST"),
    projectile=ProjectileSpec(kind="ice_bolt", speed=440, radius=6, lifetime=1.1,
                              slow=0.55, slow_duration=1.6),
    vfx="ice",
    sound="ice",
    description="A rapid frost bolt that slows whatever it touches.",
)

# --- the Mirror's own -------------------------------------------------------
#
# Its two, as data rather than as special cases in the controller. The nova was
# already in the fight -- hard-coded in `MirrorController._nova` with its radius
# and damage as module constants -- and the shard volley was not in it at all.
# Writing both as abilities is what lets the boss run one selection routine over
# its own kit and the kit it took from you, instead of one branch per move.
#
# Neither is on any weapon and neither has a slot, because nothing the player
# can hold grants them: these are the Mirror's.

MIRROR_NOVA = AbilityDef(
    id="mirror_nova",
    name="Sundering",
    type=AbilityType.NOVA,
    slot=0,
    icon="binding_nova",
    cooldown=7.0,
    cost=0,
    # The telegraph *is* the mechanic: the whole encounter is built on having
    # time to read a wind-up and leave. Kept at the value the hard-coded
    # version charged for.
    cast_time=0.9,
    range=0,
    damage=22,
    area=150,
    tags=("SPELL", "AOE", "BOSS"),
    description="A ring of force that breaks outward from the Mirror.",
)

MIRROR_VOLLEY = AbilityDef(
    id="mirror_volley",
    name="Shardfall",
    type=AbilityType.PROJECTILE,
    slot=0,
    icon="arcane_bolt",
    cooldown=4.5,
    cost=0,
    cast_time=0.0,
    range=420,
    damage=13,
    area=0,
    tags=("RANGED", "SPELL", "BOSS"),
    # Three at once, spread wide enough to punish standing still at range but
    # not so wide that closing the gap is impossible. The Mirror's answer to a
    # player who has learned to keep away from it.
    projectile=ProjectileSpec(kind="mirror_bolt", speed=400, radius=7, lifetime=1.5,
                              count=3, spread=0.22),
    description="Three shards of the broken mirror, thrown at once.",
)


ABILITIES: dict[str, AbilityDef] = {
    a.id: a for a in (ARCANE_BOLT, FLAME_BURST, SHADOW_DASH, BINDING_NOVA, MENDING_LIGHT, AEGIS,
                      ARROW_VOLLEY, FLAME_PILLAR, EMBER_BOLT, FROST_BOLT,
                      MIRROR_NOVA, MIRROR_VOLLEY)
}

#: What you hold when nothing is equipped.
#:
#: Abilities belong to weapons now, not to the player -- see
#: `WeaponDef.abilities`. This is the fallback for an empty pair of hands, and
#: it is deliberately just the dash: with no weapon there is nothing to cast
#: with, but there is always somewhere to be that is not here.
DEFAULT_SLOTS: tuple[str, ...] = (SHADOW_DASH.id,)


def get_ability(name: str) -> AbilityDef:
    if name not in ABILITIES:
        raise ValueError(f"Unknown ability: {name}")
    return ABILITIES[name]


def get_ability_by_slot(slot: int, slots: tuple[str, ...] | list[str] = DEFAULT_SLOTS) -> AbilityDef | None:
    if 1 <= slot <= len(slots):
        return ABILITIES.get(slots[slot - 1])
    return None
