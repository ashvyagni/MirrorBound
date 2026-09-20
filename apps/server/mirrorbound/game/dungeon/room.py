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

    @property
    def collision_radius(self) -> float:
        return self.radius * self.scale

    @property
    def collision_center(self) -> Vec2:
        # Buildings are drawn with a bottom anchor. Their foundations extend
        # behind that point; trunks and people use a small circle at their feet.
        lift = self.collision_radius * .55 if self.kind in {"hut", "hut_big", "forge", "stall", "well"} else 0.0
        return Vec2(self.x, self.y - lift)

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
    side: str                  # "north" | "south" | "east" | "west"
    x: float
    y: float
    width: float = 96.0
    target_index: int | None = None   # room index this door leads to; None = sealed
    locked: bool = True
    kind: str = "gate"          # gate | arch | exit

    def contains(self, pos: Vec2, radius: float) -> bool:
        half = self.width / 2
        if self.side in ("north", "south"):
            return abs(pos.x - self.x) < half and abs(pos.y - self.y) < TILE * 0.9 + radius
        return abs(pos.y - self.y) < half and abs(pos.x - self.x) < TILE * 0.9 + radius

    def to_dict(self) -> dict:
        return {
            "side": self.side, "x": self.x, "y": self.y, "width": self.width,
            "targetIndex": self.target_index, "locked": self.locked, "kind": self.kind,
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

    def is_blocked(self, pos: Vec2, radius: float) -> bool:
        if self.is_wall(pos.x - radius, pos.y - radius) or self.is_wall(pos.x + radius, pos.y + radius):
            return True
        for d in self.decor:
            if d.blocking and (pos - d.collision_center).length() < d.collision_radius + radius:
                return True
        return False

    def resolve_decor_collision(self, pos: Vec2, radius: float) -> Vec2:
        """Push `pos` out of any blocking decor circle it overlaps."""
        out = pos
        for d in self.decor:
            if not d.blocking:
                continue
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
        for door in self.doors:
            if door.target_index is not None and door.contains(pos, radius):
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

    def entry_point_from(self, side: str) -> Vec2:
        """Where you stand after entering through the door on `side`."""
        for door in self.doors:
            if door.side == side:
                inset = TILE * 2.4
                if side == "north":
                    return Vec2(door.x, door.y + inset)
                if side == "south":
                    return Vec2(door.x, door.y - inset)
                if side == "west":
                    return Vec2(door.x + inset, door.y)
                return Vec2(door.x - inset, door.y)
        return self.player_spawn

    def unlock_doors(self) -> None:
        for door in self.doors:
            door.locked = False

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
            "safe": self.room_type == "village",
            "areaId": self.area_id,
            "seed": self.seed,
        }
