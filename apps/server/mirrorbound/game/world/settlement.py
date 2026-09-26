"""Builds a settlement: the village, standing on the region's own ground.

A village used to be an area — its own room, its own map, reached by stepping
into a portal. It is a **zone inside a region** now. The huts, the forge, the
vendors and the hearth are placed on the region's map among its fields, so you
come over the ridge, see the rooftops, and walk in. Nothing loads and nothing
fades, which is the whole point of the expansion's first requirement.

What that costs, and where it is paid: "somewhere safe" used to be a property of
the room and is now a property of *where you are standing*
(`Room.is_safe_at`). The rules that care — no spawning, respec, the checkpoint,
whether the map will let you travel — ask about position now.

Placement is authored rather than scattered. §3 asks for a village that reads as
a working place: the smith at the forge, the farmer by the fields, the guard on
the road in. So the buildings go down in a deliberate arrangement around a
green, and each vendor is put at the building that belongs to them, instead of
both being dropped wherever rejection sampling happened to allow.
"""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import (
    TILE,
    T_DIRT,
    T_PATH,
    T_WATER,
    Decor,
    Room,
    Settlement,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world.campaign import AREAS
from mirrorbound.game.world.npc import VILLAGE_NPCS, Npc
from mirrorbound.game.world.villagers import populate

#: Legacy size of a standalone village room. Kept because a couple of tools and
#: tests still build one to look at.
WIDTH, HEIGHT = 1600, 1120

#: Where a settlement's buildings stand, as offsets from its centre in units,
#: and what each one is.
#:
#: Authored, not rolled. The arrangement is a green with a road through it: the
#: forge and the trader face each other across the middle, the houses are behind
#: them, the farm buildings are downhill to one side, and the hearth is on the
#: green itself. Two rings, so the village has a front and a back.
_PLAN: tuple[tuple[str, float, float], ...] = (
    # The working front, facing the green from either side of it.
    #
    # Clear of the road bands, which run through the settlement's centre at
    # +/-64 units. A building authored inside one gets its road painted straight
    # through it, and the vendor posted against it is then nudged off the road
    # and ends up standing away from their own forge.
    ("forge",    -235.0, -135.0),
    ("stall",     225.0, -135.0),
    ("well",       10.0,  150.0),
    ("banner",   -130.0, -235.0),
    # Houses behind it.
    ("hut_big",  -250.0, -210.0),
    ("hut",       -60.0, -270.0),
    ("hut",       160.0, -215.0),
    ("hut",       300.0,  -95.0),
    ("hut_big",   275.0,  130.0),
    ("hut",      -285.0,  130.0),
    # The edge of the village: stores and a cart.
    ("crate",    -160.0,  225.0),
    ("crate",    -120.0,  260.0),
    ("stall",     150.0,  240.0),
)

#: Which building each vendor role stands beside, and on which side of it.
#:
#: A blacksmith should not be in the middle of a field — the brief says so
#: explicitly — so the role is bound to the building rather than to a coordinate,
#: and moving the forge in `_PLAN` moves Oren with it.
_POSTS: dict[str, tuple[str, float, float]] = {
    "weaponsmith": ("forge", 34.0, 58.0),
    "apothecary": ("stall", -34.0, 56.0),
    "elder": ("banner", 54.0, 52.0),
    "hearth": ("well", 0.0, -104.0),
}

#: Where the people who are not vendors stand, as offsets from the centre.
#:
#: Bound to a place rather than a building, because what they are doing is
#: where they are: the watch is on the road in, and the farmer is out by the
#: fields. Keyed by NPC id, since two people can share a role.
_STATIONS: dict[str, tuple[float, float]] = {
    "farmer_bram": (-300.0, 220.0),
    "watch_wren": (30.0, 350.0),
    "keeper_odd": (60.0, -300.0),
}


def place_settlement(room: Room, area_id: str, rng: DeterministicRNG) -> Settlement | None:
    """Put the region's village on its ground, if it has one.

    Returns the settlement so the caller can keep everything else out of it --
    wilderness encounters, boulders, its own scatter.
    """
    area = AREAS.get(area_id)
    if area is None or not area.settlement:
        return None

    fx, fy = area.settlement_at
    centre = Vec2(fx * room.width, fy * room.height)
    settlement = Settlement(id=area.settlement, name=_display_name(area.settlement),
                            x=centre.x, y=centre.y, radius=area.settlement_radius)
    room.settlements.append(settlement)

    _pave(room, settlement)
    placed = _raise_buildings(room, settlement, rng)
    _place_people(room, area.settlement, settlement, placed)
    # The people with nothing to say and somewhere to be. Kept apart from the
    # vendors on purpose: a smith who wanders off mid-conversation is worse than
    # one who stands at his forge.
    room.villagers.extend(populate(settlement, room))
    _dress(room, settlement, rng)
    return settlement


def _display_name(settlement_id: str) -> str:
    return {"hollow_reach": "Hollow Reach", "emberfall": "Emberfall"}.get(
        settlement_id, settlement_id.replace("_", " ").title())


def _pave(room: Room, settlement: Settlement) -> None:
    """Trodden ground under the village, and a road through the middle of it.

    The road is the reason the village is here: it sits *on* the route, so the
    player walks into it rather than past it. Paved as a widening of whatever
    road already crosses this ground, so it joins the region's own network
    instead of being a disc of paving with roads arriving at it.
    """
    cols, rows = room.width // TILE, room.height // TILE
    cx, cy = int(settlement.x // TILE), int(settlement.y // TILE)
    reach = int(settlement.radius // TILE)

    for y in range(max(1, cy - reach), min(rows - 1, cy + reach + 1)):
        for x in range(max(1, cx - reach), min(cols - 1, cx + reach + 1)):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy > reach * reach:
                continue
            if room.tiles[y][x] == T_WATER:
                continue
            # A hard circle of dirt would draw the village's own footprint on the
            # ground. Trodden in the middle, fading to whatever was here at the
            # rim, so it reads as ground people walk on rather than a boundary.
            if dx * dx + dy * dy < (reach * 0.72) ** 2:
                room.tiles[y][x] = T_DIRT

    # The green, and the road across it.
    for y in range(max(1, cy - 2), min(rows - 1, cy + 3)):
        for x in range(max(1, cx - reach), min(cols - 1, cx + reach + 1)):
            if room.tiles[y][x] != T_WATER:
                room.tiles[y][x] = T_PATH
    for x in range(max(1, cx - 2), min(cols - 1, cx + 3)):
        for y in range(max(1, cy - reach), min(rows - 1, cy + reach + 1)):
            if room.tiles[y][x] != T_WATER:
                room.tiles[y][x] = T_PATH


def _raise_buildings(room: Room, settlement: Settlement, rng: DeterministicRNG) -> dict[str, list[Vec2]]:
    """The authored plan, put down around the settlement's centre.

    Returns where each kind of building ended up, so the people can be posted at
    the ones that belong to them.
    """
    radii = {"hut": 34.0, "hut_big": 52.0, "forge": 32.0, "stall": 24.0,
             "well": 24.0, "banner": 9.0, "crate": 16.0}
    placed: dict[str, list[Vec2]] = {}
    for kind, ox, oy in _PLAN:
        pos = room.clamp(Vec2(settlement.x + ox, settlement.y + oy), radii[kind] + TILE)
        # A building that would stand in water is skipped rather than moved: the
        # plan is authored and nudging it would put two huts in one place.
        if room.tile_at(pos.x, pos.y) == T_WATER:
            continue
        room.decor.append(Decor(
            kind=kind, x=pos.x, y=pos.y, variant=rng.randint(0, 2),
            scale=round(rng.uniform(0.96, 1.06), 2), blocking=True,
            radius=radii[kind], flip=rng.chance(0.5),
        ))
        placed.setdefault(kind, []).append(pos)
    return placed


def _place_people(room: Room, settlement_id: str, settlement: Settlement,
                  placed: dict[str, list[Vec2]]) -> None:
    """Every vendor at their own building, and the hearth on the green."""
    for definition in VILLAGE_NPCS.get(settlement_id, ()):
        station = _STATIONS.get(definition.id)
        if station is not None:
            where = Vec2(settlement.x + station[0], settlement.y + station[1])
            _stand(room, definition, where)
            continue
        post = _POSTS.get(definition.role)
        where: Vec2 | None = None
        if post is not None:
            kind, ox, oy = post
            hosts = placed.get(kind, [])
            if hosts:
                where = Vec2(hosts[0].x + ox, hosts[0].y + oy)
        if where is None:
            # No building of theirs was raised (it was in water). Fall back to
            # the authored fraction, read against the settlement rather than the
            # region, so they are at least in the village.
            where = Vec2(settlement.x + (definition.fx - 0.5) * settlement.radius,
                         settlement.y + (definition.fy - 0.5) * settlement.radius)
        _stand(room, definition, where)


def _stand(room: Room, definition, where: Vec2) -> None:
    """Put one person down, off the road, and make them something you walk up to."""
    where = room.clamp(_beside_the_road(room, where), 16.0)
    room.npcs.append(Npc(definition=definition, x=where.x, y=where.y))
    room.decor.append(Decor(kind=definition.sprite, x=where.x, y=where.y,
                            blocking=True, radius=14.0))


def _beside_the_road(room: Room, pos: Vec2) -> Vec2:
    """Nudge off the road and out of water, by up to a few tiles."""
    if room.tile_at(pos.x, pos.y) not in (T_PATH, T_WATER):
        return pos
    for step in range(1, 6):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
            candidate = Vec2(pos.x + dx * TILE * step * 0.8, pos.y + dy * TILE * step * 0.8)
            if (TILE * 2 < candidate.x < room.width - TILE * 2
                    and TILE * 2 < candidate.y < room.height - TILE * 2
                    and room.tile_at(candidate.x, candidate.y) not in (T_PATH, T_WATER)):
                return candidate
    return pos


def _dress(room: Room, settlement: Settlement, rng: DeterministicRNG) -> None:
    """Torches along the road, and the small things a lived-in place has."""
    taken = [(Vec2(d.x, d.y), max(d.radius, 20.0) * 1.5) for d in room.decor]

    def free(pos: Vec2, keep: float) -> bool:
        if not (TILE * 2 < pos.x < room.width - TILE * 2 and TILE * 2 < pos.y < room.height - TILE * 2):
            return False
        if room.tile_at(pos.x, pos.y) in (T_PATH, T_WATER):
            return False
        return all((pos - other).length() > keep + other_keep for other, other_keep in taken)

    def scatter(kind: str, count: int, blocking: bool, radius: float, variants: int) -> None:
        placed = 0
        for _ in range(count * 12):
            if placed >= count:
                return
            angle = rng.next_float() * 6.2831853
            distance = settlement.radius * (0.25 + 0.7 * rng.next_float())
            pos = Vec2(settlement.x + distance * _cos(angle), settlement.y + distance * _sin(angle))
            if not free(pos, max(radius, 18.0)):
                continue
            room.decor.append(Decor(kind=kind, x=pos.x, y=pos.y, variant=rng.randint(0, variants - 1),
                                    scale=round(rng.uniform(0.9, 1.1), 2), blocking=blocking,
                                    radius=radius, flip=rng.chance(0.5)))
            taken.append((pos, max(radius, 18.0)))
            placed += 1

    # Lit, because a village at the end of a long walk should read as lit.
    cx, cy = settlement.x, settlement.y
    for i in range(8):
        angle = i * 0.7853982
        pos = Vec2(cx + 150 * _cos(angle), cy + 150 * _sin(angle))
        room.decor.append(Decor(kind="torch", x=pos.x, y=pos.y, variant=i % 2,
                                blocking=False, radius=0.0))

    scatter("fence_post", 10, blocking=False, radius=9.0, variants=1)
    scatter("berry_bush", 4, blocking=False, radius=14.0, variants=1)
    scatter("bush", 8, blocking=False, radius=12.0, variants=3)
    scatter("flowers", 12, blocking=False, radius=8.0, variants=4)
    scatter("grass_tuft", 14, blocking=False, radius=8.0, variants=3)
    scatter("cart_wheel", 2, blocking=False, radius=14.0, variants=1)


def _cos(a: float) -> float:
    import math
    return math.cos(a)


def _sin(a: float) -> float:
    import math
    return math.sin(a)


__all__ = ["place_settlement", "stand_npc", "WIDTH", "HEIGHT"]


#: Public name for `_stand`, so a region can place someone outside a village.
stand_npc = _stand
