"""Where one region meets the next, and the ground that makes it the only way.

A crossing is a **place**, not a seam. Regions are separated by something real --
a river, a flooded road, a wall of rock -- and joined at one narrow thing you
have to find: a bridge, a causeway, a cut, a boatman. That is what makes arriving
somewhere new feel like arriving, and what gives an NPC something to name when
they tell you how to get to Emberfall.

Two halves to building one:

    carve_boundary   makes the side impassable, and leaves a gap
    place_crossings  puts the door in the gap, and the prop that says what it is

Both are driven by the authored `Crossing` records in `campaign.py`, which are
written once from one end so a crossing can never lead somewhere that does not
lead back.

Descents are the other kind of exit and stay portals: going underground is a
threshold and should read as one. The brief only asks that portals stop being
what makes the *overworld* connected.
"""

from __future__ import annotations

from mirrorbound.game.dungeon.room import (
    TILE,
    T_PATH,
    T_STONE,
    T_WALL,
    T_WATER,
    Decor,
    Door,
    Portal,
    Room,
)
from mirrorbound.game.world.campaign import AREAS, Crossing, crossings_of

#: How deep into the region the boundary barrier reaches, in tiles.
#:
#: Thick enough to read as a river or a ridge rather than a line, and to stop the
#: player from seeing across it to ground they cannot reach.
BOUNDARY_DEPTH = 4

#: What each kind of crossing is made of: the barrier tile flanking it, the tile
#: the way through is paved with, and the prop that says what it is.
KINDS: dict[str, dict] = {
    # A river, and a bridge over it.
    "bridge": {"barrier": T_WATER, "deck": T_PATH, "prop": "stone_bench", "rail": "fence_post"},
    # Shallow flood, and a raised stone road through it.
    "causeway": {"barrier": T_WATER, "deck": T_STONE, "prop": "rune_stone", "rail": "broken_pillar"},
    # Rock, and a cut through it.
    "pass": {"barrier": T_WALL, "deck": T_PATH, "prop": "stair_fragment", "rail": "rock"},
    # Open water, and a jetty. The gate of the campaign lives on this one.
    "ferry": {"barrier": T_WATER, "deck": T_STONE, "prop": "crate", "rail": "fence_post"},
}


