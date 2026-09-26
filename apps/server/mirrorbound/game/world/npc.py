"""The people you can talk to: vendors, the elder, the hearth, and the rest.

Everything here is authored data. No line is generated at runtime, and nothing an
NPC says changes the simulation -- talking sets a quest flag at most. Dialogue
exists to make the world legible ("where do I go, why, and what happened here"),
not to be a system of its own.

Three things the v1.1 expansion needed from this module:

**Dialogue that tracks progress.** A line set is chosen by the run's flags, and
the flags now include one per area completed, so the elder can say something
different after the crypt than after the Warden. States are checked in a fixed
order and the latest match wins, which keeps "what does this person say now" a
question with one answer.

**Merchants with an identity** (§19). Oren and Siv used to be the same two
objects placed in both villages, so the second settlement sold exactly what the
first did and said the same words. Emberfall is down in a basin under a mountain
pass and stocks what that implies; Hollow Reach is a farming village and stocks
what a farming village has.

**People outside a settlement.** Kell keeps the ferry, and the ferry is the
campaign's one gate -- so he stands on his jetty in the Drowned Flats rather than
in a village, and `REGION_NPCS` is how someone is placed on open ground.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.weapons import get_weapon
from mirrorbound.game.inventory import CONSUMABLES, RELICS

# How close the player must stand to talk. Generous, because reaching an exact
# pixel is not the interesting part.
TALK_RADIUS = 96.0

#: Dialogue states, from the most general to the most specific.
#:
#: `dialogue_for` walks this in order and keeps the last one that both the run
#: and the speaker have, so an NPC only needs to write the lines that change.
#: Adding a state means adding it here; the order *is* the priority.
DIALOGUE_STATES: tuple[str, ...] = (
    "intro",
    "quest_active",
    "twin_rescued",
    "cleared_wakewood_crypt",
    "cleared_ashen_deep",
    "twin_taken",
    "cleared_mirror_sanctum",
)


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
    role: str                      # weaponsmith | apothecary | elder | hearth | folk | ferryman
    # Position as a fraction of the place they stand in, so one definition works
    # at any size. In a settlement this is read against the settlement; in a
    # region it is read against the whole map.
    fx: float
    fy: float
    sprite: str = "villager"
    stock: tuple[ShopEntry, ...] = ()
    lines: dict[str, tuple[str, ...]] = field(default_factory=dict)

    def dialogue_for(self, flags: set[str], player_name: str, twin_name: str) -> tuple[str, ...]:
        """The best-matching authored line set for the current state of the run.

        Later states win, so somebody who has seen the twin never falls back to
        their opening. `{player}` and `{twin}` are the only substitutions --
        deliberately, so naming never needs a template engine.
        """
        chosen = self.lines.get("intro", ())
        for key in DIALOGUE_STATES:
            if key in flags and key in self.lines:
                chosen = self.lines[key]
        return tuple(line.format(player=player_name, twin=twin_name) for line in chosen)


# --- Hollow Reach: a farming village that has learned to sleep lightly --------

ELDER_MARA = NpcDef(
    id="elder_mara", name="Elder Mara", role="elder", fx=0.50, fy=0.36, sprite="npc_elder",
    lines={
        "intro": (
            "You have your mother's stubborn walk, {player}.",
            "The crypt under the wakewood has been breathing again. Three of ours went in.",
            "Only one thing came back, and it wasn't one of ours. Go and see.",
            "North over the Rootbridge, and keep to the path. The trees there are older than the village.",
        ),
        "quest_active": (
            "The crypt is still open. Whatever waits down there is waiting for you.",
            "North, over the Rootbridge. You cannot miss the stair; the roots grew around it.",
        ),
        "twin_rescued": (
            "So that is what came back with you.",
            "It moves like you do, {player}. A little behind, but learning.",
            "Name it, keep it close, and do not mistake it for a mirror.",
        ),
        "cleared_wakewood_crypt": (
            "The wood is quiet. I had stopped expecting to hear that.",
            "Kell will take you across the flats now -- he would not, before, and I do not blame him.",
            "Emberfall lies east of the water. They will know more than we do. They always have.",
        ),
        "cleared_ashen_deep": (
            "The Warden is down. That thing kept the road before any of us were born.",
            "Whatever it was keeping the road *from*, {player}, it is still up there.",
        ),
    },
)

SMITH_OREN = NpcDef(
    id="smith_oren", name="Oren the Smith", role="weaponsmith", fx=0.26, fy=0.52, sprite="npc_smith",
    # A village smith. Everything here is something a farm needs or a hunter
    # carries; the serious gear is in Emberfall, which is what makes the walk
    # east worth taking.
    stock=(
        ShopEntry("weapon", "iron_sword", 45),
        ShopEntry("weapon", "hunter_bow", 140),
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
        "cleared_wakewood_crypt": (
            "I shoe horses and I mend gates. What you want now, I cannot make.",
            "Hask, in Emberfall. Works the old forge under the terraces. Tell him I sent you and he'll charge you the same anyway.",
        ),
    },
)

APOTHECARY_SIV = NpcDef(
    id="apothecary_siv", name="Siv the Apothecary", role="apothecary", fx=0.74, fy=0.52,
    sprite="npc_apothecary",
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
        "cleared_wakewood_crypt": (
            "You went down there and came back up. That is two more than the last three.",
            "Take more red than you think. The flats are worse than the wood.",
        ),
    },
)

FARMER_BRAM = NpcDef(
    # The lore voice of the opening. He is the reason the player understands
    # what the wood is before they walk into it, and §6 wants that said by a
    # person met on the way rather than dumped in a scroll.
    id="farmer_bram", name="Bram", role="folk", fx=0.30, fy=0.78, sprite="villager",
    lines={
        "intro": (
            "You'll be going north, then. Everyone does, eventually.",
            "My grandfather ploughed to the treeline and no further. Said the wakewood was owed something.",
            "Nobody remembers what. That's the trouble with being owed things for long enough.",
        ),
        "quest_active": (
            "Mind the roots on the bridge. They shift.",
            "And if the trees go quiet -- properly quiet, no birds -- turn round.",
        ),
        "twin_rescued": (
            "That's not a dog.",
            "...No. No, I can see it isn't.",
        ),
        "cleared_wakewood_crypt": (
            "I took the cart to the treeline this morning. First time in my life.",
            "Still felt owed something. But it let me pass.",
        ),
    },
)

WATCH_WREN = NpcDef(
    # Directions, which §6 asks to be given by people rather than by a map
    # marker. She names both crossings out of the vale, so a player who does not
    # know where to go can be told.
    id="watch_wren", name="Wren of the Watch", role="folk", fx=0.52, fy=0.88, sprite="villager",
    lines={
        "intro": (
            "Two ways out of the vale, and I'd take neither if it were up to me.",
            "North is the Rootbridge, into the wakewood. That's where the elder will send you.",
            "East is Stonecount. Follow it far enough and you reach the water, and past that, Emberfall.",
        ),
        "quest_active": (
            "North. The Rootbridge. Planks over the stream and then it's all trees.",
        ),
        "cleared_wakewood_crypt": (
            "East, then. Over Stonecount and across the moor.",
            "The causeway past that is still standing, more or less. Kell has the boat at the far end.",
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


# --- Emberfall: built in the ribs of something older --------------------------

SMITH_HASK = NpcDef(
    # The serious bench, and the reason the walk east pays. A mountain
    # settlement under a pass: staves, and the gear you take underground.
    id="smith_hask", name="Hask the Ironmonger", role="weaponsmith", fx=0.28, fy=0.50,
    sprite="npc_smith",
    stock=(
        ShopEntry("weapon", "ember_staff", 190),
        ShopEntry("weapon", "frost_staff", 190),
        ShopEntry("weapon", "hunter_bow", 130),
        # The two that only a mountain forge makes: reach, and a lance that
        # wants things in a line. Priced above the staves, because by the time
        # you can afford one you have been paid by a dungeon.
        ShopEntry("weapon", "warden_pike", 280),
        ShopEntry("weapon", "shard_lance", 300),
        ShopEntry("relic", "wolf_fang", 240),
        ShopEntry("relic", "mirror_eye", 320),
    ),
    lines={
        "intro": (
            "Oren sent you. He always does, and he never sends coin with them.",
            "Staves, on the left. They don't shoot -- the fire's in what they let you cast.",
            "Bring me anything you already carry and I'll work it up. Gold, shards, and "
            "essence for the last of it. Third time on the bench and it stops being the "
            "weapon you brought me.",
            "Everything here was pulled out of the terraces. Somebody built better than us, once.",
        ),
        "cleared_ashen_deep": (
            "You went past the Warden. Nobody goes past the Warden.",
            "Take the eye. If that thing up there is going to wear your face, I'd want mine watching back.",
        ),
    },
)

APOTHECARY_NESSA = NpcDef(
    id="apothecary_nessa", name="Nessa", role="apothecary", fx=0.72, fy=0.50,
    sprite="npc_apothecary",
    stock=(
        ShopEntry("consumable", "health_potion", 32),
        ShopEntry("consumable", "mana_potion", 26),
        ShopEntry("relic", "ember_heart", 240),
    ),
    lines={
        "intro": (
            "Cheaper than Siv, and better. Don't tell her I said the second part.",
            "The ash gets into everything down here. It's good for the mixing and bad for the lungs.",
        ),
        "cleared_ashen_deep": (
            "You smell like the Deep. Sit a moment before you go up the Cut.",
            "Whatever is in the Sanctum has been quiet for a long time. Quiet things wait for a reason.",
        ),
    },
)

KEEPER_ODD = NpcDef(
    # Emberfall's lore voice, and the one who says what the Mirror phenomenon
    # is understood to be -- which §15 wants revealed progressively and by
    # someone with a reason to know.
    id="keeper_odd", name="Odd the Keeper", role="folk", fx=0.50, fy=0.28, sprite="villager",
    lines={
        "intro": (
            "You're standing in a ribcage. Did they tell you that in the vale?",
            "Emberfall was built inside something. We don't dig down, and we don't ask what the ribs belonged to.",
            "Up the Cut there's a sanctum full of glass. That we do ask about. Nobody has an answer.",
        ),
        "twin_rescued": (
            "It follows you at four paces and it copies how you stand.",
            "The old writing here has a word for that. It does not translate to 'companion'.",
        ),
        "cleared_ashen_deep": (
            "The Warden guarded the way up, not the way down. People always get that backwards.",
            "Whatever it kept out of the Sanctum, {player} -- it has been in there alone a long time now.",
        ),
    },
)

EMBERFALL_HEARTH = NpcDef(
    id="hearth", name="The Hearth", role="hearth", fx=0.50, fy=0.70, sprite="hearth",
    lines={
        "intro": (
            "Coal, not wood. It burns low and it burns all night, and nobody here lets it go out.",
        ),
    },
)


# --- out on the road ----------------------------------------------------------

FERRYMAN_KELL = NpcDef(
    # The campaign's one gate, with a face on it. §22 asks for barriers that make
    # sense inside the world; this is a man who will not push off, and who tells
    # you exactly what would change his mind.
    id="ferryman_kell", name="Kell", role="ferryman", fx=0.92, fy=0.50, sprite="villager",
    lines={
        "intro": (
            "Boat's tied. Don't ask.",
            "Something under the wakewood has been waking up, and what wakes there comes downstream.",
            "I've pulled two things out of this water this month. Neither was a fish.",
            "Settle the wood and I'll row you across myself. Until then, you can stand there.",
        ),
        "cleared_wakewood_crypt": (
            "You settled it, then. I felt the water change.",
            "Get in. Emberfall's an hour east if I don't talk, and I will talk.",
        ),
    },
)


#: Who stands in each settlement, by settlement id.
VILLAGE_NPCS: dict[str, tuple[NpcDef, ...]] = {
    "hollow_reach": (ELDER_MARA, SMITH_OREN, APOTHECARY_SIV, HEARTH, FARMER_BRAM, WATCH_WREN),
    "emberfall": (SMITH_HASK, APOTHECARY_NESSA, EMBERFALL_HEARTH, KEEPER_ODD),
}

#: Who stands out in a region, by area id, positioned against the whole map.
#:
#: Not everyone lives in a village. Kell keeps a jetty on the far side of the
#: flats because that is where the boat is, and the thing he is guarding is the
#: campaign's only gate.
REGION_NPCS: dict[str, tuple[NpcDef, ...]] = {
    "drowned_flats": (FERRYMAN_KELL,),
}


@dataclass
class Npc:
    """A person placed in a room."""
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


__all__ = ["Npc", "NpcDef", "ShopEntry", "VILLAGE_NPCS", "REGION_NPCS", "TALK_RADIUS",
           "DIALOGUE_STATES"]
