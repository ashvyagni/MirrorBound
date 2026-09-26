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
    #: The two abilities carrying this weapon grants.
    #:
    #: Abilities belong to weapons rather than to the player. Carrying a sword
    #: is what gives you a shield and a step; carrying a staff is what gives
    #: you the spell. Two weapons are held at once, so the four ability keys
    #: are the main hand's pair followed by the offhand's -- which makes the
    #: choice of what to carry the choice of what you can do, instead of a
    #: loadout screen you set once and forget.
    abilities: tuple[str, ...] = ()
    animation: str = "sword"    # client swing sheet id
    vfx: str = "slash"
    sound: str = "slash"
    description: str = ""
    #: What the third upgrade turns on, and the line the smith says about it.
    #:
    #: §17 wants weapons to have an identity rather than a damage number, and
    #: §18 wants somewhere for essence and shards to go. Upgrading is both: the
    #: first two tiers sharpen the weapon, and the third changes what it does.
    perk: str = ""
    perk_name: str = ""

    def get_tags(self) -> list[str]:
        return list(self.tags)

    @property
    def is_melee(self) -> bool:
        """Whether the basic attack swings rather than shoots.

        Read off the projectile, not the type. A staff is a MAGIC weapon whose
        M1 is a physical bash -- its element lives in the three spells it
        grants, not in poking someone with it -- so keying this to the type
        would make every staff shoot on M1 and would tell the twin's controller
        to hold ranged distance while holding a stick.
        """
        return self.projectile is None

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
            "abilities": list(self.abilities),
            "description": self.description,
            "perk": self.perk,
            "perkName": self.perk_name,
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
    # Guard and go: the opening kit, and the one that teaches both defensive buttons.
    abilities=("aegis", "shadow_dash"),
    animation="sword",
    vfx="slash",
    sound="slash",
    description="Three-hit chain. The finisher hits hardest and knocks back.",
    perk="cleave", perk_name="Cleaving Edge",
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
    # Reach and recovery -- a hunter keeps its distance and patches itself up.
    abilities=("arrow_volley", "mending_light"),
    animation="bow",
    vfx="arrow",
    sound="bow",
    rarity=Rarity.UNCOMMON,
    description="Fast arrows with a high critical chance. Keep your distance.",
    perk="pierce", perk_name="Bodkin Heads",
)

EMBER_STAFF = WeaponDef(
    id="ember_staff",
    name="Ember Staff",
    type=WeaponType.MAGIC,
    family="staff",
    # The bash, not the bolt. The bolt is `ember_bolt` and costs mana like the
    # other two spells, so a staff is three spells and a way to keep something
    # off you while they recharge -- rather than a wand you hold down.
    damage=16,
    cooldown=0.62,
    range=74,
    resource_cost=0,
    knockback=150,
    tags=("MELEE", "MAGIC", "HEAVY"),
    combo_chain=(1.0,),
    arc_angle=1.9,
    # Everything the staff actually does: the bolt, a cone in front, and a
    # column around you when they have closed.
    abilities=("ember_bolt", "flame_burst", "flame_pillar"),
    animation="fireStaff",
    vfx="fire",
    sound="fire",
    rarity=Rarity.RARE,
    description="Smashes up close. Its fire is in the three spells it grants.",
    perk="ignite", perk_name="Banked Coals",
)

FROST_STAFF = WeaponDef(
    id="frost_staff",
    name="Frost Staff",
    type=WeaponType.MAGIC,
    family="staff",
    # A lighter, faster sweep than the ember staff's overhead smash.
    damage=12,
    cooldown=0.48,
    range=78,
    resource_cost=0,
    knockback=70,
    tags=("MELEE", "MAGIC", "FAST"),
    combo_chain=(1.0,),
    arc_angle=2.2,
    # The bolt, something to hold them still, and a hole through the line.
    abilities=("frost_bolt", "binding_nova", "arcane_bolt"),
    animation="iceStaff",
    vfx="ice",
    sound="ice",
    rarity=Rarity.RARE,
    description="Sweeps up close. Its frost is in the three spells it grants.",
    perk="brittle", perk_name="Hoarfrost",
)

WARDEN_PIKE = WeaponDef(
    # Reach, and the patience to use it. Drawn from the sword sheets, because a
    # long haft swung overhead is the same three frames as a blade -- §35 says
    # recombine before commissioning, and what makes this a different weapon is
    # that it hits from outside everything else's range and punishes you for
    # missing rather than for being close.
    id="warden_pike",
    name="Warden's Pike",
    type=WeaponType.MELEE,
    family="sword",
    damage=21,
    cooldown=0.78,
    range=104,
    resource_cost=0,
    knockback=300,
    tags=("MELEE", "HEAVY"),
    combo_chain=(1.0, 1.45),
    combo_window=1.1,
    # Narrow: the reach is paid for by having to be pointed at the thing.
    arc_angle=1.1,
    abilities=("aegis", "binding_nova"),
    animation="sword",
    vfx="slash",
    sound="slash",
    rarity=Rarity.RARE,
    perk="impale", perk_name="Barbed Head",
    description="Long, slow and narrow. It reaches what nothing else does.",
)

SHARD_LANCE = WeaponDef(
    # The Glasswork's own. A staff whose spells are all line and no splash:
    # where the ember staff asks you to gather a crowd, this asks you to line
    # one up.
    id="shard_lance",
    name="Shard Lance",
    type=WeaponType.MAGIC,
    family="staff",
    damage=13,
    cooldown=0.52,
    range=80,
    resource_cost=0,
    knockback=80,
    tags=("MELEE", "MAGIC", "FAST"),
    combo_chain=(1.0,),
    arc_angle=2.0,
    # Its own volley, not the Mirror's: `mirror_volley` costs no mana because
    # a boss has no mana, and putting it on a weapon would hand the player a
    # free three-shot spell. Splinter Volley is the costed version of the idea.
    abilities=("arcane_bolt", "splinter_volley", "shadow_dash"),
    animation="iceStaff",
    vfx="ice",
    sound="ice",
    rarity=Rarity.RARE,
    perk="refract", perk_name="Facet Cut",
    description="Everything it throws goes in a straight line, and through.",
)