def _axis(room: Room, side: str, along: float, width: float) -> tuple[int, int, int]:
    """The tile band a crossing occupies on a side: (centre, lo, hi) in tiles."""
    length = room.width if side in ("north", "south") else room.height
    centre = int((length * along) // TILE)
    half = max(1, int((width / 2) // TILE))
    cols = length // TILE
    lo = max(1, min(centre - half, cols - 2))
    hi = max(1, min(centre + half, cols - 2))
    return centre, lo, hi


def carve_boundary(room: Room, area_id: str) -> None:
    """Make every side that has a crossing impassable, except at the crossing.

    This is what turns a crossing from a doorway into the only way through. The
    barrier is tiles rather than props because tiles are already impassable to
    the movement system and already drawn as terrain -- §35's rule is to compose
    from what exists, and a river is a band of water tiles.

    Sides with no crossing are left as the room's own wall, which they already
    are: the world simply ends there, and it looks like the edge of a wood or
    the foot of a cliff rather than a road that goes nowhere.
    """
    cols, rows = room.width // TILE, room.height // TILE
    for side, along, _other, crossing in crossings_of(area_id):
        spec = KINDS[crossing.kind]
        _centre, lo, hi = _axis(room, side, along, crossing.width)

        for depth in range(1, BOUNDARY_DEPTH + 1):
            if side in ("north", "south"):
                row = depth if side == "north" else rows - 1 - depth
                if not 0 < row < rows - 1:
                    continue
                for x in range(1, cols - 1):
                    room.tiles[row][x] = spec["deck"] if lo <= x <= hi else spec["barrier"]
            else:
                col = depth if side == "west" else cols - 1 - depth
                if not 0 < col < cols - 1:
                    continue
                for y in range(1, rows - 1):
                    room.tiles[y][col] = spec["deck"] if lo <= y <= hi else spec["barrier"]

        # The deck has to reach the road, or the crossing is an island: a strip
        # of paving from the barrier inward until it meets whatever is there.
        _run_deck_inward(room, side, lo, hi, spec["deck"])


def _run_deck_inward(room: Room, side: str, lo: int, hi: int, deck: int) -> None:
    """Pave from the barrier toward the middle until the road is reached."""
    cols, rows = room.width // TILE, room.height // TILE
    reach = BOUNDARY_DEPTH + 6
    for step in range(BOUNDARY_DEPTH + 1, reach):
        if side in ("north", "south"):
            row = step if side == "north" else rows - 1 - step
            if not 0 < row < rows - 1:
                return
            if any(room.tiles[row][x] == T_PATH for x in range(lo, hi + 1)):
                return
            for x in range(lo, hi + 1):
                room.tiles[row][x] = deck
        else:
            col = step if side == "west" else cols - 1 - step
            if not 0 < col < cols - 1:
                return
            if any(room.tiles[y][col] == T_PATH for y in range(lo, hi + 1)):
                return
            for y in range(lo, hi + 1):
                room.tiles[y][col] = deck


def place_crossings(room: Room, area_id: str, is_open, completed: set[str] | None = None) -> None:
    """Put a door in each crossing's gap, and dress it so it reads as one.

    A gated crossing still gets its door, locked and carrying what the world
    says about it. That is the §22 rule: a barrier you can walk up to and be told
    about is a barrier; one that silently is not there is a missing road.
    """
    for side, along, other, crossing in crossings_of(area_id):
        if other not in AREAS:
            continue
        opens, reason = _passable(crossing, other, is_open, completed)
        x, y = _door_point(room, side, along)
        room.doors.append(Door(
            side=side, x=x, y=y, width=crossing.width, target_index=None,
            locked=not opens, kind=crossing.kind, target_area=other,
            lock_reason="" if opens else reason, label=crossing.name,
        ))
        _dress_crossing(room, side, along, crossing)


def _passable(crossing: Crossing, other: str, is_open,
              completed: set[str] | None) -> tuple[bool, str]:
    """Whether this crossing may be used, and what to say when it may not.

    Two gates, and the crossing's own comes first because it is the one with
    something to say. `Crossing.requires` is the campaign's gate put somewhere a
    player can stand -- Kell will not push off while the wood is breathing --
    and the destination's own `requires` is the fallback for anywhere that has
    one without a crossing to hang it on.

    `completed` absent means "treat the world as open", which is what a caller
    that only wants to look at a region wants.
    """
    if crossing.requires and completed is not None and crossing.requires not in completed:
        return False, (crossing.blocked_line
                       or f"{AREAS[crossing.requires].name} first")
    return is_open(other)


def _door_point(room: Room, side: str, along: float) -> tuple[float, float]:
    if side in ("north", "south"):
        return room.width * along, TILE * 0.5 if side == "north" else room.height - TILE * 0.5
    return (TILE * 0.5 if side == "west" else room.width - TILE * 0.5), room.height * along


def _dress_crossing(room: Room, side: str, along: float, crossing: Crossing) -> None:
    """A rail down each side of the way through, and a marker beside it.

    Non-blocking rails: the point of the props is to say "this is a bridge", and
    a bridge you can be knocked off by walking into its own railing is worse than
    one with no railing at all. The barrier tiles are what actually stop you.
    """
    spec = KINDS[crossing.kind]
    x, y = _door_point(room, side, along)
    half = crossing.width / 2
    inward = {"north": (0, 1), "south": (0, -1), "west": (1, 0), "east": (-1, 0)}[side]
    for step in range(1, BOUNDARY_DEPTH + 1):
        ox, oy = inward[0] * TILE * step, inward[1] * TILE * step
        for sign in (-1, 1):
            if side in ("north", "south"):
                rx, ry = x + sign * half, y + oy
            else:
                rx, ry = x + ox, y + sign * half
            room.decor.append(Decor(kind=spec["rail"], x=rx, y=ry, variant=step % 2,
                                    scale=0.9, blocking=False, radius=0.0))
    # One marker just inside, so the crossing has a face when you walk up to it.
    room.decor.append(Decor(kind=spec["prop"], x=x + inward[0] * TILE * (BOUNDARY_DEPTH + 1.6),
                            y=y + inward[1] * TILE * (BOUNDARY_DEPTH + 1.6),
                            variant=0, scale=1.0, blocking=False, radius=0.0))


def place_descents(room: Room, area_id: str, is_open) -> None:
    """A portal at every dungeon mouth standing in this area."""
    area = AREAS.get(area_id)
    if area is None:
        return
    for target, fx, fy in area.descents:
        if target not in AREAS:
            continue
        opens, reason = is_open(target)
        room.portals.append(Portal(
            id=f"{area_id}_to_{target}",
            # Clamped inside the walls: a mouth authored flush against the edge
            # is one the collision hull will not let you reach the middle of.
            x=min(max(fx * room.width, TILE * 3), room.width - TILE * 3),
            y=min(max(fy * room.height, TILE * 3), room.height - TILE * 3),
            target_area=target,
            label=AREAS[target].name,
            kind="descent",
            locked=not opens,
            lock_reason="" if opens else reason,
        ))


__all__ = ["carve_boundary", "place_crossings", "place_descents", "KINDS", "BOUNDARY_DEPTH"]
