"""Ore, and what it is for.

Two jobs, and they are the reason mining exists rather than being a minigame
bolted to the side of a combat game:

1. **Ore trains attributes.** Every attribute has exactly one ore that feeds it
   (`attributes.py`), at a different depth, so raising the five means going to
   five different places. This is what makes the overworld load-bearing: the
   skill tree's deep nodes are gated on attributes, attributes are bought with
   ore, and ore is in the ground somewhere you have to walk to.

2. **Ore changes what a weapon is.** Fitted at the smith's bench, a material
   shifts the weapon's *shape* — how fast it swings, how far it shoves, whether
   it can be staggered — and almost never just its damage.

That second point is the one worth defending. The obvious design is "+0.3%
damage per iron", and it is wrong for the same reason `skills.py` argues a tree
of small multipliers is wrong. The iron sword does 14 damage; 0.3% of it is
0.042, so a player would need fifty iron to feel what one skill node gives
them, and the honest description of the feature would be "collect a hundred of
these to change a number you cannot see".

So every material here trades one thing against another, and several are
actively *bad* on the wrong weapon. That is the whole design: gold makes a
staff cheaper to cast and makes a sword worse, so "which ore goes in which
weapon" is a question with a wrong answer. A material with no downside and no
affinity would just be a damage coupon with a mining animation in front of it.

`ForgeBonuses` is folded from what a weapon has fitted and read by the same
paths that already read the upgrade tier, so no combat call site had to learn
what an ingot is.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: Weapon families a material can favour or spoil, matching `WeaponDef.family`.
FAMILIES = ("sword", "bow", "staff", "pike")


@dataclass(frozen=True)
class MaterialDef:
    id: str
    name: str
    #: 1..4. How deep it lives, what it is worth to a trainer, and how much of
    #: it a vein gives up.
    tier: int
    description: str
    #: What the smith says it does. Written for the bench, not for a tooltip
    #: generator -- a fitted material should read as a decision, not a stat line.
    forge_note: str = ""
    #: True for the one material that is fuel rather than an ingredient.
    fuel: bool = False
    # --- what fitting it does ---------------------------------------------------
    #
    # Multipliers are additive fractions: 0.10 means +10%. Negative is the cost
    # side of the trade, and most of these have one.
    damage_mult: float = 0.0
    #: Negative is faster. Applied to the weapon's cooldown.
    cooldown_mult: float = 0.0
    knockback_mult: float = 0.0
    crit_chance: float = 0.0
    crit_multiplier: float = 0.0
    #: Fraction of the target's mitigation ignored.
    pierce: float = 0.0
    #: Multiplier on mana per attack/cast. Negative is cheaper.
    mana_cost_mult: float = 0.0
    #: Cannot be knocked out of a swing while this is fitted.
    steadfast: bool = False
    #: Families this material is meant for. Empty means "any".
    favours: tuple[str, ...] = ()
    #: Families it actively spoils: the effects above are halved and the
    #: downside doubled. Gold in a blade is soft metal in a cutting edge.
    spoils: tuple[str, ...] = ()


MATERIALS: dict[str, MaterialDef] = {
    m.id: m
    for m in (
        MaterialDef(
            "coal", "Coal", 1,
            "Black rock that burns. Every forge and every trainer wants it, and "
            "nothing is made of it.",
            fuel=True,
            forge_note="Fuel. It goes into the fire, not into the weapon."),
        MaterialDef(
            "iron", "Iron", 1,
            "Common, heavy, and honest. The first thing anyone learns to dig.",
            forge_note="Heavier. Hits harder and recovers slower.",
            damage_mult=0.12, cooldown_mult=0.08),
        MaterialDef(
            "gold", "Gold", 2,
            "Too soft to cut with, and it carries a current better than anything else.",
            forge_note="Conducts. Spells cost less; an edge made of it is a poor edge.",
            mana_cost_mult=-0.25, damage_mult=-0.04,
            favours=("staff",), spoils=("sword", "pike")),
        MaterialDef(
            "silver", "Silver", 2,
            "What a mirror is backed with. It holds a reflection, which in the "
            "Reach has never been only a figure of speech.",
            forge_note="Answers. Sharper on the strike, and your twin reads the weapon "
                       "as readily as you do.",
            crit_chance=0.05, damage_mult=0.04),
        MaterialDef(
            "obsidian", "Obsidian", 3,
            "Cooled glass with an edge finer than steel and a temper worse than yours.",
            forge_note="Splits armour. Ignores a third of what is in the way, and "
                       "chips when it lands wrong.",
            pierce=0.33, damage_mult=-0.06,
            favours=("sword", "bow"), spoils=("staff",)),
        MaterialDef(
            "mithril", "Mithril", 3,
            "Light beyond reason. A blade of it weighs about as much as the idea of one.",
            forge_note="Quick. Swings noticeably faster and puts almost nothing behind it.",
            cooldown_mult=-0.22, knockback_mult=-0.35),
        MaterialDef(
            "diamond", "Diamond", 4,
            "The hardest thing there is, and useless in quantity — one stone is the "
            "whole of what it can give a weapon.",
            forge_note="Holds its edge. A telling blow tells for far more.",
            crit_multiplier=0.60, cooldown_mult=0.05),
        MaterialDef(
            "adamantine", "Adamantine", 4,
            "Star-metal, and the reason the Kiln was built where it was.",
            forge_note="Immovable. Nothing knocks you out of a swing, and everything "
                       "you hit goes further than it meant to.",
            steadfast=True, knockback_mult=0.40),
    )
}

#: Ore in tier order, for shops, journals and anything that lists them.
MATERIAL_ORDER: tuple[str, ...] = tuple(
    m.id for m in sorted(MATERIALS.values(), key=lambda m: (m.tier, m.id)))


def get_material(material_id: str) -> MaterialDef:
    material = MATERIALS.get(material_id)
    if material is None:
        raise ValueError(f"Unknown material: {material_id}")
    return material


# --- where it is in the ground ------------------------------------------------
#
# Keyed by the terrain of a region or the biome of a dungeon, so a place has an
# economy. Walking into the Kiln Terraces and finding adamantine is the reward
# for having got that far, and it is also the only reason to ever go back.
#
# Each entry is (material, weight). Weights are relative within the place, and
# the tier ceiling is what keeps the shallow end shallow -- there is no
# adamantine in a grass field at any weight.

VEIN_TABLE: dict[str, tuple[tuple[str, int], ...]] = {
    # Regions, by terrain.
    "grassland": (("coal", 4), ("iron", 5)),
    "forest": (("coal", 3), ("iron", 4), ("silver", 1)),
    "road": (("coal", 3), ("iron", 3), ("gold", 2)),
    "marsh": (("coal", 2), ("iron", 2), ("silver", 3), ("gold", 1)),
    "pass": (("coal", 2), ("iron", 2), ("mithril", 2), ("obsidian", 2)),
    "tundra": (("coal", 3), ("iron", 3), ("mithril", 3), ("silver", 1)),
    "grassfield": (("coal", 4), ("iron", 5), ("gold", 1)),
    # Dungeons, by biome. Deeper than anything above ground, which is the point
    # of a dungeon.
    "grove": (("coal", 3), ("iron", 4), ("silver", 2)),
    "ruins": (("coal", 2), ("iron", 3), ("gold", 3), ("obsidian", 2)),
    "crypt": (("coal", 2), ("silver", 3), ("obsidian", 3), ("mithril", 2),
              ("diamond", 1), ("adamantine", 1)),
}

#: How many veins a place holds.
VEINS_PER_REGION = 4
VEINS_PER_DUNGEON_ROOM = 2

#: Units a vein gives up before it is spent, by the material's tier.
#:
#: Inverted deliberately: common ore comes out in handfuls, and a diamond vein
#: is one stone and a lot of walking. That is what keeps a tier-4 material from
#: being a tier-1 material with a bigger number on it.
YIELD_BY_TIER: dict[int, int] = {1: 4, 2: 3, 3: 2, 4: 1}


def yield_for(material_id: str) -> int:
    return YIELD_BY_TIER.get(get_material(material_id).tier, 1)


# --- training -----------------------------------------------------------------


def training_cost(attribute_ore: str, current_points: int) -> dict[str, int]:
    """What the next point in an attribute costs, in ore.

    Rising in the attribute itself, so the tenth point in one attribute costs
    more than the first point in another. Specialising is meant to be the
    expensive option -- that is what makes spreading a real alternative rather
    than the choice you make before you know better.

    Coal is on every bill, which is what stops a player mining one ore and
    ignoring the rest of the world.
    """
    material = get_material(attribute_ore)
    step = current_points + 1
    # Divided by tier, so a tier-4 ore is worth roughly four tier-1 ones. The
    # five attributes then cost about the same effort from different places,
    # instead of Might being unreachable because star-metal is rare.
    ore = max(1, (step + material.tier - 1) // material.tier)
    return {material.id: ore, "coal": max(1, (step + 1) // 2)}


# --- fitting ------------------------------------------------------------------

#: Forge slots a weapon has, by how far it has been worked at the bench.
#:
#: Tied to the upgrade tier so the bench's two jobs are one progression: paying
#: to sharpen a weapon is also what gives it somewhere to put an ingot. A
#: finished weapon holds three, which is the whole of the design space -- enough
#: for a combination to have a character, few enough that fitting one means not
#: fitting another.
SLOTS_BY_TIER: tuple[int, ...] = (1, 1, 2, 3)


def slots_for_tier(tier: int) -> int:
    return SLOTS_BY_TIER[max(0, min(tier, len(SLOTS_BY_TIER) - 1))]


@dataclass(frozen=True)
class ForgeBonuses:
    """What a weapon's fitted materials are worth, folded once."""
    damage_mult: float = 0.0
    cooldown_mult: float = 0.0
    knockback_mult: float = 0.0
    crit_chance: float = 0.0
    crit_multiplier: float = 0.0
    pierce: float = 0.0
    mana_cost_mult: float = 0.0
    steadfast: bool = False


