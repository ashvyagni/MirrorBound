"""The Proving: a flat empty room for trying things in.

Deliberately featureless. Every other room in the game is composed -- terrain
that suggests a route, decor that hides a flank, spawns placed against the
player's entrance -- and all of that is noise when the question is "what does
this weapon actually do". There is a floor, a wall around it, a way home, and
nothing else.

It is an ordinary `Room`, so movement, combat, the twin and the renderer all
treat it exactly as they treat anywhere else. What makes it the sandbox is that
nothing spawns in it and nothing that happens in it is written down: the area
has no completion, awards nothing, and is not a checkpoint.
"""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import T_STONE, T_WALL, TILE, Portal, Room
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world.campaign import AREAS, START_AREA

#: Larger than a village, because the point is room to watch something move.
#: The Mirror's kite-and-rush cycle needs space to actually read as a cycle.
WIDTH, HEIGHT = 2048, 1536


def build_sandbox(area_id: str, rng: DeterministicRNG) -> Room:
    area = AREAS[area_id]
    room = Room(
        index=0,
        room_type="sandbox",
        name=area.name,
        biome=area.biome,
        width=WIDTH,
        height=HEIGHT,
        area_id=area_id,
        seed=rng.seed,
    )
    # Cleared and visited from the start: there is nothing in here to clear, and
    # a room that never clears is a room whose doors never unlock.
    room.cleared = True
    room.visited = True
    room.player_spawn = Vec2(WIDTH / 2, HEIGHT - TILE * 5)
    room.twin_spawn = Vec2(WIDTH / 2 - 48, HEIGHT - TILE * 4.6)

    cols, rows = WIDTH // TILE, HEIGHT // TILE
    # One tile value everywhere. No paths, no patches, no speckle variation:
    # a flat floor is the one that does not distract from what is standing on
    # it, and it makes distances readable by eye.
    tiles = [[T_STONE for _ in range(cols)] for _ in range(rows)]
    for x in range(cols):
        tiles[0][x] = T_WALL
        tiles[rows - 1][x] = T_WALL
    for y in range(rows):
        tiles[y][0] = T_WALL
        tiles[y][cols - 1] = T_WALL
    room.tiles = tiles

    # The way home. A sandbox you cannot leave is a trap, and this one has no
    # doors of its own to walk out of.
    room.portals.append(Portal(
        id=f"{area_id}_to_{START_AREA}",
        x=WIDTH / 2,
        y=TILE * 2.2,
        target_area=START_AREA,
        label=AREAS[START_AREA].name,
        kind="road",
    ))
    return room


__all__ = ["HEIGHT", "WIDTH", "build_sandbox"]
