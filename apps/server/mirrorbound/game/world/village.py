"""Builds a village: a safe room with vendors, a hearth, and roads out.

A village is an ordinary `Room` -- same tiles, same decor, same collision -- so
the renderer, the movement system and the twin all treat it exactly like
anywhere else. What makes it a village is that it has no enemy spawns, it has
NPCs, and its exits are portals to other areas rather than doors to other rooms.
"""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import (
    TILE,
    T_DIRT,
    T_GRASS,
    T_PATH,
    T_WATER,
    T_STONE,
    T_WALL,
    Decor,
    Portal,
    Room,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world.campaign import AREAS, VILLAGE_ROADS
from mirrorbound.game.world.npc import VILLAGE_NPCS, Npc

WIDTH, HEIGHT = 1600, 1120

# Props that make a place read as lived-in rather than as an empty arena.
_BUILDINGS = ("hut", "hut_big", "forge", "stall", "well", "banner")

# How much of itself each building blocks, at scale 1.
#
# Every one of these was 26 before -- a flagpole and a two-storey house on the
# same number -- so you walked into the huts and bounced off thin air beside
# the banner. Lifted out of the call below so the tests can check the numbers
# against the drawn art instead of restating them.
BUILDING_RADII = {"hut": 34, "hut_big": 52, "forge": 32, "stall": 24, "well": 24, "banner": 9}


def build_village(area_id: str, rng: DeterministicRNG) -> Room:
    area = AREAS[area_id]
    room = Room(
        index=0,
        room_type="village",
        name=area.name,
        biome=area.biome,
        width=WIDTH,
        height=HEIGHT,
        area_id=area_id,
        seed=rng.seed,
    )
    room.cleared = True
    room.visited = True
    room.player_spawn = Vec2(WIDTH / 2, HEIGHT - TILE * 4)
    room.twin_spawn = Vec2(WIDTH / 2 - 46, HEIGHT - TILE * 3.6)

    _paint_ground(room, rng)
    _place_npcs(room, area_id)
    _place_portals(room, area_id)
    _decorate(room, rng)
    return room


def _paint_ground(room: Room, rng: DeterministicRNG) -> None:
    cols, rows = room.width // TILE, room.height // TILE
    base = T_GRASS if room.biome == "grove" else T_STONE
    tiles = [[base for _ in range(cols)] for _ in range(rows)]

    # Trodden dirt where people actually walk.
    for _ in range(max(4, (cols * rows) // 110)):
        cx, cy = rng.randint(2, cols - 3), rng.randint(2, rows - 3)
        radius = rng.randint(1, 3)
        for y in range(max(1, cy - radius), min(rows - 1, cy + radius + 1)):
            for x in range(max(1, cx - radius), min(cols - 1, cx + radius + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius and rng.chance(0.7):
                    tiles[y][x] = T_DIRT

    # A crossroads: one road down the middle, one across it. The village reads
    # as a junction, which is what it is.
    mid_col, mid_row = cols // 2, rows // 2
    for y in range(1, rows - 1):
        for x in (mid_col - 1, mid_col, mid_col + 1):
            tiles[y][x] = T_PATH
    for x in range(1, cols - 1):
        for y in (mid_row - 1, mid_row, mid_row + 1):
            tiles[y][x] = T_PATH

    for x in range(cols):
        tiles[0][x] = T_WALL
        tiles[rows - 1][x] = T_WALL
    for y in range(rows):
        tiles[y][0] = T_WALL
        tiles[y][cols - 1] = T_WALL
    room.tiles = tiles


def _off_road(room: Room, x: float, y: float) -> tuple[float, float]:
    """The nearest spot to (x, y) that is not standing in a road.

    Several NPCs are authored at fx=0.50, which is the crossroads exactly, so
    the elder and the village fire pit were placed in the middle of the road.
    Their positions are meant as "by the centre of the village", not "on the
    tarmac", so the authored point is kept and nudged aside by up to two tiles
    rather than re-authored.
    """
    if room.tile_at(x, y) not in (T_PATH, T_WATER):
        return x, y
    for step in range(1, 5):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx * TILE * step * 0.75, y + dy * TILE * step * 0.75
            if (TILE * 2 < nx < room.width - TILE * 2
                    and TILE * 2 < ny < room.height - TILE * 2
                    and room.tile_at(nx, ny) not in (T_PATH, T_WATER)):
                return nx, ny
    return x, y


def _place_npcs(room: Room, area_id: str) -> None:
    for definition in VILLAGE_NPCS.get(area_id, ()):
        x, y = _off_road(room, definition.fx * room.width, definition.fy * room.height)
        room.npcs.append(Npc(definition=definition, x=x, y=y))
        # An NPC is something you walk up to, not through.
        room.decor.append(Decor(kind=definition.sprite, x=x, y=y,
                                blocking=True, radius=14.0))


def _place_portals(room: Room, area_id: str) -> None:
    """One portal per road out, spread along the top edge in map order."""
    targets = [t for t in VILLAGE_ROADS.get(area_id, ()) if t in AREAS]
    if not targets:
        return
    span = room.width / (len(targets) + 1)
    for i, target in enumerate(targets, start=1):
        area = AREAS[target]
        room.portals.append(Portal(
            id=f"{area_id}_to_{target}",
            x=span * i,
            y=TILE * 2.2,
            target_area=target,
            label=area.name,
            kind="descent" if area.kind == "dungeon" else "road",
        ))


def _decorate(room: Room, rng: DeterministicRNG) -> None:
    taken: list[tuple[Vec2, float]] = [(Vec2(n.x, n.y), 70.0) for n in room.npcs]
    taken += [(Vec2(p.x, p.y), 110.0) for p in room.portals]
    taken.append((room.player_spawn, 90.0))

    def free(pos: Vec2, radius: float) -> bool:
        if pos.x < TILE * 2 or pos.x > room.width - TILE * 2:
            return False
        if pos.y < TILE * 2 or pos.y > room.height - TILE * 2:
            return False
        # Nothing stands in a road. The dungeon generator has always checked
        # the tile under a prop; this did not, and only kept the middle of the
        # crossroads clear -- so a stall or a stack of crates could be dropped
        # on the road anywhere else along it.
        #
        # Checked at the prop's edges as well as its centre, because a wide
        # thing centred beside a road still sits across it.
        for dx, dy in ((0.0, 0.0), (-radius, 0.0), (radius, 0.0), (0.0, -radius), (0.0, radius)):
            tile = room.tile_at(pos.x + dx, pos.y + dy)
            if tile in (T_PATH, T_WATER):
                return False
        return all((pos - other).length() > radius + keep for other, keep in taken)

    def scatter(kind: str, count: int, blocking: bool, radius: float, variants: int = 3) -> None:
        """A prop's circle grows with the prop.

        The jitter below draws each instance between 0.92 and 1.12 of its
        nominal size, and the radius used to be passed through flat -- so the
        biggest-drawn hut in a village was also its most under-blocked, by up
        to 12%. `generation.py` has always multiplied by the scale; this is
        the village catching up, not a new idea.
        """
        placed = 0
        for _ in range(count * 10):
            if placed >= count:
                return
            pos = Vec2(rng.uniform(TILE * 2, room.width - TILE * 2),
                       rng.uniform(TILE * 2, room.height - TILE * 2))
            scale = round(rng.uniform(0.92, 1.12), 2)
            r = radius * scale if blocking else radius
            if not free(pos, r * 1.7):
                continue
            room.decor.append(Decor(kind=kind, x=pos.x, y=pos.y, variant=rng.randint(0, variants - 1),
                                    scale=scale, blocking=blocking,
                                    radius=r, flip=rng.chance(0.5)))
            taken.append((pos, r * 1.3))
            placed += 1

    for kind in _BUILDINGS:
        scatter(kind, rng.randint(1, 3), blocking=True, radius=BUILDING_RADII[kind])
    # Trees ring the village rather than dotting it, and there are enough of
    # them to read as a treeline -- a handful scattered over 1600x1120 left
    # whole quarters of the map as bare grass.
    scatter("tree", 26 if room.biome == "grove" else 14, blocking=True, radius=22.0)
    scatter("bush", 20, blocking=False, radius=10.0)
    scatter("grass_tuft", 30, blocking=False, radius=8.0, variants=3)
    scatter("flowers", 16, blocking=False, radius=8.0, variants=4)
    scatter("crate", 5, blocking=True, radius=16.0)
    scatter("torch", 8, blocking=False, radius=10.0)


__all__ = ["build_village", "BUILDING_RADII", "WIDTH", "HEIGHT"]
