"""The campaign: one continuous authored world, and the state of a run through it.

An authored world rather than a procedural continent. The rule has not changed --
a compact authored world beats a big generated one -- but v1.1 changes what
"compact" has to deliver: you now *walk* between the villages instead of stepping
through a portal, and the ground between them is where the story lives.

The world is a graph of areas joined at their edges. Walking off the north side
of one puts you at the south side of the next, with no menu and nothing to
confirm, which is what makes it read as one place:

    the_proving                                        (sandbox, off to one side)

    wakewood_edge   region    the wood, and the crypt's mouth in it
         |  south
    hollow_reach    village   safe hub, vendors, the elder who starts the quest
         |  east
    greenmoor       region    farmland going back to meadow; the long open walk
         |  east
    ember_road      region    the old road between the two settlements
         |  east
    emberfall       village   the second hub; proof that progress reaches the world
         |  north
    kiln_terraces   region    the pass up, and the two descents at the top of it

    wakewood_crypt  dungeon   the tutorial descent; the twin is found here
    ashen_deep      dungeon   the real dungeon, with a guardian at the bottom
    mirror_sanctum  dungeon   the Mirror

A **region** is an ordinary `Room`, exactly as a village is. That is the whole
trick: movement, collision, decor, the floor pipeline and the renderer treat a
stretch of wilderness the same way they already treat Hollow Reach, so a
continuous world costs authored content rather than an engine rewrite. Dungeons
keep their portals, because a descent into the earth is a threshold and should
read as one.

Area ids are stable and are baked into room ids, so a heatmap or a saved
checkpoint from one run still means the same thing in the next.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.dungeon.templates import RoomType
from mirrorbound.game.world.quest import QuestLog


#: Which way you left an area, and therefore which side of the next one you
#: arrive on. Written once here so nothing has to spell the pairs out again.
OPPOSITE: dict[str, str] = {"north": "south", "south": "north", "east": "west", "west": "east"}



@dataclass(frozen=True)
class AreaDef:
    id: str
    name: str
    kind: str                      # "region" | "dungeon" | "sandbox"
    biome: str
    subtitle: str
    # Dungeons only.
    sequence: tuple[RoomType, ...] = ()
    # Area that must be completed before this one opens.
    requires: str = ""
    # Where this area sits on the world map, in map units (0-1 on both axes).
    map_x: float = 0.5
    map_y: float = 0.5
    # Enemy scaling for this area; multiplies health and damage (rule: region scaling).
    difficulty: float = 1.0
    # Gold and a quest seal handed out the first time the area is completed.
    completion_gold: int = 0
    completion_seal: str = ""
    # The dungeon the game teaches fighting in. Its first combat room is the
    # authored teaching one rather than a roll, because that fight is taken
    # alone, at level one, before the twin has been found.
    tutorial: bool = False
    #: Which of the three archetypes a dungeon is (§8). Decides how it plays,
    #: not merely what lives in it.
    dungeon_kind: str = "combat"
    #: Main-chain rooms with an optional side room hanging off them (§10).
    branches: tuple[int, ...] = ()

    # --- the open world ------------------------------------------------------
    #: The settlement standing in this region, if any.
    #:
    #: A village is not an area of its own any more. It is a *place inside* a
    #: region: you come over the ridge, see the rooftops, and walk in without a
    #: transition, because the huts and the fields are on the same map. That is
    #: the difference between a world and a set of rooms joined by portals.
    settlement: str = ""
    #: Where the settlement sits in the region, as 0-1, and how far it reaches.
    settlement_at: tuple[float, float] = (0.5, 0.5)
    settlement_radius: float = 520.0
    #: Dungeon mouths standing in this area, as (area id, fx, fy) in 0-1 units.
    #:
    #: A descent keeps its portal: going underground is a threshold, and the
    #: brief only asks that portals stop being what makes the world *connected*.
    descents: tuple[tuple[str, float, float], ...] = ()
    #: How this area's ground is dressed.
    terrain: str = ""
    #: Size in world units. 0 means "use the builder's default".
    width: int = 0
    height: int = 0


@dataclass(frozen=True)
class Crossing:
    """The one way from one region into the next, and a place in its own right.

    Regions are not joined by an invisible seam along a whole side. They are
    joined at a *thing you find*: a bridge over a river, a cut through the rock,
    a causeway over the shallows, a boatman who will take you across. That is
    what makes arriving somewhere new feel like arriving -- you cross something,
    and the crossing has a name you can be told by an NPC and read on the map.

    Authored once, from one end, and both ends are derived (`crossings_of`). A
    one-way crossing is the worst kind of world bug -- you get somewhere and the
    way back is not there -- and deriving it makes that unrepresentable rather
    than merely tested for.
    """
    name: str
    #: bridge | pass | causeway | ferry. Decides how it is built and drawn.
    kind: str
    a: str                         # area id on one side
    a_side: str                    # which of a's sides it sits on
    b: str                         # area id on the other
    #: Where along each side the crossing sits, as 0-1. Authored per end because
    #: two regions of different sizes do not line up by accident.
    a_along: float = 0.5
    b_along: float = 0.5
    #: How wide the way through is, in world units. Narrow: a crossing is a
    #: bottleneck, and a bottleneck is what makes it a place.
    width: float = 190.0
    #: An area that must be completed before this crossing opens.
    #:
    #: The campaign gate, put somewhere the player can walk up to and be told
    #: about, rather than left as a refusal when they click a map. §22 asks for
    #: barriers that make sense inside the world; a ferryman who will not take
    #: you yet is a barrier with a reason and a face.
    requires: str = ""
    #: What the world says when it is shut. Spoken by the crossing itself.
    blocked_line: str = ""


# --- the regions -------------------------------------------------------------
#
# Six stretches of ground, walked west to east and then up. Two of them have a
# settlement in them; the rest are the country between, and each one is a
# different kind of walk (see `region.py` for what a terrain is made of).

HOLLOWREACH_VALE = AreaDef(
    id="hollowreach_vale", name="Hollowreach Vale", kind="region", biome="grove",
    subtitle="A village that has learned to sleep lightly, and the vale around it.",
    terrain="grassland", map_x=0.13, map_y=0.74,
    width=2560, height=1792,
    # Hollow Reach itself, in the south of its own vale. Everything the village
    # had -- the elder, the smith, the apothecary, the hearth -- stands here.
    settlement="hollow_reach", settlement_at=(0.42, 0.70), settlement_radius=560.0,
)

WAKEWOOD = AreaDef(
    id="wakewood", name="The Wakewood", kind="region", biome="grove",
    subtitle="Old trees that were never felled, and a stair going down among the roots.",
    terrain="forest", map_x=0.16, map_y=0.52,
    width=2240, height=1600,
    descents=(("wakewood_crypt", 0.54, 0.22),),
)

GREENMOOR = AreaDef(
    id="greenmoor", name="Greenmoor", kind="region", biome="grove",
    subtitle="Fields that stopped being fields, and nobody came back for them.",
    terrain="grassland", map_x=0.36, map_y=0.78,
    width=2560, height=1600,
    descents=(("stonecount_barrow", 0.24, 0.76),),
)

DROWNED_FLATS = AreaDef(
    id="drowned_flats", name="The Drowned Flats", kind="region", biome="ruins",
    subtitle="Shallow water over a road, and the tops of walls still showing.",
    terrain="marsh", map_x=0.52, map_y=0.72,
    width=2560, height=1408,
    difficulty=1.15,
)

EMBERFALL_BASIN = AreaDef(
    id="emberfall_basin", name="Emberfall Basin", kind="region", biome="ruins",
    subtitle="Built in the ribs of something older, down in the bowl of it.",
    terrain="road", map_x=0.70, map_y=0.66,
    width=2560, height=1792,
    settlement="emberfall", settlement_at=(0.56, 0.62), settlement_radius=560.0,
    descents=(("glasswork", 0.16, 0.20),),
    difficulty=1.15,
)

KILN_TERRACES = AreaDef(
    id="kiln_terraces", name="The Kiln Terraces", kind="region", biome="ruins",
    subtitle="Cut steps, fired brick, and two ways down into the dark.",
    terrain="pass", map_x=0.86, map_y=0.44,
    width=2240, height=1792,
    descents=(("ashen_deep", 0.30, 0.22), ("mirror_sanctum", 0.74, 0.14)),
    difficulty=1.25,
)

# --- the descents ------------------------------------------------------------

WAKEWOOD_CRYPT = AreaDef(
    id="wakewood_crypt", name="Wakewood Crypt", kind="dungeon", biome="grove",
    subtitle="Something under the wakewood is breathing again.",
    sequence=(RoomType.ENTRANCE, RoomType.COMBAT, RoomType.EXPLORATION, RoomType.TREASURE, RoomType.ELITE),
    requires="", map_x=0.20, map_y=0.38, difficulty=1.0,
    completion_gold=120, completion_seal="seal_of_waking", tutorial=True,
    dungeon_kind="combat", branches=(3,),
)

STONECOUNT_BARROW = AreaDef(
    # The puzzle archetype. Almost nothing to fight and three rooms that will
    # not let you past until you have worked out what opens them -- the plates
    # are behind the standing water and the collapsed stone, so the room's shape
    # is the problem. Where the Stonecount's history is kept.
    id="stonecount_barrow", name="The Stonecount Barrow", kind="dungeon", biome="crypt",
    subtitle="They counted the ones who did not come back, and then they stopped.",
    dungeon_kind="puzzle",
    sequence=(RoomType.ENTRANCE, RoomType.PUZZLE, RoomType.PUZZLE, RoomType.TREASURE,
              RoomType.PUZZLE, RoomType.ELITE),
    # One branch early, so a keyed door later in the barrow has somewhere its
    # key can legitimately be. The generator enforces that too, but a dungeon
    # whose authoring already reads correctly is one less thing being rescued.
    branches=(1, 4),
    requires="", map_x=0.32, map_y=0.90, difficulty=1.1,
    completion_gold=180, completion_seal="seal_of_the_count",
)

GLASSWORK = AreaDef(
    # The mixed archetype. Fights that are also locks: the shardlight halls hold
    # their doors on plates at opposite ends of a room with something in the
    # middle of it, so neither clearing nor solving is enough by itself.
    id="glasswork", name="The Glasswork", kind="dungeon", biome="crypt",
    subtitle="They fired something here that was not brick.",
    dungeon_kind="mirror",
    sequence=(RoomType.ENTRANCE, RoomType.PUZZLE, RoomType.COMBAT, RoomType.PUZZLE,
              RoomType.TREASURE, RoomType.ELITE),
    branches=(3,),
    requires="wakewood_crypt", map_x=0.78, map_y=0.58, difficulty=1.3,
    completion_gold=240, completion_seal="seal_of_glass",
)

ASHEN_DEEP = AreaDef(
    id="ashen_deep", name="The Ashen Deep", kind="dungeon", biome="ruins",
    subtitle="The road down, and the warden that keeps it.",
    dungeon_kind="combat", branches=(2,),
    sequence=(RoomType.ENTRANCE, RoomType.COMBAT, RoomType.TREASURE, RoomType.COMBAT,
              RoomType.EXPLORATION, RoomType.GUARDIAN),
    requires="wakewood_crypt", map_x=0.90, map_y=0.32, difficulty=1.35,
    completion_gold=260, completion_seal="seal_of_ash",
)

MIRROR_SANCTUM = AreaDef(
    id="mirror_sanctum", name="The Mirror Sanctum", kind="dungeon", biome="crypt",
    subtitle="It has been watching you the whole way here.",
    dungeon_kind="mirror",
    sequence=(RoomType.ENTRANCE, RoomType.BOSS),
    requires="ashen_deep", map_x=0.95, map_y=0.14, difficulty=1.5,
    completion_gold=0, completion_seal="seal_of_the_mirror",
)

#: A flat, empty room to test things in.
#:
#: Not part of the campaign: nothing gates it, nothing it contains counts, and
#: it is reached from the map like anywhere else so that testing a weapon or a
#: boss does not mean playing to the place that has one. `kind="sandbox"` keeps
#: it out of the region/dungeon logic entirely -- it has no NPCs to talk to,
#: no rooms to clear and no completion to award.
THE_PROVING = AreaDef(
    id="the_proving", name="The Proving", kind="sandbox", biome="sandbox",
    subtitle="Nothing here is real. Nothing here counts.",
    map_x=0.06, map_y=0.12,
)

AREAS: dict[str, AreaDef] = {
    a.id: a for a in (HOLLOWREACH_VALE, WAKEWOOD, GREENMOOR, DROWNED_FLATS,
                      EMBERFALL_BASIN, KILN_TERRACES,
                      WAKEWOOD_CRYPT, STONECOUNT_BARROW, GLASSWORK, ASHEN_DEEP,
                      MIRROR_SANCTUM, THE_PROVING)
}

#: Areas you can walk across, as opposed to what is under them.
OVERWORLD_KINDS: frozenset[str] = frozenset({"region"})


# --- the crossings -----------------------------------------------------------
#
# Five, one of each kind the world knows how to build, each where its kind makes
# sense: a plank bridge into the wood, a stone bridge over the river east, a
# causeway over the flood, a boatman at the far side of it, and a cut through
# the rock up to the terraces.
#
# The campaign's one gate is the ferryman. Emberfall used to be locked behind
# "Wakewood Crypt first" as a refusal when you clicked the map; now it is a man
# with a boat who will not push off until the thing under the wood is quiet.

CROSSINGS: tuple[Crossing, ...] = (
    Crossing(
        name="The Rootbridge", kind="bridge",
        a="hollowreach_vale", a_side="north", b="wakewood",
        a_along=0.34, b_along=0.40, width=170.0,
    ),
    Crossing(
        name="Stonecount Bridge", kind="bridge",
        a="hollowreach_vale", a_side="east", b="greenmoor",
        a_along=0.58, b_along=0.55, width=210.0,
    ),
    Crossing(
        name="The Long Causeway", kind="causeway",
        a="greenmoor", a_side="east", b="drowned_flats",
        a_along=0.46, b_along=0.50, width=200.0,
    ),
    Crossing(
        name="Kell's Crossing", kind="ferry",
        a="drowned_flats", a_side="east", b="emberfall_basin",
        a_along=0.52, b_along=0.44, width=200.0,
        requires="wakewood_crypt",
        blocked_line="Kell keeps the boat tied. Not while the wood is still breathing.",
    ),
    Crossing(
        name="The Cut", kind="pass",
        a="emberfall_basin", a_side="north", b="kiln_terraces",
        a_along=0.72, b_along=0.50, width=180.0,
    ),
)


def crossings_of(area_id: str) -> list[tuple[str, float, str, Crossing]]:
    """Every crossing out of an area, as (side, along, other area, crossing).

    Both ends come out of one authored record, so a crossing can never lead
    somewhere that does not lead back.
    """
    out: list[tuple[str, float, str, Crossing]] = []
    for crossing in CROSSINGS:
        if crossing.a == area_id:
            out.append((crossing.a_side, crossing.a_along, crossing.b, crossing))
        elif crossing.b == area_id:
            out.append((OPPOSITE[crossing.a_side], crossing.b_along, crossing.a, crossing))
    return out


def crossing_between(from_area: str, to_area: str) -> tuple[str, float, Crossing] | None:
    """Which side of `to_area` you arrive on from `from_area`, and where along it."""
    for side, along, other, crossing in crossings_of(to_area):
        if other == from_area:
            return side, along, crossing
    return None


def neighbours_of(area_id: str) -> list[str]:
    """Everywhere you can walk to from here, plus every mouth standing in it."""
    area = AREAS.get(area_id)
    if area is None:
        return []
    return ([other for _side, _along, other, _c in crossings_of(area_id)]
            + [target for target, _fx, _fy in area.descents])


def assert_world_is_sound() -> None:
    """Checked at import, because a broken world graph strands a run silently."""
    for crossing in CROSSINGS:
        if crossing.a_side not in OPPOSITE:
            raise ValueError(f"{crossing.name}: {crossing.a_side!r} is not a side")
        for end in (crossing.a, crossing.b):
            if end not in AREAS:
                raise ValueError(f"{crossing.name}: unknown area {end!r}")
            if AREAS[end].kind not in OVERWORLD_KINDS:
                raise ValueError(f"{crossing.name}: {end} is not somewhere you can walk")
        if crossing.kind not in ("bridge", "pass", "causeway", "ferry"):
            raise ValueError(f"{crossing.name}: unknown crossing kind {crossing.kind!r}")
        if crossing.requires and crossing.requires not in AREAS:
            raise ValueError(f"{crossing.name}: gated on unknown area {crossing.requires!r}")
    for area in AREAS.values():
        for target, _fx, _fy in area.descents:
            if target not in AREAS:
                raise ValueError(f"{area.id}: descent into unknown area {target!r}")
        # Two crossings on the same side of the same area at the same place would
        # overlap into one unusable band.
        seen: set[tuple[str, float]] = set()
        for side, along, _other, crossing in crossings_of(area.id):
            if (side, along) in seen:
                raise ValueError(f"{area.id}: two crossings at {side} {along}")
            seen.add((side, along))


assert_world_is_sound()

#: Areas that are always open and always on the map, campaign or not.
ALWAYS_OPEN: frozenset[str] = frozenset({THE_PROVING.id})

START_AREA = HOLLOWREACH_VALE.id

#: Where a dungeon puts you out when you leave or finish it.
#:
#: The region its mouth stands in -- you came down into the crypt from the wood,
#: so you come back up into the wood and walk home from there. Derived from
#: `descents` rather than written twice, so moving a mouth moves its exit too.
HOME_VILLAGE: dict[str, str] = {
    dungeon: area.id
    for area in AREAS.values()
    for dungeon, _fx, _fy in area.descents
}

#: Which region each settlement stands in, by settlement id.
SETTLEMENT_REGION: dict[str, str] = {
    area.settlement: area.id for area in AREAS.values() if area.settlement
}

MAX_NAME_LENGTH = 18


def sanitise_name(raw: str, fallback: str) -> str:
    """Names reach dialogue and the HUD, so they are stripped to printable
    characters and cut to a length the layout can hold. Anything that empties
    out falls back rather than rendering a blank."""
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch in " '-").strip()
    cleaned = " ".join(cleaned.split())[:MAX_NAME_LENGTH]
    return cleaned or fallback


@dataclass
class CampaignState:
    """Everything about a run that outlives a single room."""
    player_name: str = "Wanderer"
    twin_name: str = "the Twin"
    current_area: str = START_AREA
    completed_areas: set[str] = field(default_factory=set)
    discovered_areas: set[str] = field(default_factory=lambda: {START_AREA, *ALWAYS_OPEN})
    # Rooms already looted, by room id, so a treasure room re-entered is empty.
    looted_rooms: set[str] = field(default_factory=set)
    # Quest flags drive dialogue and nothing else. Empty at the start, so the
    # village opens on its `intro` lines -- which are the only place the name
    # the player chose is ever spoken back to them. `quest_active` is set by
    # the elder telling you about the crypt, which is what the words mean.
    flags: set[str] = field(default_factory=set)
    seals: list[str] = field(default_factory=list)
    twin_rescued: bool = False
    twin_named: bool = False
    #: Side quests taken, and the codex they have filled in.
    quests: QuestLog = field(default_factory=QuestLog)

    # --- progression ---------------------------------------------------------

    def is_open(self, area_id: str) -> tuple[bool, str]:
        area = AREAS.get(area_id)
        if area is None:
            return False, "unknown area"
        if area.requires and area.requires not in self.completed_areas:
            return False, f"{AREAS[area.requires].name} first"
        return True, "ok"

    def discover(self, area_id: str) -> bool:
        """Reveal an area on the map. True when this was the first time."""
        if area_id in self.discovered_areas or area_id not in AREAS:
            return False
        self.discovered_areas.add(area_id)
        return True

    def reveal_adjacent(self, area_id: str = "") -> list[str]:
        """Discover what can be seen from where you are standing.

        Only what this region actually connects to -- the places across its
        crossings, and any dungeon mouth in it. Arriving somewhere is what puts
        the next step on the map, so the map fills in as you walk it.

        This used to reveal every *open* area in the game at once, which was the
        right answer when there were five areas and a portal in the village
        square. In a world you cross on foot it is wrong twice over: it hands
        you the whole map for entering the first region, and it marks places you
        have no route to yet.

        A gate is no reason to hide what is *there*. Kell's Crossing is on the
        map before the crypt is quiet, because you can stand on the jetty and be
        told no. `is_open` still decides whether you may go.
        """
        here = area_id or self.current_area
        if here not in AREAS:
            return []
        found = [a for a in neighbours_of(here) if a not in self.discovered_areas]
        self.discovered_areas.update(found)
        return found

    def complete(self, area_id: str) -> bool:
        """Mark an area finished. False when it was already finished, so the
        caller can hand out the reward exactly once."""
        if area_id in self.completed_areas:
            return False
        self.completed_areas.add(area_id)
        area = AREAS[area_id]
        if area.completion_seal and area.completion_seal not in self.seals:
            self.seals.append(area.completion_seal)
        self.flags.add("area_cleared")
        # A flag per area as well as the generic one, so dialogue can react to
        # *which* thing is behind you rather than only to "something is". An
        # elder who says the same line after the crypt and after the Warden is
        # an elder who has not been listening.
        self.flags.add(f"cleared_{area_id}")
        # Finishing a dungeon reveals whatever it unlocks.
        for other in AREAS.values():
            if other.requires == area_id:
                self.discover(other.id)
        return True

    def rescue_twin(self) -> bool:
        if self.twin_rescued:
            return False
        self.twin_rescued = True
        self.flags.add("twin_rescued")
        return True

    # --- serialisation --------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "playerName": self.player_name,
            "twinName": self.twin_name,
            "currentArea": self.current_area,
            "completed": sorted(self.completed_areas),
            "discovered": sorted(self.discovered_areas),
            "flags": sorted(self.flags),
            "seals": list(self.seals),
            "twinRescued": self.twin_rescued,
            "twinNamed": self.twin_named,
            "journal": self.quests.to_dict(),
            "areas": [
                {
                    "id": a.id, "name": a.name, "kind": a.kind, "biome": a.biome,
                    "subtitle": a.subtitle, "mapX": a.map_x, "mapY": a.map_y,
                    "discovered": a.id in self.discovered_areas,
                    "completed": a.id in self.completed_areas,
                    "open": self.is_open(a.id)[0],
                    "current": a.id == self.current_area,
                }
                for a in AREAS.values()
            ],
        }

    def save_dict(self) -> dict:
        """The checkpoint form: state only, no derived view."""
        return {
            "playerName": self.player_name,
            "twinName": self.twin_name,
            "currentArea": self.current_area,
            "completedAreas": sorted(self.completed_areas),
            "discoveredAreas": sorted(self.discovered_areas),
            "lootedRooms": sorted(self.looted_rooms),
            "flags": sorted(self.flags),
            "seals": list(self.seals),
            "twinRescued": self.twin_rescued,
            "twinNamed": self.twin_named,
            "quests": self.quests.save_dict(),
        }

    @classmethod
    def from_save(cls, data: dict) -> CampaignState:
        state = cls()
        state.player_name = str(data.get("playerName", state.player_name))
        state.twin_name = str(data.get("twinName", state.twin_name))
        area = str(data.get("currentArea", START_AREA))
        state.current_area = area if area in AREAS else START_AREA
        state.completed_areas = {a for a in data.get("completedAreas", []) if a in AREAS}
        state.discovered_areas = {a for a in data.get("discoveredAreas", []) if a in AREAS} or {START_AREA}
        state.looted_rooms = set(data.get("lootedRooms", []))
        # No `or {...}` fallback: a save taken before the elder was spoken to
        # legitimately has no flags, and defaulting would skip her opening.
        state.flags = set(data.get("flags", []))
        state.seals = list(data.get("seals", []))
        state.twin_rescued = bool(data.get("twinRescued", False))
        state.twin_named = bool(data.get("twinNamed", False))
        state.quests = QuestLog.from_save(data.get("quests") or {})
        return state


__all__ = [
    "AreaDef", "AREAS", "CampaignState", "Crossing", "CROSSINGS", "START_AREA",
    "HOME_VILLAGE", "OPPOSITE", "OVERWORLD_KINDS", "SETTLEMENT_REGION", "ALWAYS_OPEN",
    "crossings_of", "crossing_between", "neighbours_of", "assert_world_is_sound",
    "sanitise_name", "MAX_NAME_LENGTH",
]