BARE_HANDS = WeaponDef(
    id="bare_hands",
    name="Bare Hands",
    type=WeaponType.MELEE,
    family="sword",
    damage=6,
    cooldown=0.36,
    range=48,
    resource_cost=0,
    knockback=90,
    tags=("MELEE", "FAST"),
    combo_chain=(1.0, 1.1),
    combo_window=0.8,
    arc_angle=1.7,
    # No abilities at all. Empty hands fall back to the dash, which is the one
    # thing you can always do -- see `Inventory.ability_slots`.
    abilities=(),
    # Nothing is drawn in an empty hand. This is the sheet the *client* would
    # hang on the player, not the family the swipe belongs to -- naming "sword"
    # here put a full iron blade in the hands of a player who has not found one
    # yet, through the whole opening village.
    animation="",
    vfx="slash",
    sound="slash",
    description="Two quick swipes. Short reach, and it will not carry you far.",
)


ADMIN_STICK = WeaponDef(
    # A testing tool, not a weapon. It exists so that "does this enemy's death
    # do the right thing" can be answered in one swing instead of a fight, and
    # so the sandbox does not need a separate kill command for every archetype.
    #
    # The reach and the arc are wide rather than infinite: the point is to be
    # able to delete something you are standing in front of, not to clear a
    # room by facing it.
    id="admin_stick",
    name="Admin Stick",
    type=WeaponType.MELEE,
    family="sword",
    damage=1_000_000,
    cooldown=0.18,
    range=160,
    resource_cost=0,
    knockback=0,
    tags=("MELEE", "ADMIN"),
    combo_chain=(1.0,),
    combo_window=0.5,
    arc_angle=2.6,
    abilities=("aegis", "shadow_dash"),
    animation="sword",
    vfx="slash",
    sound="slash",
    description="Deletes what it touches. For testing, not for playing.",
)

WEAPONS: dict[str, WeaponDef] = {
    w.id: w for w in (BARE_HANDS, IRON_SWORD, HUNTER_BOW, EMBER_STAFF, FROST_STAFF,
                      WARDEN_PIKE, SHARD_LANCE, ADMIN_STICK)
}

#: What an upgrade costs and what it gives.
#:
#: Gold *and* shards, because gold alone was already spendable and shards were
#: not spendable at all -- `RESOURCES` has described them as fuel for "relic
#: crafting later" since the beta, and this is the sink that makes picking one
#: up mean something. Essence goes in too at the top tier: it is the commonest
#: drop in the game and it had nowhere to go.
MAX_UPGRADE = 3
UPGRADE_COST: tuple[dict[str, int], ...] = (
    {"gold": 120, "shards": 2, "essence": 0},
    {"gold": 260, "shards": 5, "essence": 20},
    {"gold": 500, "shards": 9, "essence": 60},
)
#: What each tier adds to a weapon's damage, multiplicatively.
UPGRADE_DAMAGE: tuple[float, ...] = (0.0, 0.14, 0.30, 0.50)


def upgrade_cost(tier: int) -> dict[str, int] | None:
    """What the next tier costs, or None when the weapon is finished."""
    return UPGRADE_COST[tier] if 0 <= tier < MAX_UPGRADE else None

#: Weapons that are testing tools rather than loot.
#:
#: Kept out of shops, out of drop tables and out of the twin's hands. The
#: `canonical_weapon_ids` list is what those read, so this is the one place the
#: distinction has to be made.
ADMIN_WEAPONS: frozenset[str] = frozenset({ADMIN_STICK.id})

# Backwards-compatible aliases for callers written against the earlier names.
WEAPONS["sword"] = IRON_SWORD
WEAPONS["bow"] = HUNTER_BOW
WEAPONS["fire_staff"] = EMBER_STAFF
WEAPONS["ice_staff"] = FROST_STAFF

#: What you begin with, which is nothing.
#:
#: The opening minute is two swipes and a dash, and the first weapon you find
#: is the first time the ability bar has anything on it. That is the point:
#: with abilities bound to weapons, starting armed would hand over half the
#: moveset before the player has been shown there is a choice in it.
STARTING_WEAPON = ""

#: The blade a dungeon entrance leaves out for an unarmed player.
#:
#: Separate from `STARTING_WEAPON`, which is what you are *holding* when the
#: game begins -- nothing. This is what the world puts in front of you when you
#: have nothing, so the moment you first get an ability is something you walked
#: over and picked up rather than something you woke up with.
STARTING_BLADE = IRON_SWORD.id
TWIN_STARTING_WEAPON = FROST_STAFF.id


def get_weapon(name: str) -> WeaponDef:
    if name not in WEAPONS:
        raise ValueError(f"Unknown weapon: {name}")
    return WEAPONS[name]


def canonical_weapon_ids(include_admin: bool = False) -> list[str]:
    """Every weapon once, aliases collapsed.

    Testing tools are excluded by default: this list is what shops, drop tables
    and the twin's loadout read, and none of them should ever be handed the
    admin stick.
    """
    seen: list[str] = []
    for w in WEAPONS.values():
        if w.id in seen:
            continue
        if not include_admin and w.id in ADMIN_WEAPONS:
            continue
        seen.append(w.id)
    return seen