#: The most a weapon may ignore, however it is fitted.
#:
#: Three obsidian would otherwise ignore every point of mitigation in the game
#: and turn the armoured enemies into the unarmoured ones.
MAX_PIERCE = 0.60


def forge_bonuses(fitted: list[str] | tuple[str, ...], family: str = "") -> ForgeBonuses:
    """Fold a weapon's fitted materials, respecting affinity.

    `family` is the weapon's own family. A material that spoils it contributes
    half of its upside and twice its downside -- which is how "wrong ore in the
    wrong weapon" becomes something the player can feel without the bench having
    to refuse the fitting outright. Being allowed to make a bad weapon is the
    reason making a good one means anything.
    """
    totals = {
        "damage_mult": 0.0, "cooldown_mult": 0.0, "knockback_mult": 0.0,
        "crit_chance": 0.0, "crit_multiplier": 0.0, "pierce": 0.0,
        "mana_cost_mult": 0.0,
    }
    steadfast = False
    for material_id in fitted:
        material = MATERIALS.get(material_id)
        if material is None or material.fuel:
            continue
        spoiled = bool(family) and family in material.spoils
        for key in totals:
            value = getattr(material, key)
            if spoiled:
                # "Upside" is whichever direction the material means well in.
                # Cooldown and mana cost are better when negative, so the good
                # direction is not the same sign for every field.
                good = value < 0 if key in ("cooldown_mult", "mana_cost_mult") else value > 0
                value = value * (0.5 if good else 2.0)
            totals[key] += value
        steadfast = steadfast or (material.steadfast and not spoiled)
    totals["pierce"] = min(MAX_PIERCE, max(0.0, totals["pierce"]))
    # A weapon can be made slow, but not unusable: at -0.9 a cooldown inverts
    # into a negative wait and `can_attack` never blocks again.
    totals["cooldown_mult"] = max(-0.6, totals["cooldown_mult"])
    totals["mana_cost_mult"] = max(-0.8, totals["mana_cost_mult"])
    return ForgeBonuses(**totals, steadfast=steadfast)


def describe_fitting(fitted: list[str] | tuple[str, ...], family: str = "") -> list[str]:
    """Human lines for the bench, one per fitted material."""
    out: list[str] = []
    for material_id in fitted:
        material = MATERIALS.get(material_id)
        if material is None:
            continue
        note = material.forge_note
        if family and family in material.spoils:
            note = f"{note} Wrong metal for this — it fights the weapon."
        elif family and family in material.favours:
            note = f"{note} Made for this."
        out.append(f"{material.name}: {note}")
    return out
