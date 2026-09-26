"""Room model: tiles, decor, doors, spawns.

Tiles are ints so the snapshot stays small:

    0 grass   1 wall   2 path   3 stone floor   4 dirt   5 water   6 wall-top (client decoration)

Decor is a list of props placed in world units. Blocking props take part in
movement collision; non-blocking ones (flowers, tufts, bones) are visual only.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Vec2

TILE = 32
WALL_THICKNESS = TILE

#: Side of one spatial-index block, in world units.
#:
#: Four tiles. Big enough that a query touches only a handful of blocks, small
#: enough that a block holds only a few props -- the biggest circle in the game
#: (a flooded sheet of water) is about this wide, so nothing is filed under an
#: unreasonable number of them.
BUCKET = TILE * 4

T_GRASS, T_WALL, T_PATH, T_STONE, T_DIRT, T_WATER = 0, 1, 2, 3, 4, 5

BLOCKING_DECOR = {
    "tree": 22, "tree_big": 30, "rock": 18, "rock_big": 26, "pillar": 16,
    "broken_pillar": 14, "crate": 16, "chest": 16, "statue": 18, "well": 24,
    "brazier": 12, "gravestone": 12, "log": 20, "torch": 0, "bush": 0,
    # Grove clutter.
    "fallen_trunk": 24, "stump": 15, "moss_rock": 18, "fence_post": 9,
    "cart_wheel": 15,
    # Ruins clutter.
    "column_fallen": 26, "stone_bench": 20, "urn_cracked": 13,
    "stair_fragment": 22, "arch_broken": 20, "sarcophagus": 26, "rune_stone": 13,
    # Crypt clutter.
    "skull_stack": 11, "coffin_cracked": 15, "iron_cage": 16,
}


@dataclass
class Decor:
    kind: str
    x: float
    y: float
    variant: int = 0
    scale: float = 1.0
    blocking: bool = False
    radius: float = 0.0
    flip: bool = False

    #: Worked out once. A prop never moves, so its collision circle is constant --
    #: and `collision_center` built a fresh Vec2 on every read, which the profile
    #: caught doing it 722,000 times over four hundred ticks of one region. The
    #: collision queries are the hottest loops in the simulation and this is pure
    #: arithmetic on fields that cannot change.
    _centre: Vec2 | None = field(default=None, repr=False, compare=False)

    @property
    def collision_radius(self) -> float:
        return self.radius * self.scale

    @property
    def collision_center(self) -> Vec2:
        # Buildings are drawn with a bottom anchor. Their foundations extend
        # behind that point; trunks and people use a small circle at their feet.
        if self._centre is None:
            lift = self.collision_radius * .55 if self.kind in {"hut", "hut_big", "forge", "stall", "well"} else 0.0
            self._centre = Vec2(self.x, self.y - lift)
        return self._centre

    def to_dict(self) -> dict:
        return {
            "collisionX": round(self.collision_center.x, 1),
            "collisionY": round(self.collision_center.y, 1),
            "collisionRadius": round(self.collision_radius, 2),
            "kind": self.kind, "x": round(self.x, 1), "y": round(self.y, 1),
            "variant": self.variant, "scale": round(self.scale, 2),
            "blocking": self.blocking, "radius": self.radius, "flip": self.flip,
        }


@dataclass
class Door:
    """A way out of a room, on one of its four sides.

    Two kinds of target, and they are different things. `target_index` is
    another room in the *same dungeon* -- a gate you walk through. `target_area`
    is the edge of the world: the ground continues into the next region, and
    walking off this side puts you on the opposite side of that one. An edge is
    a Door rather than a Portal because a Door is already a rectangle on a side,
    and an edge has to span most of one.
    """
    side: str                  # "north" | "south" | "east" | "west"
    x: float
    y: float
    width: float = 96.0
    target_index: int | None = None   # room index this door leads to; None = sealed
    locked: bool = True
    kind: str = "gate"          # gate | arch | exit | edge | sealed
    #: Another *area* this side opens onto, for a continuous overworld.
    target_area: str = ""
    #: Why this way is shut, when it is. Shown to the player instead of a
    #: silent wall -- §22 asks for barriers that make sense inside the world.
    lock_reason: str = ""
    #: What this way is called. Crossings have names so an NPC can tell you to
    #: take the Rootbridge and the HUD can confirm you are standing on it.
    label: str = ""
    #: A key that opens this door, or "" for one that is not locked that way.
    #:
    #: A combat room's gates open when the room is clear. A puzzle room's do not
    #: -- that is the difference between the two archetypes -- so a door can
    #: instead be waiting on a key you found or a switch you threw.
    needs_key: str = ""
    #: A switch id this door is waiting on, or "".
    needs_switch: str = ""

    @property
    def is_edge(self) -> bool:
        """Whether walking off this side leaves the area entirely."""
        return bool(self.target_area)

    def contains(self, pos: Vec2, radius: float) -> bool:
        half = self.width / 2
        # An edge is crossed by reaching the boundary, not by standing in a
        # doorway, so it is deeper than a gate: the movement system clamps the
        # player to the room's interior, and a band one tile thick at the very
        # edge is one the clamp can leave you just outside of.
        depth = TILE * (2.2 if self.is_edge else 0.9)
        if self.side in ("north", "south"):
            return abs(pos.x - self.x) < half and abs(pos.y - self.y) < depth + radius
        return abs(pos.y - self.y) < half and abs(pos.x - self.x) < depth + radius

    def to_dict(self) -> dict:
        return {
            "side": self.side, "x": self.x, "y": self.y, "width": self.width,
            "targetIndex": self.target_index, "locked": self.locked, "kind": self.kind,
            "targetArea": self.target_area, "lockReason": self.lock_reason,
            "label": self.label, "needsKey": self.needs_key,
            "needsSwitch": self.needs_switch,
        }


@dataclass
class Portal:
    """A way out of one *area* and into another.

    Doors link rooms inside a dungeon by index; a portal links whole areas by
    id (village -> dungeon, dungeon -> village). Keeping them separate means a
    door never has to know whether its target is in this dungeon or another
    part of the world.
    """
    id: str
    x: float
    y: float
    target_area: str
    label: str = ""
    kind: str = "gate"          # gate | road | descent
    locked: bool = False
    lock_reason: str = ""
    radius: float = 54.0

    def contains(self, pos: Vec2, radius: float) -> bool:
        return (pos - Vec2(self.x, self.y)).length() <= self.radius + radius

    def to_dict(self) -> dict:
        return {
            "id": self.id, "x": round(self.x, 1), "y": round(self.y, 1),
            "targetArea": self.target_area, "label": self.label, "kind": self.kind,
            "locked": self.locked, "lockReason": self.lock_reason, "radius": self.radius,
        }


@dataclass
class Switch:
    """Something in a room that opens something else in it.

    The puzzle archetype's whole vocabulary. A combat room asks "can you win the
    fight"; a puzzle room asks "can you see what opens this", and a switch is the
    smallest honest way to pose that question -- it is a thing you have to reach,
    which means the room's shape is the puzzle rather than a minigame bolted to
    it.

    Thrown by standing on it. There is no interact key: the rooms are built so
    that reaching the plate is the difficulty, and adding a keypress would only
    put a second obstacle in front of the first.
    """
    id: str
    x: float
    y: float
    #: What throwing it opens: a door side, or "" for a switch that only counts
    #: toward a room needing several.
    opens: str = ""
    radius: float = 34.0
    thrown: bool = False

    def contains(self, pos: Vec2, radius: float) -> bool:
        return (pos - Vec2(self.x, self.y)).length() <= self.radius + radius

    def to_dict(self) -> dict:
        return {"id": self.id, "x": round(self.x, 1), "y": round(self.y, 1),
                "opens": self.opens, "radius": self.radius, "thrown": self.thrown}


@dataclass
class Settlement:
    """A village, standing inside a region.

    Not an area of its own. A settlement is a *circle of ground* within a region
    room: the huts, the vendors and the hearth are on the same map as the fields
    around them, so you see the rooftops from the road and walk in without a
    transition. That is the difference between an open world and a set of rooms
    joined by portals.

    Because it is a zone rather than a room, "am I somewhere safe" stops being a
    property of the map and becomes a question about where you are standing --
    which is what `Room.settlement_at` answers, and what the rules that used to
    read `room_type == "village"` ask now.
    """
    id: str
    name: str
    x: float
    y: float
    radius: float = 520.0

    def contains(self, pos: Vec2) -> bool:
        return (pos - Vec2(self.x, self.y)).length() <= self.radius

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "x": round(self.x, 1),
                "y": round(self.y, 1), "radius": round(self.radius, 1)}


@dataclass
class EnemySpawn:
    enemy_type: str
    position: Vec2

    def to_dict(self) -> dict:
        return {"type": self.enemy_type, "position": self.position.to_dict()}


@dataclass
class Room:
    """A room in the dungeon."""
    index: int = 0
    room_type: str = "combat"
    name: str = "Unnamed Hall"
    biome: str = "grove"
    width: int = 1280
    height: int = 960
    tiles: list[list[int]] = field(default_factory=list)
    decor: list[Decor] = field(default_factory=list)
    doors: list[Door] = field(default_factory=list)
    enemy_spawns: list[EnemySpawn] = field(default_factory=list)
    player_spawn: Vec2 = field(default_factory=lambda: Vec2(640, 480))
    twin_spawn: Vec2 = field(default_factory=lambda: Vec2(600, 500))
    treasure: list[tuple[str, Vec2]] = field(default_factory=list)   # (pickup kind/item, position)
    cleared: bool = False
    visited: bool = False
    seed: int = 0
    # Area this room belongs to; part of the room id so heatmaps and telemetry
    # from the first village never merge with the second one's.
    area_id: str = ""
    portals: list[Portal] = field(default_factory=list)
    npcs: list = field(default_factory=list)      # list[Npc]; untyped to keep this module import-free
    #: People walking their rounds. Scenery that moves, with no dialogue and no
    #: collision -- see `world/villagers.py` for why they are not Npcs.
    villagers: list = field(default_factory=list)  # list[Villager]
    #: Villages standing in this room. Empty everywhere but an overworld region.
    settlements: list[Settlement] = field(default_factory=list)
    #: Plates to stand on. Empty outside a puzzle room.
    switches: list[Switch] = field(default_factory=list)
    #: Keys lying in this room, as (key id, position).
    keys: list[tuple[str, Vec2]] = field(default_factory=list)
    #: A key the way on waits for. Set by the template, read once doors link.
    _needs_key: str = field(default="", repr=False, compare=False)
    #: Blocking decor bucketed by tile block, built on first use.
    #:
    #: Every collision query used to scan the whole decor list. That was fine when
    #: a room was 1280x960 with 76 props in it, and it is not fine now: a region
    #: is 2560x1792 with 340, and the queries run per entity per tick plus once
    #: per segment test inside the navigator. The profile had one region at 10.5%
    #: of the tick budget with the scans on top.
    _buckets: dict | None = field(default=None, repr=False, compare=False)
    #: What the index was built from, so appending a prop rebuilds it.
    _bucket_stamp: int = field(default=-1, repr=False, compare=False)
    # Set once the room's one-time rewards have been handed out, so a room that
    # is re-entered cannot be farmed.
    looted: bool = False

    @property
    def id(self) -> str:
        return f"{self.area_id}_room_{self.index}" if self.area_id else f"room_{self.index}"

    def __post_init__(self):
        if not self.tiles:
            cols, rows = self.width // TILE, self.height // TILE
            self.tiles = [[T_GRASS for _ in range(cols)] for _ in range(rows)]
            for x in range(cols):
                self.tiles[0][x] = T_WALL
                self.tiles[rows - 1][x] = T_WALL
            for y in range(rows):
                self.tiles[y][0] = T_WALL
                self.tiles[y][cols - 1] = T_WALL

    # --- geometry --------------------------------------------------------------

    @property
    def door_positions(self) -> list[Vec2]:
        return [Vec2(d.x, d.y) for d in self.doors]

    @property
    def interior(self) -> tuple[float, float, float, float]:
        """(min_x, min_y, max_x, max_y) of walkable space."""
        return (WALL_THICKNESS, WALL_THICKNESS, self.width - WALL_THICKNESS, self.height - WALL_THICKNESS)

    def is_wall(self, x: float, y: float) -> bool:
        min_x, min_y, max_x, max_y = self.interior
        return x < min_x or x > max_x or y < min_y or y > max_y

    def tile_at(self, x: float, y: float) -> int:
        col, row = int(x // TILE), int(y // TILE)
        if 0 <= row < len(self.tiles) and 0 <= col < len(self.tiles[0]):
            return self.tiles[row][col]
        return T_WALL

    def blocking_decor(self) -> list[Decor]:
        return [d for d in self.decor if d.blocking]

    def blocking_near(self, min_x: float, min_y: float, max_x: float, max_y: float) -> list[Decor]:
        """Blocking decor that could overlap the given box.

        A superset, not an exact answer: a prop is filed under every block its
        circle reaches, so a query returns everything nearby and the caller still
        does the real distance test. That is the point -- the expensive part was
        never the arithmetic, it was doing it three hundred and forty times.
        """
        buckets = self._blocking_buckets()
        if not buckets:
            return []
        found: list[Decor] = []
        seen: set[int] = set()
        for by in range(int(min_y // BUCKET), int(max_y // BUCKET) + 1):
            for bx in range(int(min_x // BUCKET), int(max_x // BUCKET) + 1):
                for decor in buckets.get((bx, by), ()):
                    key = id(decor)
                    if key not in seen:
                        seen.add(key)
                        found.append(decor)
        return found

    def _blocking_buckets(self) -> dict:
        if self._buckets is not None and self._bucket_stamp == len(self.decor):
            return self._buckets
        buckets: dict[tuple[int, int], list[Decor]] = {}
        for decor in self.decor:
            if not decor.blocking:
                continue
            centre, reach = decor.collision_center, decor.collision_radius
            for by in range(int((centre.y - reach) // BUCKET), int((centre.y + reach) // BUCKET) + 1):
                for bx in range(int((centre.x - reach) // BUCKET), int((centre.x + reach) // BUCKET) + 1):
                    buckets.setdefault((bx, by), []).append(decor)
        self._buckets = buckets
        self._bucket_stamp = len(self.decor)
        return buckets

    def is_blocked(self, pos: Vec2, radius: float) -> bool:
        if self.is_wall(pos.x - radius, pos.y - radius) or self.is_wall(pos.x + radius, pos.y + radius):
            return True
        for d in self.blocking_near(pos.x - radius, pos.y - radius, pos.x + radius, pos.y + radius):
            if (pos - d.collision_center).length() < d.collision_radius + radius:
                return True
        return False

    def resolve_decor_collision(self, pos: Vec2, radius: float) -> Vec2:
        """Push `pos` out of any blocking decor circle it overlaps."""
        out = pos
        for d in self.blocking_near(pos.x - radius, pos.y - radius, pos.x + radius, pos.y + radius):
            centre = d.collision_center
            diff = out - centre
            dist = diff.length()
            min_dist = d.collision_radius + radius
            if dist < min_dist:
                if dist == 0:
                    diff = Vec2(1, 0)
                    dist = 1
                out = centre + diff.normalized() * min_dist
        return out

    def clamp(self, pos: Vec2, radius: float) -> Vec2:
        min_x, min_y, max_x, max_y = self.interior
        return Vec2(
            max(min_x + radius, min(max_x - radius, pos.x)),
            max(min_y + radius, min(max_y - radius, pos.y)),
        )

    def door_at(self, pos: Vec2, radius: float) -> Door | None:
        """A door to another room in this dungeon that `pos` is standing in."""
        for door in self.doors:
            if door.target_index is not None and door.contains(pos, radius):
                return door
        return None

    def edge_at(self, pos: Vec2, radius: float) -> Door | None:
        """An edge of the world that `pos` has reached.

        Kept apart from `door_at` because the two mean different things and the
        room logic acts on them differently -- one moves you to another room in
        the dungeon you are in, the other moves you to another area. Locked
        edges are returned as well: the caller says why the way is shut, which
        is the difference between a barrier and an invisible wall.
        """
        for door in self.doors:
            if door.is_edge and door.contains(pos, radius):
                return door
        return None

    def enemy_sprites(self) -> list[str]:
        """Distinct sprite names this room's spawns will use, sorted so the
        snapshot is stable tick to tick."""
        from mirrorbound.game.entities.enemy import get_archetype

        names = set()
        for spawn in self.enemy_spawns:
            try:
                names.add(get_archetype(spawn.enemy_type).sprite)
            except ValueError:
                continue
        return sorted(names)

    def portal_at(self, pos: Vec2, radius: float) -> Portal | None:
        for portal in self.portals:
            if portal.contains(pos, radius):
                return portal
        return None

    def door_to(self, target_index: int) -> Door | None:
        for door in self.doors:
            if door.target_index == target_index:
                return door
        return None

    def entry_point_from(self, side: str, along: float | None = None) -> Vec2:
        """Where you stand after entering through the door on `side`.

        `along` is where on that side you came in, as 0-1 across it. Crossing a
        region edge keeps the offset -- walk off the north edge near its left end
        and you arrive near the left end of the next region's south edge -- so
        the world holds its shape as you move through it. None centres on the
        door, which is what a dungeon gate wants.

        **The inset is load-bearing for edges.** An edge is a band 2.2 tiles deep
        (see `Door.contains`) and the room logic hands control back after a 0.6 s
        transition. Arriving inside that band means the edge fires again the
        moment the timer runs out, and the player ping-pongs between two regions
        with no way to stop it. Four tiles clears the band with room to spare.
        """
        for door in self.doors:
            if door.side != side:
                continue
            inset = TILE * (4.0 if door.is_edge else 2.4)
            if along is None:
                x, y = door.x, door.y
            elif side in ("north", "south"):
                x = door.x - door.width / 2 + door.width * min(max(along, 0.0), 1.0)
                y = door.y
            else:
                x = door.x
                y = door.y - door.width / 2 + door.width * min(max(along, 0.0), 1.0)
            if side == "north":
                return Vec2(x, y + inset)
            if side == "south":
                return Vec2(x, y - inset)
            if side == "west":
                return Vec2(x + inset, y)
            return Vec2(x - inset, y)
        return self.player_spawn

    def offset_along(self, side: str, pos: Vec2) -> float:
        """Where `pos` sits across the given side, as 0-1. The inverse of `along`."""
        for door in self.doors:
            if door.side != side:
                continue
            start = (door.x if side in ("north", "south") else door.y) - door.width / 2
            here = pos.x if side in ("north", "south") else pos.y
            return min(max((here - start) / door.width, 0.0), 1.0) if door.width else 0.5
        return 0.5

    def settlement_at(self, pos: Vec2) -> Settlement | None:
        """The village `pos` is standing in, if any."""
        for settlement in self.settlements:
            if settlement.contains(pos):
                return settlement
        return None

    def is_safe_at(self, pos: Vec2) -> bool:
        """Whether this spot is somewhere the game promises is safe.

        A whole room used to be safe or not, because a village was a room. A
        region contains both a village and the wilderness around it, so safety
        is a question about position now. Dungeons answer False everywhere, which
        they always did.
        """
        return self.room_type == "village" or self.settlement_at(pos) is not None

    def unlock_doors(self, keys: set[str] | None = None) -> None:
        """Open every door the room is not deliberately holding shut.

        Clearing a room opens its gates -- that has always been the rule -- but a
        puzzle room's door is not waiting on the fight, and opening it here would
        make every lock in the archetype dissolve the moment the last creature
        died. A door waiting on a key opens only when that key is carried, and a
        door waiting on a switch only when the switch is thrown.
        """
        held = keys or set()
        thrown = {s.id for s in self.switches if s.thrown}
        for door in self.doors:
            if door.needs_key and door.needs_key not in held:
                continue
            if door.needs_switch and door.needs_switch not in thrown:
                continue
            door.locked = False

    def switch_at(self, pos: Vec2, radius: float) -> Switch | None:
        for switch in self.switches:
            if not switch.thrown and switch.contains(pos, radius):
                return switch
        return None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "index": self.index,
            "roomType": self.room_type,
            "name": self.name,
            "biome": self.biome,
            "width": self.width,
            "height": self.height,
            "tileSize": TILE,
            "tiles": self.tiles,
            "decor": [d.to_dict() for d in self.decor],
            "doors": [d.to_dict() for d in self.doors],
            "portals": [p.to_dict() for p in self.portals],
            # Which enemy art this room will actually need. The client loads
            # sheets per room from this rather than every sheet at boot: there
            # are twelve enemy families and a room uses at most a few.
            "enemySprites": self.enemy_sprites(),
            "cleared": self.cleared,
            # True when the *whole* room is safe. A region is not -- it has a
            # village in it and wilderness around that -- so the client reads
            # `settlements` and the snapshot's `settlement` field for where the
            # player actually is.
            "safe": self.room_type == "village",
            "settlements": [s.to_dict() for s in self.settlements],
            "switches": [s.to_dict() for s in self.switches],
            "areaId": self.area_id,
            "seed": self.seed,
        }
