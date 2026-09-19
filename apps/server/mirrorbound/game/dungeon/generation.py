"""Dungeon generation: handcrafted templates, procedurally arranged and dressed.

Everything here pulls from one `rng.spawn("dungeon")` stream, so a seed always
produces the same rooms, the same decor and the same spawns.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import (
    BLOCKING_DECOR, T_DIRT, T_GRASS, T_PATH, T_STONE, T_WALL, T_WATER, TILE,
    Decor, Door, EnemySpawn, Room,
)
from mirrorbound.game.dungeon.templates import (
    DEFAULT_SEQUENCE, RoomTemplate, RoomType, biome_for, get_random_template, resolve_spawn,
)
from mirrorbound.game.entities.entity import Vec2


@dataclass
class DungeonRun:
    """A complete dungeon run with multiple rooms."""
    seed: int
    rooms: list[Room]
    current_room_index: int = 0

    @property
    def current_room(self) -> Room:
        return self.rooms[self.current_room_index]

    @property
    def is_complete(self) -> bool:
        return self.current_room_index >= len(self.rooms)

    def next_room(self) -> Room | None:
        if self.current_room_index < len(self.rooms) - 1:
            self.current_room_index += 1
            return self.current_room
        return None

    def to_dict(self) -> dict:
        return {
            "seed": self.seed,
            "roomCount": len(self.rooms),
            "currentIndex": self.current_room_index,
            "rooms": [
                {"index": r.index, "type": r.room_type, "name": r.name, "biome": r.biome,
                 "cleared": r.cleared, "visited": r.visited}
                for r in self.rooms
            ],
        }


class DungeonGenerator:
    """Generates dungeon runs from the fixed room sequence."""

    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("dungeon")

    def generate(self, room_count: int = 7, sequence: tuple[RoomType, ...] | None = None) -> DungeonRun:
        seq = list(sequence or DEFAULT_SEQUENCE)
        if room_count != len(seq):
            seq = self._sequence_for(room_count)
        rooms: list[Room] = []
        for index, room_type in enumerate(seq):
            template = get_random_template(room_type, self.rng)
            room_rng = self.rng.spawn(f"room:{index}")
            rooms.append(self._build_room(index, len(seq), template, room_rng))
        # Link doors: each room's south door leads back, north door leads on.
        for i, room in enumerate(rooms):
            for door in room.doors:
                if door.side == "north":
                    door.target_index = i + 1 if i + 1 < len(rooms) else None
                    door.kind = "gate" if door.target_index is not None else "sealed"
                elif door.side == "south":
                    door.target_index = i - 1 if i > 0 else None
                    door.kind = "arch" if door.target_index is not None else "sealed"
            # Rooms with nothing to clear stand open.
            if not room.enemy_spawns:
                room.cleared = True
                room.unlock_doors()
        return DungeonRun(seed=self.rng.seed, rooms=rooms, current_room_index=0)

    @staticmethod
    def _sequence_for(count: int) -> list[RoomType]:
        if count <= 1:
            return [RoomType.BOSS]
        middle = [RoomType.COMBAT, RoomType.EXPLORATION, RoomType.TREASURE, RoomType.COMBAT, RoomType.ELITE]
        body = [middle[i % len(middle)] for i in range(max(0, count - 2))]
        return [RoomType.ENTRANCE] + body + [RoomType.BOSS]

    # --- room construction --------------------------------------------------------

    def _build_room(self, index: int, total: int, template: RoomTemplate, rng: DeterministicRNG) -> Room:
        w, h = template.width, template.height
        biome = biome_for(index, total)
        room = Room(
            index=index,
            room_type=template.room_type.value,
            name=rng.choice(template.title_pool),
            biome=biome,
            width=w,
            height=h,
            seed=rng.seed,
        )
        room.doors = [
            Door(side="south", x=w / 2, y=h - TILE / 2, width=TILE * 3),
            Door(side="north", x=w / 2, y=TILE / 2, width=TILE * 3),
        ]
        room.player_spawn = Vec2(w / 2, h - TILE * 3.2)
        room.twin_spawn = Vec2(w / 2 - 44, h - TILE * 3.0)

        self._paint_floor(room, template, rng)
        self._carve_path(room)
        if template.has_water and biome == "grove":
            self._add_pond(room, rng)
        self._place_spawns(room, template)
        self._place_treasure(room, template)
        self._place_decor(room, template, rng)
        return room

    def _paint_floor(self, room: Room, template: RoomTemplate, rng: DeterministicRNG) -> None:
        cols, rows = room.width // TILE, room.height // TILE
        base = {"grove": T_GRASS, "ruins": T_STONE, "crypt": T_STONE}[room.biome]
        accent = {"grove": T_DIRT, "ruins": T_DIRT, "crypt": T_DIRT}[room.biome]
        tiles = [[base for _ in range(cols)] for _ in range(rows)]
        # Blotches of the accent tile, grown from seeds, so the floor isn't flat.
        blotch_count = max(3, (cols * rows) // 90)
        for _ in range(blotch_count):
            cx, cy = rng.randint(2, cols - 3), rng.randint(2, rows - 3)
            radius = rng.randint(1, 3)
            for y in range(max(1, cy - radius), min(rows - 1, cy + radius + 1)):
                for x in range(max(1, cx - radius), min(cols - 1, cx + radius + 1)):
                    if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius and rng.chance(0.75):
                        tiles[y][x] = accent
        if room.biome == "grove" and template.ruin_density > 0:
            # Flagstone patches around ruins.
            for _ in range(int(2 * template.ruin_density)):
                cx, cy = rng.randint(3, cols - 4), rng.randint(3, rows - 4)
                for y in range(cy - 1, cy + 2):
                    for x in range(cx - 2, cx + 3):
                        tiles[y][x] = T_STONE
        for x in range(cols):
            tiles[0][x] = T_WALL
            tiles[rows - 1][x] = T_WALL
        for y in range(rows):
            tiles[y][0] = T_WALL
            tiles[y][cols - 1] = T_WALL
        room.tiles = tiles

    def _carve_path(self, room: Room) -> None:
        """A worn path between the two doors, so the room reads as travelled."""
        cols, rows = room.width // TILE, room.height // TILE
        cx = cols // 2
        for y in range(1, rows - 1):
            # gentle S-bend
            offset = int(round(math.sin(y / rows * math.pi * 2) * 1.5))
            for dx in (-1, 0):
                x = cx + offset + dx
                if 1 <= x < cols - 1:
                    room.tiles[y][x] = T_PATH

    def _add_pond(self, room: Room, rng: DeterministicRNG) -> None:
        cols, rows = room.width // TILE, room.height // TILE
        side = rng.choice((-1, 1))
        cx = cols // 2 + side * rng.randint(9, 13)
        cy = rng.randint(rows // 3, rows // 2)
        rx, ry = rng.randint(2, 3), rng.randint(1, 2)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if 1 < x < cols - 2 and 1 < y < rows - 2:
                    if ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1.0:
                        room.tiles[y][x] = T_WATER
        # Water is a blocking decor for movement purposes: one circle per tile cluster.
        room.decor.append(Decor(kind="pond", x=(cx + 0.5) * TILE, y=(cy + 0.5) * TILE,
                                variant=0, scale=1.0, blocking=True, radius=min(rx, ry) * TILE + 10))

    def _place_spawns(self, room: Room, template: RoomTemplate) -> None:
        for spec in template.spawns:
            pos = Vec2(spec.fx * room.width, spec.fy * room.height)
            enemy_type = resolve_spawn(spec.enemy_type, room.biome)
            room.enemy_spawns.append(EnemySpawn(enemy_type, room.clamp(pos, 30)))

    def _place_treasure(self, room: Room, template: RoomTemplate) -> None:
        for kind, fx, fy in template.treasure:
            pos = room.clamp(Vec2(fx * room.width, fy * room.height), 24)
            room.treasure.append((kind, pos))
            if kind == "chest":
                room.decor.append(Decor(kind="chest", x=pos.x, y=pos.y, blocking=False, radius=0))

    # --- decoration -------------------------------------------------------------------

    def _place_decor(self, room: Room, template: RoomTemplate, rng: DeterministicRNG) -> None:
        w, h = room.width, room.height
        area = (w * h) / (1280 * 960)
        reserved: list[tuple[Vec2, float]] = [(room.player_spawn, 110), (room.twin_spawn, 90)]
        reserved += [(s.position, 70) for s in room.enemy_spawns]
        reserved += [(p, 60) for _, p in room.treasure]
        for door in room.doors:
            reserved.append((Vec2(door.x, door.y), 120))

        def free(pos: Vec2, radius: float) -> bool:
            if room.is_wall(pos.x - radius, pos.y - radius) or room.is_wall(pos.x + radius, pos.y + radius):
                return False
            if room.tile_at(pos.x, pos.y) in (T_PATH, T_WATER):
                return False
            for rp, rr in reserved:
                if (pos - rp).length() < rr + radius:
                    return False
            for d in room.decor:
                if (pos - Vec2(d.x, d.y)).length() < (d.radius if d.blocking else 14) + radius + 6:
                    return False
            return True

        def scatter(kind: str, count: int, blocking: bool, variants: int = 3,
                    scale_range: tuple[float, float] = (0.85, 1.2), edge_bias: float = 0.0) -> None:
            attempts = 0
            placed = 0
            while placed < count and attempts < count * 12:
                attempts += 1
                if edge_bias > 0 and rng.chance(edge_bias):
                    # Hug the walls: forests and pillars frame a room rather than fill it.
                    if rng.chance(0.5):
                        x = rng.randint(TILE + 20, TILE * 4) if rng.chance(0.5) else rng.randint(w - TILE * 4, w - TILE - 20)
                        y = rng.randint(TILE + 20, h - TILE - 20)
                    else:
                        x = rng.randint(TILE + 20, w - TILE - 20)
                        y = rng.randint(TILE + 20, TILE * 4) if rng.chance(0.5) else rng.randint(h - TILE * 4, h - TILE - 20)
                else:
                    x = rng.randint(TILE + 20, w - TILE - 20)
                    y = rng.randint(TILE + 20, h - TILE - 20)
                pos = Vec2(x, y)
                scale = scale_range[0] + rng.next_float() * (scale_range[1] - scale_range[0])
                radius = BLOCKING_DECOR.get(kind, 14) * scale if blocking else 0
                if not free(pos, max(radius, 14)):
                    continue
                room.decor.append(Decor(kind=kind, x=x, y=y, variant=rng.randint(0, variants - 1),
                                        scale=scale, blocking=blocking, radius=radius, flip=rng.chance(0.5)))
                placed += 1

        biome = room.biome
        if biome == "grove":
            scatter("tree_big", int(3 * area * template.tree_density), True, 2, (0.9, 1.25), edge_bias=0.85)
            scatter("tree", int(7 * area * template.tree_density), True, 3, (0.8, 1.15), edge_bias=0.7)
            scatter("bush", int(8 * area * template.flora_density), False, 3)
            scatter("rock", int(4 * area * template.rock_density), True, 3)
            scatter("log", int(1 * area), True, 1)
            scatter("flowers", int(14 * area * template.flora_density), False, 4, (0.7, 1.1))
            scatter("grass_tuft", int(26 * area * template.flora_density), False, 3, (0.7, 1.2))
            scatter("mushrooms", int(4 * area * template.flora_density), False, 2)
            if template.ruin_density > 0:
                scatter("broken_pillar", int(3 * area * template.ruin_density), True, 2)
        elif biome == "ruins":
            scatter("pillar", int(5 * area * template.ruin_density), True, 2, (0.9, 1.15), edge_bias=0.75)
            scatter("broken_pillar", int(4 * area * template.ruin_density), True, 2)
            scatter("rock_big", int(2 * area * template.rock_density), True, 2)
            scatter("rock", int(4 * area * template.rock_density), True, 3)
            scatter("crate", int(3 * area), True, 2)
            scatter("statue", int(1 * area * template.ruin_density), True, 1, edge_bias=0.9)
            scatter("tree", int(3 * area * template.tree_density), True, 3, edge_bias=0.9)
            scatter("grass_tuft", int(12 * area * template.flora_density), False, 3)
            scatter("rubble", int(10 * area), False, 3)
            scatter("bones", int(4 * area), False, 2)
        else:  # crypt
            scatter("pillar", int(6 * area * template.ruin_density), True, 2, (0.9, 1.1), edge_bias=0.85)
            scatter("gravestone", int(5 * area), True, 3)
            scatter("statue", int(2 * area), True, 1, edge_bias=0.9)
            scatter("brazier", int(2 * area), True, 1)
            scatter("rubble", int(12 * area), False, 3)
            scatter("bones", int(8 * area), False, 2)
            scatter("candles", int(6 * area), False, 2)
            scatter("rock_big", int(1 * area * template.rock_density), True, 2)

        # Torches line the walls at regular intervals; they're the room's light.
        torches = template.torches
        if torches > 0:
            per_side = max(1, torches // 2)
            for i in range(per_side):
                fx = (i + 1) / (per_side + 1)
                room.decor.append(Decor(kind="torch", x=fx * w, y=TILE * 0.9, variant=0, blocking=False))
                room.decor.append(Decor(kind="torch", x=fx * w, y=h - TILE * 0.55, variant=1, blocking=False))
        # Sort by y so the client can draw in painter's order without re-sorting statics.
        room.decor.sort(key=lambda d: d.y)


__all__ = ["DungeonGenerator", "DungeonRun", "T_GRASS", "T_WALL", "T_PATH", "T_STONE", "T_DIRT", "T_WATER"]
