"""Villagers: vendors, the elder who carries the quest, and the hearth.

Everything here is authored data. No line of dialogue is generated at runtime,
and nothing an NPC says changes the simulation -- talking sets a quest flag at
most. Dialogue exists to make the village legible ("where do I go, and why"),
not to be a system of its own.

Each NPC keeps a small number of *states* and one short line set per state, so
the village visibly reacts to progress without needing a dialogue engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.weapons import get_weapon
from mirrorbound.game.inventory import CONSUMABLES, RELICS

# How close the player must stand to talk. Generous, because reaching an exact
# pixel is not the interesting part.
TALK_RADIUS = 96.0


@dataclass(frozen=True)
class ShopEntry:
    kind: str          # "weapon" | "consumable" | "relic"
    item_id: str
    price: int

    def to_dict(self) -> dict:
        if self.kind == "weapon":
            info = get_weapon(self.item_id).to_dict()
            name, description = info["name"], info.get("description", "")
        elif self.kind == "consumable":
            spec = CONSUMABLES[self.item_id]
            name, description = spec["name"], spec["description"]
        else:
            spec = RELICS[self.item_id]
            name, description = spec["name"], spec["description"]
        return {"kind": self.kind, "itemId": self.item_id, "price": self.price,
                "name": name, "description": description}


@dataclass(frozen=True)
class NpcDef:
    id: str
    name: str
    role: str                      # weaponsmith | apothecary | elder | hearth
    # Position as a fraction of the village's size, so one definition works at
    # any village dimensions.
    fx: float
    fy: float
    sprite: str = "villager"
    stock: tuple[ShopEntry, ...] = ()
    lines: dict[str, tuple[str, ...]] = field(default_factory=dict)

    def dialogue_for(self, flags: set[str], player_name: str, twin_name: str) -> tuple[str, ...]:
        """The best-matching authored line set for the current quest state.

        Later states win, so a village that has been rescued never falls back to
        its opening line. `{player}` and `{twin}` are the only substitutions --
        deliberately, so naming never needs a template engine.
        """
        chosen = self.lines.get("intro", ())
        for key in ("quest_active", "twin_rescued", "area_cleared"):
            if key in flags and key in self.lines:
                chosen = self.lines[key]
        return tuple(line.format(player=player_name, twin=twin_name) for line in chosen)


ELDER_MARA = NpcDef(
    id="elder_mara", name="Elder Mara", role="elder", fx=0.50, fy=0.36, sprite="npc_elder",
    lines={
        "intro": (
            "You have your mother's stubborn walk, {player}.",
            "The crypt under the wakewood has been breathing again. Three of ours went in.",
            "Only one thing came back, and it wasn't one of ours. Go and see.",
        ),
        "quest_active": (
            "The crypt is still open. Whatever waits down there is waiting for you.",
        ),
        "twin_rescued": (
            "So that is what came back with you.",
            "It moves like you do, {player}. A little behind, but learning.",
            "Name it, keep it close, and do not mistake it for a mirror.",
        ),
        "area_cleared": (
            "Ashen deep lies east now that the crypt is quiet.",
            "Take {twin}. Whatever is down there has been watching you both.",
        ),
    },
)

SMITH_OREN = NpcDef(
    id="smith_oren", name="Oren the Smith", role="weaponsmith", fx=0.26, fy=0.52, sprite="npc_smith",
    stock=(
        # The cheapest thing on the bench, and the only one you can afford
        # early. The player begins bare-handed, so a shop with no starter
        # weapon in it is a shop that cannot help you.
        ShopEntry("weapon", "iron_sword", 45),
        ShopEntry("weapon", "hunter_bow", 140),
        ShopEntry("weapon", "ember_staff", 190),
        ShopEntry("weapon", "frost_staff", 190),
        ShopEntry("relic", "wolf_fang", 260),
    ),
    lines={
        "intro": (
            "You came in with nothing. That happens more than you'd think.",
            "Take a blade off the bench. Everything else here only changes how the job feels.",
        ),
        "twin_rescued": (
            "Your shadow there picks things up off the floor. I've seen it.",
            "Buy two of something and it'll carry the spare.",
        ),
    },
)

APOTHECARY_SIV = NpcDef(
    id="apothecary_siv", name="Siv the Apothecary", role="apothecary", fx=0.74, fy=0.52, sprite="npc_apothecary",
    stock=(
        ShopEntry("consumable", "health_potion", 35),
        ShopEntry("consumable", "mana_potion", 30),
        ShopEntry("relic", "ember_heart", 260),
    ),
    lines={
        "intro": (
            "Red for blood, blue for the other thing.",
            "Drink standing still if you can. It takes a moment, and a moment is how people die.",
        ),
    },
)

HEARTH = NpcDef(
    id="hearth", name="The Hearth", role="hearth", fx=0.50, fy=0.70, sprite="hearth",
    lines={
        "intro": (
            "The fire is banked and steady. Rest here and the road stops mattering for a while.",
        ),
    },
)

VILLAGE_NPCS: dict[str, tuple[NpcDef, ...]] = {
    "hollow_reach": (ELDER_MARA, SMITH_OREN, APOTHECARY_SIV, HEARTH),
    "emberfall": (SMITH_OREN, APOTHECARY_SIV, HEARTH),
}


@dataclass
class Npc:
    """A villager placed in a room."""
    definition: NpcDef
    x: float
    y: float

    @property
    def id(self) -> str:
        return self.definition.id

    def to_dict(self, flags: set[str], player_name: str, twin_name: str) -> dict:
        return {
            "id": self.definition.id,
            "name": self.definition.name,
            "role": self.definition.role,
            "sprite": self.definition.sprite,
            "position": {"x": round(self.x, 1), "y": round(self.y, 1)},
            "radius": TALK_RADIUS,
            "lines": list(self.definition.dialogue_for(flags, player_name, twin_name)),
            "stock": [e.to_dict() for e in self.definition.stock],
        }


__all__ = ["Npc", "NpcDef", "ShopEntry", "VILLAGE_NPCS", "TALK_RADIUS"]
