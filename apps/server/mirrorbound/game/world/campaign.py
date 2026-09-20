"""The campaign: a small authored world of areas, and the state of a run through it.

Five areas, not a procedural continent. The directive's own rule is that a
compact authored world beats a big generated one when the compact one delivers
the intended experience, and the intended experience here is Player + Twin and
the Mirror at the end of it. Every area exists to serve that:

    hollow_reach   village   safe hub, vendors, the elder who starts the quest
    wakewood_crypt dungeon   the tutorial descent; the twin is found here
    emberfall      village   the second hub; proof that progress reaches the world
    ashen_deep     dungeon   the real dungeon, with a guardian at the bottom
    mirror_sanctum dungeon   the Mirror

Area ids are stable and are baked into room ids, so a heatmap or a saved
checkpoint from one run still means the same thing in the next.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.dungeon.templates import RoomType


@dataclass(frozen=True)
class AreaDef:
    id: str
    name: str
    kind: str                      # "village" | "dungeon"
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


HOLLOW_REACH = AreaDef(
    id="hollow_reach", name="Hollow Reach", kind="village", biome="grove",
    subtitle="A village that has learned to sleep lightly.",
    map_x=0.18, map_y=0.72,
)

WAKEWOOD_CRYPT = AreaDef(
    id="wakewood_crypt", name="Wakewood Crypt", kind="dungeon", biome="grove",
    subtitle="Something under the wakewood is breathing again.",
    sequence=(RoomType.ENTRANCE, RoomType.COMBAT, RoomType.EXPLORATION, RoomType.TREASURE, RoomType.ELITE),
    requires="", map_x=0.38, map_y=0.54, difficulty=1.0,
    completion_gold=120, completion_seal="seal_of_waking", tutorial=True,
)

EMBERFALL = AreaDef(
    id="emberfall", name="Emberfall", kind="village", biome="ruins",
    subtitle="Built in the ribs of something older.",
    requires="wakewood_crypt", map_x=0.56, map_y=0.66,
)

ASHEN_DEEP = AreaDef(
    id="ashen_deep", name="The Ashen Deep", kind="dungeon", biome="ruins",
    subtitle="The road down, and the warden that keeps it.",
    sequence=(RoomType.ENTRANCE, RoomType.COMBAT, RoomType.TREASURE, RoomType.COMBAT,
              RoomType.EXPLORATION, RoomType.GUARDIAN),
    requires="wakewood_crypt", map_x=0.74, map_y=0.44, difficulty=1.35,
    completion_gold=260, completion_seal="seal_of_ash",
)

MIRROR_SANCTUM = AreaDef(
    id="mirror_sanctum", name="The Mirror Sanctum", kind="dungeon", biome="crypt",
    subtitle="It has been watching you the whole way here.",
    sequence=(RoomType.ENTRANCE, RoomType.BOSS),
    requires="ashen_deep", map_x=0.88, map_y=0.20, difficulty=1.5,
    completion_gold=0, completion_seal="seal_of_the_mirror",
)

#: A flat, empty room to test things in.
#:
#: Not part of the campaign: nothing gates it, nothing it contains counts, and
#: it is reached from the map like anywhere else so that testing a weapon or a
#: boss does not mean playing to the place that has one. `kind="sandbox"` keeps
#: it out of the village/dungeon logic entirely -- it has no NPCs to talk to,
#: no rooms to clear and no completion to award.
THE_PROVING = AreaDef(
    id="the_proving", name="The Proving", kind="sandbox", biome="sandbox",
    subtitle="Nothing here is real. Nothing here counts.",
    map_x=0.06, map_y=0.14,
)

AREAS: dict[str, AreaDef] = {
    a.id: a for a in (HOLLOW_REACH, WAKEWOOD_CRYPT, EMBERFALL, ASHEN_DEEP,
                      MIRROR_SANCTUM, THE_PROVING)
}

#: Areas that are always open and always on the map, campaign or not.
ALWAYS_OPEN: frozenset[str] = frozenset({THE_PROVING.id})

START_AREA = HOLLOW_REACH.id
# Which village each dungeon sends you back to when you leave or finish it.
HOME_VILLAGE: dict[str, str] = {
    "wakewood_crypt": "hollow_reach",
    "ashen_deep": "emberfall",
    "mirror_sanctum": "emberfall",
}
# Where a village's road leads.
VILLAGE_ROADS: dict[str, tuple[str, ...]] = {
    "hollow_reach": ("wakewood_crypt", "emberfall", "the_proving"),
    "emberfall": ("ashen_deep", "mirror_sanctum", "hollow_reach"),
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

    def reveal_open(self) -> list[str]:
        """Discover every area you could set out for right now.

        A village is where you choose where to go, so standing in one is what
        puts the roads out of it on the map. Only *open* areas: anything still
        gated by an area you have not finished stays an unknown marker, so the
        map fills in as the campaign does rather than all at once.

        Without this the opening is a dead end -- the elder tells you about the
        Wakewood Crypt and the map has never heard of it.
        """
        found = [a.id for a in AREAS.values()
                 if a.id not in self.discovered_areas and self.is_open(a.id)[0]]
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
        return state


__all__ = [
    "AreaDef", "AREAS", "CampaignState", "START_AREA", "HOME_VILLAGE", "VILLAGE_ROADS",
    "sanitise_name", "MAX_NAME_LENGTH",
]
