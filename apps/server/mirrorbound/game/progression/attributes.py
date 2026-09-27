"""The five attributes: the numeric half of the character.

The skill tree is the *behaviour* half — every node above tier 1 turns
something on that was not there before. That was deliberate, and it left the
tree with nowhere to put an honest number. Attributes are that place.

    XP      -> levels -> skill points -> the tree (what you can do)
    MINING  -> materials -> attribute points -> attributes (how well you do it)

The two are not parallel systems. An attribute **gates** the branch it belongs
to: one attribute per branch, and the deep nodes will not unlock until the
matching attribute is high enough. So the tree cannot be finished by levelling
alone — the world has to be dug up as well — and a material is not a fourth
currency looking for a use. It is how a tier-4 node becomes reachable.

That is also why the numbers here are unashamedly percentages. `skills.py`
argues at length against a tree of small multipliers, and it is right about a
tree. But a character does need a scalar spine: something that makes level 14
feel different from level 4 in the same fight with the same buttons. Keeping
every multiplier *here* is what lets every node *there* be a behaviour.

Nothing in this module reads game state. It is a table plus arithmetic, so the
combat and movement systems can ask it questions on a tick without paying for
an object graph.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: How high one attribute may be trained.
#:
#: A ceiling rather than an open curve, because the gates below are the point of
#: attributes and a gate you can clear twice over is not a gate. 20 is a little
#: over what a full campaign can pay for, so the cap is a horizon and not a
#: wall the player hits halfway through.
MAX_ATTRIBUTE = 20

#: What a level hands over, beyond the skill point it already gave.
#:
#: One, so levelling still moves the numeric half — but only just. Nineteen
#: level-ups pay for 19 points and the five tier-3 gates alone want 25, which is
#: the arithmetic that makes mining part of progression rather than a side
#: activity with a shop attached.
POINTS_PER_LEVEL = 1


@dataclass(frozen=True)
class AttributeDef:
    id: str
    name: str
    #: The skill branch this attribute gates. One each, no branch shared.
    branch: str
    description: str
    #: The material that trains it. See `materials.py` — one ore per attribute,
    #: at deliberately different depths, so the five are not all bought in the
    #: same place.
    ore: str
    # --- what a point is worth ------------------------------------------------
    max_health: float = 0.0
    max_mana: float = 0.0
    weapon_damage_mult: float = 0.0
    spell_damage_mult: float = 0.0
    knockback_mult: float = 0.0
    attack_speed_mult: float = 0.0
    crit_chance: float = 0.0
    #: Fraction of the hunger drain removed per point (see `survival.py`).
    hunger_resist: float = 0.0
    twin_damage_mult: float = 0.0
    twin_learning_mult: float = 0.0


ATTRIBUTES: dict[str, AttributeDef] = {
    a.id: a
    for a in (
        AttributeDef(
            "vigour", "Vigour", "SURVIVAL",
            "Flesh and stubbornness. More health, and hunger takes longer to bite.",
            ore="iron", max_health=8.0, hunger_resist=0.04),
        AttributeDef(
            "might", "Might", "COMBAT",
            "What a swing weighs. Harder hits and more of a shove behind them.",
            ore="adamantine", weapon_damage_mult=0.03, knockback_mult=0.04),
        AttributeDef(
            "finesse", "Finesse", "MOBILITY",
            "Speed of hand. Faster swings and a better chance of finding the gap.",
            ore="mithril", attack_speed_mult=0.015, crit_chance=0.008),
        AttributeDef(
            "focus", "Focus", "MAGIC",
            "How much you can hold. Deeper mana and stronger spells.",
            ore="gold", max_mana=6.0, spell_damage_mult=0.03),
        AttributeDef(
            "bond", "Bond", "MIRROR",
            "What passes between the two of you. Your twin hits harder and reads you faster.",
            ore="silver", twin_damage_mult=0.03, twin_learning_mult=0.02),
    )
}

#: Branch -> the attribute that gates it. Derived, so the two can never drift.
BRANCH_ATTRIBUTE: dict[str, str] = {a.branch: a.id for a in ATTRIBUTES.values()}

#: Attribute required to unlock a node, by the node's tier.
#:
#: Tiers 1 and 2 are ungated: the first two points in a branch are how a player
#: finds out what the branch is, and making them wait on an attribute would gate
#: the tutorial. The gate lands where the tree starts handing out behaviours.
TIER_GATE: dict[int, int] = {1: 0, 2: 0, 3: 5, 4: 10}


def gate_for(tier: int) -> int:
    return TIER_GATE.get(tier, 0)


@dataclass
class Attributes:
    """One character's attribute spread.

    A plain counter per attribute. Everything derived is computed on demand by
    `AttributeBonuses` rather than cached, because the values move only when the
    player spends a point and the arithmetic is five multiplications.
    """
    points: dict[str, int] = field(default_factory=lambda: {a: 0 for a in ATTRIBUTES})
    #: Unspent points, from levels and from the trainer.
    unspent: int = 0

    def get(self, attribute: str) -> int:
        return self.points.get(attribute, 0)

    def at_cap(self, attribute: str) -> bool:
        return self.get(attribute) >= MAX_ATTRIBUTE

    def can_spend(self, attribute: str) -> tuple[bool, str]:
        if attribute not in ATTRIBUTES:
            return False, "unknown attribute"
        if self.unspent <= 0:
            return False, "no points to spend"
        if self.at_cap(attribute):
            return False, "already at maximum"
        return True, "ok"

    def spend(self, attribute: str) -> tuple[bool, str]:
        ok, reason = self.can_spend(attribute)
        if not ok:
            return False, reason
        self.points[attribute] = self.get(attribute) + 1
        self.unspent -= 1
        return True, "ok"

    def grant(self, count: int = 1) -> None:
        self.unspent = max(0, self.unspent + count)

    def refund_all(self) -> int:
        """Hand every spent point back. Returns how many moved.

        The same reasoning as `Player.respec`: the tree's gates read these, so
        refunding one attribute at a time could strand an unlocked tier-4 node
        below its own requirement. Clearing the whole spread is the only refund
        that cannot produce a state the rules say is impossible.
        """
        spent = sum(self.points.values())
        if spent:
            self.points = {a: 0 for a in ATTRIBUTES}
            self.unspent += spent
        return spent

    # --- serialisation ---------------------------------------------------------

    def to_save(self) -> dict:
        return {"points": {k: v for k, v in self.points.items() if v}, "unspent": self.unspent}

    @classmethod
    def from_save(cls, data: dict | None) -> "Attributes":
        out = cls()
        if not isinstance(data, dict):
            return out
        stored = data.get("points")
        if isinstance(stored, dict):
            for key, value in stored.items():
                if key in ATTRIBUTES:
                    try:
                        out.points[key] = max(0, min(MAX_ATTRIBUTE, int(value)))
                    except (TypeError, ValueError):
                        continue
        try:
            out.unspent = max(0, int(data.get("unspent", 0)))
        except (TypeError, ValueError):
            out.unspent = 0
        return out

    def to_dict(self) -> list[dict]:
        return [
            {
                "id": a.id,
                "name": a.name,
                "branch": a.branch,
                "description": a.description,
                "ore": a.ore,
                "points": self.get(a.id),
                "max": MAX_ATTRIBUTE,
            }
            for a in ATTRIBUTES.values()
        ]


@dataclass(frozen=True)
class AttributeBonuses:
    """Everything a spread is worth, folded once.

    Shaped like `StatModifiers` on purpose: the player's derived stats add the
    two together, and a reader comparing them can see which half of the
    character each number came from.
    """
    max_health: float = 0.0
    max_mana: float = 0.0
    weapon_damage_mult: float = 0.0
    spell_damage_mult: float = 0.0
    knockback_mult: float = 0.0
    attack_speed_mult: float = 0.0
    crit_chance: float = 0.0
    hunger_resist: float = 0.0
    twin_damage_mult: float = 0.0
    twin_learning_mult: float = 0.0


def bonuses_for(attributes: Attributes) -> AttributeBonuses:
    totals = {
        "max_health": 0.0, "max_mana": 0.0, "weapon_damage_mult": 0.0,
        "spell_damage_mult": 0.0, "knockback_mult": 0.0, "attack_speed_mult": 0.0,
        "crit_chance": 0.0, "hunger_resist": 0.0, "twin_damage_mult": 0.0,
        "twin_learning_mult": 0.0,
    }
    for attribute, points in attributes.points.items():
        definition = ATTRIBUTES.get(attribute)
        if definition is None or points <= 0:
            continue
        for key in totals:
            totals[key] += getattr(definition, key) * points
    # Hunger resistance is a fraction removed, so it must stay short of 1.0 --
    # 20 Vigour would otherwise stop hunger entirely and quietly delete the
    # system for anyone who specialised into it.
    totals["hunger_resist"] = min(0.75, totals["hunger_resist"])
    return AttributeBonuses(**totals)
