"""Builds a region: the ground between the settlements.

A region is the unit of the open world, and it is an ordinary `Room`. It has
tiles, decor, collision and enemy spawns, and the movement system, the renderer
and the twin all treat it exactly as they treat anywhere else -- which is the
whole trick: a continuous world costs authored content rather than an engine
rewrite.

What is in one: wilderness, sometimes a **settlement** (the village lives on this
map, not behind a portal), sometimes a dungeon mouth, and **crossings** on the
sides that lead somewhere. A region's boundary is a real barrier -- a river, a
flood, a wall of rock -- with one narrow way through it, so leaving is something
you find rather than a seam you walk into.

Four terrains, and each one is a different walk:

    grassland   open, long sight lines, little cover; the fields going back
    forest      dense, short sight lines, cover everywhere; where an ambush works
    road        a made thing with a surface, going somewhere, and abandoned
    marsh       standing water with the tops of walls in it; the drowned road
    pass        climbing, and narrow, because the rock decides where you may walk

The terrain is what the brief's §2 asks for -- regions with a purpose rather than
procedural filler -- so each one composes its ground out of the same primitives
the dungeon generator uses (`clump`, `row`, `border`, `beside`, `scatter`) but
arranges them to say something different about the place.

Everything comes off one `rng.spawn("area:<id>")` stream, so a seed always
produces the same Greenmoor.
"""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import (
    BLOCKING_DECOR,
    TILE,
    T_DIRT,
    T_GRASS,
    T_PATH,
    T_STONE,
    T_WALL,
    T_WATER,
    Decor,
    EnemySpawn,
    Room,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world.campaign import AREAS, crossings_of
from mirrorbound.game.world.crossings import carve_boundary, place_crossings, place_descents
from mirrorbound.game.world.settlement import place_settlement

#: Default size when an area does not state one. Roughly two villages across.
DEFAULT_WIDTH, DEFAULT_HEIGHT = 2240, 1600

#: How wide a road is painted, in tiles. Three is enough to read as made rather
#: than as a worn track, and narrow enough that leaving it is a decision.
ROAD_TILES = 3

#: Nothing solid stands within this many units of a road's centreline.
#:
#: A road you cannot walk down is not a road, and the props are placed by
#: rejection sampling which will happily drop a boulder in the middle of one.
ROAD_CLEARANCE = TILE * 2.0

#: Wilderness encounters per region, by terrain.
#:
#: Sparse on purpose. §7 asks for events that are "relatively sparse and
#: intentional", and a region you cannot cross without four fights is a corridor
#: with monsters in it rather than a place. These are the creatures that live
#: here, not a difficulty curve -- that comes off `AreaDef.difficulty`.
ENCOUNTERS: dict[str, tuple[tuple[str, float, float], ...]] = {
    # Open ground: things that can be seen coming, which is the point of open
    # ground. A spitter far off the road, because artillery is what makes an
    # open field a decision instead of a walk.
    "grassland": (
        ("hound", 0.30, 0.34), ("hound", 0.36, 0.28),
        ("skeleton", 0.68, 0.62),
        ("spitter", 0.82, 0.24),
    ),
    # The wood: the ambush terrain, so the sprouts live here. They notice you at
    # 130 units where everything else sees you at three hundred, and the trees
    # are what make that work.
    "forest": (
        ("sprout", 0.30, 0.56), ("sprout", 0.66, 0.44),
        ("hound", 0.48, 0.70),
        ("skeleton", 0.22, 0.30),
    ),
    # A road is where people were robbed. Archers who hold the verge, and
    # something heavy in the middle of it.
    "road": (
        ("archer", 0.26, 0.36), ("archer", 0.30, 0.64),
        ("skeleton", 0.54, 0.50), ("skeleton", 0.60, 0.44),
        ("brute", 0.80, 0.52),
    ),
    # The pass: nothing fast, because there is nowhere to run. Armour and reach,
    # in a place too narrow to walk around either.
    "pass": (
        ("shardling", 0.50, 0.58),
        ("acolyte", 0.32, 0.36), ("acolyte", 0.70, 0.34),
        ("brute", 0.50, 0.24),
    ),
    # Standing water: things that do not mind it, and artillery that can shoot
    # across it. The slowest ground in the game, so what lives here is what
    # punishes being slow.
    "marsh": (
        ("slime", 0.34, 0.44), ("slime", 0.62, 0.58),
        ("spitter", 0.24, 0.24), ("spitter", 0.76, 0.70),
        ("acolyte", 0.50, 0.34),
    ),
}

#: A few things worth walking off the road for, by terrain: (kind, fx, fy).
#:
#: §23 says exploration should be worthwhile and rewards should have context, so
#: these sit at the landmarks rather than being scattered -- what is beside the
#: shrine, in the ruin, under the dead tree.
CACHES: dict[str, tuple[tuple[str, float, float], ...]] = {
    "grassland": (("essence", 0.14, 0.22), ("health_potion", 0.88, 0.80)),
    "forest": (("essence", 0.16, 0.76), ("shards", 0.84, 0.22), ("mana_potion", 0.30, 0.16)),
    "road": (("shards", 0.12, 0.78), ("health_potion", 0.46, 0.18)),
    "pass": (("shards", 0.16, 0.66), ("essence", 0.86, 0.44), ("health_potion", 0.60, 0.78)),
    "marsh": (("shards", 0.18, 0.72), ("essence", 0.80, 0.28), ("mana_potion", 0.44, 0.80)),
}


def build_region(area_id: str, rng: DeterministicRNG, is_open,
                 completed: set[str] | None = None) -> Room:
    """One stretch of the overworld, ready to walk into.

    `is_open` is `CampaignState.is_open`, used to decide whether a crossing or a
    descent out of here is passable yet.
    """
    area = AREAS[area_id]
    room = Room(
        index=0,
        # Not "combat", even though there are creatures in it. The room type is
        # what decides whether gates lock until the room is clear, and a region
        # you cannot leave until you have killed everything in it is the exact
        # opposite of an open world -- you would be able to walk in and not out.
        room_type="region",
        name=area.name,
        biome=area.biome,
        width=area.width or DEFAULT_WIDTH,
        height=area.height or DEFAULT_HEIGHT,
        area_id=area_id,
        seed=rng.seed,
    )
    # Always true, and it has to be set explicitly: `_room_logic` only opens
    # doors on a room it considers cleared, and a region's edges must never be
    # something the player has to earn.
    room.cleared = True

    terrain = area.terrain or "grassland"
    # Order matters. The ground first, then the barriers that make the crossings
    # the only way through it, then the village on top of that ground, then the
    # wilderness -- each step needs to see what the one before it laid down.
    _paint_ground(room, terrain, rng)
    carve_boundary(room, area_id)
    place_crossings(room, area_id, is_open, completed)
    place_descents(room, area_id, is_open)
    settlement = place_settlement(room, area_id, rng)
    _place_spawns(room, terrain, settlement)
    _place_caches(room, terrain, settlement)
    _dress(room, terrain, rng, settlement)

    # Where you stand when you arrive without having walked in from anywhere --
    # a loaded save, or a jump from the map. The village if there is one, because
    # that is where a run should resume; otherwise the middle of the region,
    # which is on its road.
    if settlement is not None:
        room.player_spawn = room.clamp(Vec2(settlement.x, settlement.y + 150.0), 24.0)
    else:
        room.player_spawn = room.clamp(Vec2(room.width / 2, room.height / 2), 24.0)
    room.twin_spawn = room.clamp(room.player_spawn + Vec2(-44, 22), 20.0)
    return room


# --- the ground ---------------------------------------------------------------

def _paint_ground(room: Room, terrain: str, rng: DeterministicRNG) -> None:
    """Tiles, then the roads that join this region's edges.

    The roads are the part that matters. A region's exits are on its sides, and
    a road painted from one side to the other through the middle is what tells
    the player, without a word, that there is somewhere to go and which way it
    is. Everything else here is texture.
    """
    cols, rows = room.width // TILE, room.height // TILE
    base = {"grassland": T_GRASS, "forest": T_GRASS,
            "road": T_STONE, "pass": T_STONE}.get(terrain, T_GRASS)
    accent = T_DIRT
    tiles = [[base for _ in range(cols)] for _ in range(rows)]

    # Blotches of bare ground, grown from seeds, so the floor is not flat.
    for _ in range(max(6, (cols * rows) // 120)):
        cx, cy = rng.randint(2, cols - 3), rng.randint(2, rows - 3)
        radius = rng.randint(1, 3)
        for y in range(max(1, cy - radius), min(rows - 1, cy + radius + 1)):
            for x in range(max(1, cx - radius), min(cols - 1, cx + radius + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius and rng.chance(0.7):
                    tiles[y][x] = accent

    room.tiles = tiles
    _paint_roads(room, terrain, rng)

    if terrain == "pass":
        _raise_walls(room, rng)
    elif terrain == "marsh":
        _flood(room, rng)
    if terrain in ("grassland", "forest"):
        _add_water(room, rng)

    for x in range(cols):
        room.tiles[0][x] = T_WALL
        room.tiles[rows - 1][x] = T_WALL
    for y in range(rows):
        room.tiles[y][0] = T_WALL
        room.tiles[y][cols - 1] = T_WALL


def _paint_roads(room: Room, terrain: str, rng: DeterministicRNG) -> None:
    """A road from the middle of the region out to each of its edges.

    Drawn as a straight run with a slow wander, so it reads as made but not as
    surveyed. Stored on the room as `road_points` so the prop placement can keep
    off it -- the alternative is checking the tile under every prop, which the
    dungeon generator does and which cannot tell a road from a courtyard.
    """
    cols, rows = room.width // TILE, room.height // TILE
    mid_col, mid_row = cols // 2, rows // 2
    half = ROAD_TILES // 2

    def paint(col: int, row: int) -> None:
        for dy in range(-half, half + 1):
            for dx in range(-half, half + 1):
                x, y = col + dx, row + dy
                if 1 <= x < cols - 1 and 1 <= y < rows - 1:
                    room.tiles[y][x] = T_PATH

    # One road per crossing, from the middle of the region to where that crossing
    # actually is. Aimed rather than run straight out: a road that ends beside a
    # bridge instead of at it is the thing that makes a world feel assembled.
    routes = [(side, along) for side, along, _other, _c in crossings_of(room.area_id)]
    # A region with no crossings still gets a crossroads, so it does not read as
    # a field somebody forgot to finish.
    if not routes:
        routes = [("north", 0.5), ("south", 0.5)]

    for side, along in routes:
        if side in ("north", "south"):
            target_col = int((cols * along))
            end_row = 1 if side == "north" else rows - 2
            step = -1 if side == "north" else 1
            span = abs(end_row - mid_row) or 1
            for i, row in enumerate(range(mid_row, end_row + step, step)):
                progress = i / span
                col = int(mid_col + (target_col - mid_col) * progress)
                if rng.chance(0.14):
                    col += rng.choice((-1, 1))
                paint(col, row)
        else:
            target_row = int((rows * along))
            end_col = 1 if side == "west" else cols - 2
            step = -1 if side == "west" else 1
            span = abs(end_col - mid_col) or 1
            for i, col in enumerate(range(mid_col, end_col + step, step)):
                progress = i / span
                row = int(mid_row + (target_row - mid_row) * progress)
                if rng.chance(0.14):
                    row += rng.choice((-1, 1))
                paint(col, row)


def _raise_walls(room: Room, rng: DeterministicRNG) -> None:
    """Rock, on both flanks, leaving a walkable channel down the middle.

    This is the mountain pass, and it is made of tiles rather than art because
    there is no cliff sheet -- §35 says compose from what exists before asking
    for more. A wall tile is already impassable to the movement system and
    already drawn as a wall by the renderer, so massing them into two ridges
    gives a pass that plays correctly and reads correctly from above.

    The channel is kept clear of the road so the way through is always open;
    the ridges eat the corners, which is what makes the region feel narrow.
    """
    cols, rows = room.width // TILE, room.height // TILE
    mid_col = cols // 2
    for y in range(1, rows - 1):
        # How far in the rock reaches on each side, wandering slowly so the
        # channel widens and narrows instead of being a corridor.
        left = 6 + int(3 * rng.next_float())
        right = 6 + int(3 * rng.next_float())
        for x in range(1, min(left, mid_col - 5)):
            if room.tiles[y][x] != T_PATH:
                room.tiles[y][x] = T_WALL
        for x in range(max(cols - right, mid_col + 5), cols - 1):
            if room.tiles[y][x] != T_PATH:
                room.tiles[y][x] = T_WALL


def _pond_radius(room: Room, centre: Vec2, wanted: float) -> float:
    """How big a water circle may be without reaching the road.

    Water tiles do not block on their own -- `Room.is_blocked` reads bounds and
    blocking decor, not the tile grid -- so a stretch of water is made solid by
    one `pond` prop with a radius over it. That circle is a coarse cover of an
    ellipse, and an uncapped one reaches across the dry road beside it: in the
    Drowned Flats it sealed the middle of the region, including the spot the
    player spawns on, and nothing in the tiles said so.

    So the radius is capped short of the nearest paving. Returning 0 means "leave
    this water walkable", which is the right answer for a puddle at the road's
    edge and exactly what the Flats are meant to be.
    """
    nearest = wanted + TILE
    steps = int(nearest // TILE) + 1
    for ty in range(-steps, steps + 1):
        for tx in range(-steps, steps + 1):
            probe = Vec2(centre.x + tx * TILE, centre.y + ty * TILE)
            if room.tile_at(probe.x, probe.y) in (T_PATH, T_STONE):
                nearest = min(nearest, (probe - centre).length())
    capped = min(wanted, nearest - TILE * 0.75)
    return capped if capped >= TILE else 0.0


def _flood(room: Room, rng: DeterministicRNG) -> None:
    """Standing water over a road, with the tops of walls still showing.

    The drowned flats, and the one region whose terrain is the obstacle. Water is
    blocking to the movement system, so a flood is a maze you pick your way
    through -- the road is the dry line across it and leaving the road means
    finding another. What makes it readable rather than annoying is that the
    water is in broad sheets with clear ground between them, not speckle: you can
    see where you may walk from a distance.
    """
    cols, rows = room.width // TILE, room.height // TILE
    for _ in range(rng.randint(9, 13)):
        cx, cy = rng.randint(4, cols - 5), rng.randint(4, rows - 5)
        rx, ry = rng.randint(4, 8), rng.randint(3, 6)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if not (1 < x < cols - 2 and 1 < y < rows - 2):
                    continue
                if room.tiles[y][x] == T_PATH:
                    continue     # the dry road stays dry
                if ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1.0:
                    room.tiles[y][x] = T_WATER
        centre = Vec2((cx + 0.5) * TILE, (cy + 0.5) * TILE)
        radius = _pond_radius(room, centre, min(rx, ry) * TILE * 0.85)
        if radius > 0:
            room.decor.append(Decor(kind="pond", x=centre.x, y=centre.y,
                                    blocking=True, radius=radius))


def _add_water(room: Room, rng: DeterministicRNG) -> None:
    """A pond or a stretch of marsh, off the road."""
    cols, rows = room.width // TILE, room.height // TILE
    for _ in range(rng.randint(1, 2)):
        cx = rng.randint(4, cols - 5)
        cy = rng.randint(4, rows - 5)
        rx, ry = rng.randint(3, 5), rng.randint(2, 3)
        # Never over a road: a ford is a nice idea and a different feature.
        if any(room.tiles[y][x] == T_PATH
               for y in range(max(1, cy - ry - 1), min(rows - 1, cy + ry + 2))
               for x in range(max(1, cx - rx - 1), min(cols - 1, cx + rx + 2))):
            continue
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if 1 < x < cols - 2 and 1 < y < rows - 2:
                    if ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1.0:
                        room.tiles[y][x] = T_WATER
        centre = Vec2((cx + 0.5) * TILE, (cy + 0.5) * TILE)
        radius = _pond_radius(room, centre, min(rx, ry) * TILE + 10)
        if radius > 0:
            room.decor.append(Decor(kind="pond", x=centre.x, y=centre.y,
                                    blocking=True, radius=radius))


# --- what is in it ------------------------------------------------------------

def _place_spawns(room: Room, terrain: str, settlement=None) -> None:
    """The creatures that live here, off the road rather than on it.

    Nudged clear of the roads, because an encounter standing in the middle of the
    only way through is not an encounter the player can choose to take -- and
    §2's rule is that the world rewards exploration, which needs the safe route
    to stay walkable.
    """
    for enemy_type, fx, fy in ENCOUNTERS.get(terrain, ()):
        pos = _off_road(room, Vec2(fx * room.width, fy * room.height))
        # Nothing hostile inside the village. A settlement is the one ground the
        # game promises is safe, and an encounter authored at a fraction that
        # happens to land on the green would break that promise silently.
        if settlement is not None and settlement.contains(pos):
            continue
        room.enemy_spawns.append(EnemySpawn(enemy_type, room.clamp(pos, 30)))


def _place_caches(room: Room, terrain: str, settlement=None) -> None:
    for kind, fx, fy in CACHES.get(terrain, ()):
        pos = room.clamp(Vec2(fx * room.width, fy * room.height), 24)
        # Loot inside the village would be loot you get for arriving.
        if settlement is not None and settlement.contains(pos):
            continue
        room.treasure.append((kind, pos))


def _off_road(room: Room, pos: Vec2) -> Vec2:
    """The nearest spot to `pos` that is not standing on a road or in water."""
    if room.tile_at(pos.x, pos.y) not in (T_PATH, T_WATER):
        return pos
    for step in range(1, 9):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            candidate = Vec2(pos.x + dx * TILE * step, pos.y + dy * TILE * step)
            if (TILE * 2 < candidate.x < room.width - TILE * 2
                    and TILE * 2 < candidate.y < room.height - TILE * 2
                    and room.tile_at(candidate.x, candidate.y) not in (T_PATH, T_WATER, T_WALL)):
                return candidate
    return pos


# --- dressing -----------------------------------------------------------------

def _dress(room: Room, terrain: str, rng: DeterministicRNG, settlement=None) -> None:
    """Compose the region's props.

    The same five arrangements the dungeon generator uses, for the same reason:
    real ground has copses and colonnades, not an even sprinkle. What differs is
    which arrangement each terrain is mostly made of -- a wood is copses, a road
    is two rows of verge, a pass is boulder fields at the foot of the rock.
    """
    w, h = room.width, room.height
    area = (w * h) / (1280 * 960)
    margin = TILE * 2
    taken: list[tuple[Vec2, float]] = [(p, 90.0) for _kind, p in room.treasure]
    taken += [(s.position, 80.0) for s in room.enemy_spawns]
    taken += [(Vec2(p.x, p.y), 130.0) for p in room.portals]
    # A crossing has to stay walkable: it is the only way through, and a boulder
    # dropped in the mouth of one would seal the region with nothing saying so.
    taken += [(Vec2(d.x, d.y), max(d.width, 200.0)) for d in room.doors]
    taken += [(Vec2(d.x, d.y), 26.0) for d in room.decor]

    def free(pos: Vec2, radius: float) -> bool:
        if not (margin < pos.x < w - margin and margin < pos.y < h - margin):
            return False
        # The village dresses itself; wilderness props must not grow through it.
        if settlement is not None and settlement.contains(pos):
            return False
        # Never on a road, in water or inside rock -- checked at the prop's edges
        # as well as its centre, because a wide thing centred beside a road still
        # sits across it.
        for dx, dy in ((0.0, 0.0), (-radius, 0.0), (radius, 0.0), (0.0, -radius), (0.0, radius)):
            if room.tile_at(pos.x + dx, pos.y + dy) in (T_PATH, T_WATER, T_WALL):
                return False
        return all((pos - other).length() > radius + keep for other, keep in taken)

    def put(kind: str, pos: Vec2, blocking: bool, variants: int,
            scale_range: tuple[float, float] = (0.85, 1.15)) -> bool:
        scale = scale_range[0] + rng.next_float() * (scale_range[1] - scale_range[0])
        radius = BLOCKING_DECOR.get(kind, 14) if blocking else 0.0
        keep = max(radius * scale, 14.0)
        # Solid things keep their distance from a road; flowers may grow on the verge.
        if blocking and not free(pos, max(keep, ROAD_CLEARANCE)):
            return False
        if not blocking and not free(pos, keep):
            return False
        room.decor.append(Decor(kind=kind, x=pos.x, y=pos.y, variant=rng.randint(0, variants - 1),
                                scale=round(scale, 2), blocking=blocking, radius=radius,
                                flip=rng.chance(0.5)))
        taken.append((pos, keep * 1.2))
        return True

    def anywhere() -> Vec2:
        return Vec2(rng.randint(margin, w - margin), rng.randint(margin, h - margin))

    def scatter(kind: str, count: int, blocking: bool = False, variants: int = 3,
                scale_range: tuple[float, float] = (0.85, 1.15)) -> None:
        placed = attempts = 0
        while placed < count and attempts < count * 14:
            attempts += 1
            if put(kind, anywhere(), blocking, variants, scale_range):
                placed += 1

    def clump(kind: str, clusters: int, per_cluster: int, spread: float,
              blocking: bool = False, variants: int = 3,
              scale_range: tuple[float, float] = (0.85, 1.15),
              centres: list[Vec2] | None = None) -> list[Vec2]:
        used: list[Vec2] = []
        for i in range(clusters):
            centre = centres[i] if centres and i < len(centres) else anywhere()
            used.append(centre)
            for _ in range(per_cluster):
                for _ in range(8):
                    offset = Vec2(rng.randint(-int(spread), int(spread)),
                                  rng.randint(-int(spread), int(spread)))
                    if put(kind, room.clamp(centre + offset, margin), blocking, variants, scale_range):
                        break
        return used

    def verge(kind: str, count: int, blocking: bool, variants: int, reach: float = TILE * 4.5) -> None:
        """Along the road, just off it. What a road has beside it."""
        placed = attempts = 0
        while placed < count and attempts < count * 20:
            attempts += 1
            probe = anywhere()
            near_road = any(room.tile_at(probe.x + dx, probe.y + dy) == T_PATH
                            for dx in (-reach, 0.0, reach) for dy in (-reach, 0.0, reach))
            if near_road and put(kind, probe, blocking, variants):
                placed += 1

    def border(kind: str, count: int, depth: float, blocking: bool, variants: int,
               scale_range: tuple[float, float] = (0.85, 1.2)) -> None:
        placed = attempts = 0
        while placed < count and attempts < count * 16:
            attempts += 1
            if rng.chance(0.5):
                x = (rng.randint(margin, int(margin + depth)) if rng.chance(0.5)
                     else rng.randint(int(w - margin - depth), w - margin))
                y = rng.randint(margin, h - margin)
            else:
                x = rng.randint(margin, w - margin)
                y = (rng.randint(margin, int(margin + depth)) if rng.chance(0.5)
                     else rng.randint(int(h - margin - depth), h - margin))
            if put(kind, Vec2(x, y), blocking, variants, scale_range):
                placed += 1

    def beside(kind: str, hosts: tuple[str, ...], count: int, reach: float,
               blocking: bool, variants: int) -> None:
        anchors = [Vec2(d.x, d.y) for d in room.decor if d.kind in hosts]
        if not anchors:
            return
        for _ in range(count):
            anchor = anchors[rng.randint(0, len(anchors) - 1)]
            for _ in range(8):
                offset = Vec2(rng.randint(-int(reach), int(reach)), rng.randint(-int(reach), int(reach)))
                if put(kind, room.clamp(anchor + offset, margin), blocking, variants):
                    break

    if terrain == "grassland":
        _dress_grassland(area, rng, clump, scatter, border, verge, beside)
    elif terrain == "forest":
        _dress_forest(area, rng, clump, scatter, border, verge, beside)
    elif terrain == "road":
        _dress_road(room, area, rng, clump, scatter, border, verge, beside, put)
    elif terrain == "marsh":
        _dress_marsh(area, rng, clump, scatter, border, verge, beside)
    else:
        _dress_pass(area, rng, clump, scatter, border, verge, beside)

    room.decor.sort(key=lambda d: d.y)


def _dress_grassland(area, rng, clump, scatter, border, verge, beside) -> None:
    """Fields that stopped being fields.

    Open is the mechanic: long sight lines and almost no cover, so what you can
    see coming is most of what makes this terrain different from the wood. The
    props are therefore low -- fences, tufts, flowers -- and the few tall things
    are at the boundary where they frame rather than block.
    """
    border("tree", int(7 * area), depth=TILE * 3.4, blocking=True, variants=3)
    border("tree_big", int(2 * area), depth=TILE * 2.6, blocking=True, variants=2)

    # Field boundaries: the fences are the story here. Somebody divided this.
    for _ in range(rng.randint(2, 3)):
        clump("fence_post", 1, rng.randint(4, 7), 130, blocking=True, variants=1)
    beside("cart_wheel", ("fence_post",), int(2 * area), reach=90, blocking=True, variants=1)

    # A copse or two, and one dead tree with mushrooms under it.
    copses = clump("tree", 2, rng.randint(2, 3), 110, blocking=True, variants=3)
    clump("bush", len(copses), rng.randint(2, 4), 120, variants=3, centres=copses)
    clump("fallen_trunk", 1, 1, 40, blocking=True, variants=1)
    beside("mushrooms", ("fallen_trunk", "stump", "tree"), int(4 * area), reach=60,
           blocking=False, variants=2)
    clump("berry_bush", 1, rng.randint(2, 3), 90, variants=1)
    clump("reeds", 1, rng.randint(3, 5), 80, variants=1)
    clump("rock", 1, rng.randint(2, 4), 90, blocking=True, variants=3)

    verge("grass_tuft", int(10 * area), blocking=False, variants=3)
    scatter("flowers", int(16 * area), variants=4, scale_range=(0.7, 1.1))
    scatter("grass_tuft", int(26 * area), variants=3, scale_range=(0.7, 1.2))


def _dress_forest(area, rng, clump, scatter, border, verge, beside) -> None:
    """Old trees, close together.

    The opposite of the grassland and the reason the sprouts live here: cover
    everywhere, short sight lines, and a road you keep to because you cannot see
    far off it. Dense enough to read as a wood, with the density coming from
    copses rather than an even spread -- the gaps are what make it navigable.
    """
    border("tree_big", int(6 * area), depth=TILE * 4.0, blocking=True, variants=2,
           scale_range=(0.95, 1.3))
    border("tree", int(10 * area), depth=TILE * 4.6, blocking=True, variants=3)

    copses = clump("tree", 5, rng.randint(3, 5), 100, blocking=True, variants=3)
    clump("tree_big", 2, rng.randint(1, 2), 90, blocking=True, variants=2)
    clump("bush", len(copses), rng.randint(3, 5), 110, variants=3, centres=copses)
    clump("fern_clump", len(copses), rng.randint(2, 4), 96, variants=1, centres=copses)
    beside("mushrooms", ("tree", "tree_big", "fallen_trunk", "stump"), int(7 * area),
           reach=58, blocking=False, variants=2)

    # Felled wood, and the stumps it came off. Somebody worked here once.
    trunks = clump("fallen_trunk", 2, 1, 40, blocking=True, variants=1)
    clump("stump", len(trunks), rng.randint(1, 2), 100, blocking=True, variants=1, centres=trunks)
    clump("moss_rock", 1, rng.randint(2, 3), 90, blocking=True, variants=1)
    clump("berry_bush", 1, rng.randint(1, 3), 80, variants=1)

    verge("grass_tuft", int(8 * area), blocking=False, variants=3)
    scatter("grass_tuft", int(20 * area), variants=3)
    scatter("flowers", int(8 * area), variants=4, scale_range=(0.7, 1.0))
    scatter("log", int(2 * area), blocking=True, variants=1)


def _dress_road(room, area, rng, clump, scatter, border, verge, beside, put) -> None:
    """A road wide enough for carts, and no carts on it.

    Everything here is placed in relation to the road, because the road is the
    subject. Milestones along it, a broken-down cart, benches nobody sits on,
    and the wood coming back in at the edges -- which is the story: this was
    maintained, and it is not any more.
    """
    verge("rune_stone", 3, blocking=True, variants=1)
    verge("stone_bench", int(2 * area), blocking=True, variants=1)
    verge("urn_cracked", int(2 * area), blocking=True, variants=1)
    verge("grass_tuft", int(12 * area), blocking=False, variants=3)

    # An abandoned caravan, at the roadside. §7's world events will animate the
    # living version of this; the wreck is the environmental-storytelling one.
    wreck = clump("crate", 1, rng.randint(2, 3), 70, blocking=True, variants=2)
    clump("cart_wheel", len(wreck), rng.randint(1, 2), 80, blocking=True, variants=1, centres=wreck)
    beside("bones", ("crate", "cart_wheel"), int(3 * area), reach=80, blocking=False, variants=2)

    # What the road was built through, and what is taking it back.
    clump("pillar", 1, rng.randint(3, 4), 130, blocking=True, variants=2)
    beside("broken_pillar", ("pillar",), int(3 * area), reach=100, blocking=True, variants=2)
    beside("rubble", ("pillar", "broken_pillar"), int(8 * area), reach=90, blocking=False, variants=3)
    clump("arch_broken", 1, 1, 30, blocking=True, variants=1)
    clump("statue", 1, 1, 30, blocking=True, variants=1)

    border("tree", int(6 * area), depth=TILE * 3.2, blocking=True, variants=3)
    scatter("rock", int(4 * area), blocking=True, variants=3)
    scatter("grass_tuft", int(14 * area), variants=3)
    scatter("bones", int(3 * area), variants=2)


def _dress_marsh(area, rng, clump, scatter, border, verge, beside) -> None:
    """A road that drowned, and what is standing in the water.

    Everything here is either something that survived the flood or something that
    likes it: broken walls with their tops showing, reeds in the shallows, a dead
    tree. The story is that this was the road until the water came, which is why
    there is a causeway at one end of it and a boatman at the other.
    """
    clump("reeds", 5, rng.randint(3, 6), 90, variants=1, scale_range=(0.85, 1.25))
    clump("broken_pillar", 3, rng.randint(1, 2), 110, blocking=True, variants=2)
    beside("rubble", ("broken_pillar",), int(6 * area), reach=80, blocking=False, variants=3)
    clump("column_fallen", 2, 1, 60, blocking=True, variants=1)
    clump("stump", 2, rng.randint(1, 2), 90, blocking=True, variants=1)
    clump("fallen_trunk", 1, 1, 40, blocking=True, variants=1)

    # Somebody's jetty, and somebody's cargo, left where the water took it.
    wreck = clump("crate", 1, rng.randint(1, 2), 70, blocking=True, variants=2)
    clump("urn_cracked", len(wreck), 1, 70, blocking=True, variants=1, centres=wreck)

    verge("fence_post", int(5 * area), blocking=False, variants=1)
    verge("grass_tuft", int(8 * area), blocking=False, variants=3)
    border("tree", int(3 * area), depth=TILE * 2.6, blocking=True, variants=3,
           scale_range=(0.7, 0.95))
    scatter("grass_tuft", int(12 * area), variants=3)
    scatter("bones", int(4 * area), variants=2)
    scatter("mushrooms", int(5 * area), variants=2)


def _dress_pass(area, rng, clump, scatter, border, verge, beside) -> None:
    """Cut steps and fired brick, climbing.

    The rock is tiles rather than props -- see `_raise_walls` -- so what the
    props do here is explain it: stair fragments where the way was cut, boulder
    fields at the foot of the ridges, braziers because somebody lit this route.
    """
    clump("stair_fragment", 2, rng.randint(1, 2), 90, blocking=True, variants=1)
    clump("rock_big", 3, rng.randint(2, 3), 100, blocking=True, variants=2)
    beside("rock", ("rock_big",), int(6 * area), reach=90, blocking=True, variants=3)
    beside("rubble", ("rock_big", "stair_fragment"), int(8 * area), reach=80,
           blocking=False, variants=3)

    verge("brazier", 4, blocking=True, variants=1)
    verge("rune_stone", 2, blocking=True, variants=1)
    clump("column_fallen", 1, rng.randint(1, 2), 90, blocking=True, variants=1)
    clump("bannered_rubble", 1, 1, 50, blocking=False, variants=1)

    border("tree", int(2 * area), depth=TILE * 2.4, blocking=True, variants=3,
           scale_range=(0.7, 0.95))
    scatter("grass_tuft", int(8 * area), variants=3, scale_range=(0.6, 0.95))
    scatter("bones", int(4 * area), variants=2)


__all__ = ["build_region", "DEFAULT_WIDTH", "DEFAULT_HEIGHT", "ENCOUNTERS", "CACHES"]
