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
    DEFAULT_SEQUENCE, TUTORIAL_COMBAT, RoomTemplate, RoomType, biome_for, get_random_template,
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

    def generate(self, room_count: int = 7, sequence: tuple[RoomType, ...] | None = None,
                 biome: str | None = None, tutorial: bool = False) -> DungeonRun:
        """`biome` pins every room in the run to one biome. Without it the run
        shades from grove to crypt over its own length, which is right for a
        single long descent and wrong once the world has areas that each have
        a look of their own.

        `tutorial` makes the run's first combat room the authored teaching one
        rather than a roll of the four. The opening dungeon passes it; nothing
        else does."""
        seq = list(sequence or DEFAULT_SEQUENCE)
        if room_count != len(seq):
            seq = self._sequence_for(room_count)
        rooms: list[Room] = []
        first_combat = True
        for index, room_type in enumerate(seq):
            # The run's first fight is authored, not rolled: see TUTORIAL_COMBAT.
            # Only in the opening area -- later dungeons have the twin, levels
            # and a bought weapon behind them, and should surprise you.
            teaching = tutorial and first_combat and room_type is RoomType.COMBAT
            if room_type is RoomType.COMBAT:
                first_combat = False
            template = TUTORIAL_COMBAT if teaching else get_random_template(room_type, self.rng)
            room_rng = self.rng.spawn(f"room:{index}")
            rooms.append(self._build_room(index, len(seq), template, room_rng, biome=biome))
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

    def _build_room(self, index: int, total: int, template: RoomTemplate, rng: DeterministicRNG,
                    biome: str | None = None) -> Room:
        w, h = template.width, template.height
        biome = biome or biome_for(index, total)
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
            room.enemy_spawns.append(EnemySpawn(spec.enemy_type, room.clamp(pos, 30)))

    def _place_treasure(self, room: Room, template: RoomTemplate) -> None:
        for kind, fx, fy in template.treasure:
            pos = room.clamp(Vec2(fx * room.width, fy * room.height), 24)
            room.treasure.append((kind, pos))
            if kind == "chest":
                room.decor.append(Decor(kind="chest", x=pos.x, y=pos.y, blocking=False, radius=0))

    # --- decoration -------------------------------------------------------------------

    def _place_decor(self, room: Room, template: RoomTemplate, rng: DeterministicRNG) -> None:
        """Dress the room.

        Composed rather than sprinkled. The old version was one uniform random
        scatter per kind with a bias toward the walls, which is noise: nothing
        grew near anything, every room had the same even density everywhere, and
        the only difference between two rooms was where the noise happened to
        fall. Real ground has copses, colonnades, rows of graves and rubble at
        the foot of the thing that shed it.

        So there are five ways to place something, and each biome composes its
        room out of them. Variety comes from the seed choosing *which*
        arrangement and where, not from jittering the same even spread -- two
        grove rooms differ by having a treeline on different sides and a copse
        in a different corner, which reads as two places rather than two rolls.
        """
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
                if (pos - Vec2(d.x, d.y)).length() < (d.collision_radius if d.blocking else 14) + radius + 6:
                    return False
            return True

        margin = TILE + 20
        #: Nothing solid stands in the middle of a room.
        #:
        #: The centre is where the fight happens, and a copse or a boulder field
        #: that rolled its centre there turns the room into a maze. Props that
        #: can be walked through are unaffected -- flowers in the middle of the
        #: floor are fine and help it read as ground rather than as an arena.
        centre = Vec2(w / 2, h / 2)
        keep_clear = min(w, h) * 0.2

        def put(kind: str, pos: Vec2, blocking: bool, variants: int,
                scale_range: tuple[float, float]) -> bool:
            """One prop, if it fits. Returns whether it landed."""
            scale = scale_range[0] + rng.next_float() * (scale_range[1] - scale_range[0])
            radius = BLOCKING_DECOR.get(kind, 14) if blocking else 0
            if blocking and (pos - centre).length() < keep_clear:
                return False
            if not free(pos, max(radius * scale, 14)):
                return False
            room.decor.append(Decor(kind=kind, x=pos.x, y=pos.y, variant=rng.randint(0, variants - 1),
                                    scale=scale, blocking=blocking, radius=radius, flip=rng.chance(0.5)))
            return True

        def anywhere() -> Vec2:
            return Vec2(rng.randint(margin, w - margin), rng.randint(margin, h - margin))

        def scatter(kind: str, count: int, blocking: bool = False, variants: int = 3,
                    scale_range: tuple[float, float] = (0.85, 1.2)) -> None:
            """Even litter. Right for the small things that really are everywhere."""
            placed = attempts = 0
            while placed < count and attempts < count * 12:
                attempts += 1
                if put(kind, anywhere(), blocking, variants, scale_range):
                    placed += 1

        def clump(kind: str, clusters: int, per_cluster: int, spread: float,
                  blocking: bool = False, variants: int = 3,
                  scale_range: tuple[float, float] = (0.85, 1.2),
                  centres: list[Vec2] | None = None) -> list[Vec2]:
            """A few centres with props gathered around each.

            This is what makes a wood read as a wood: trees come in copses with
            gaps between them, not at even spacing. Returns the centres it used,
            so undergrowth can be gathered around the same ones.
            """
            used: list[Vec2] = []
            for i in range(clusters):
                centre = centres[i] if centres and i < len(centres) else anywhere()
                used.append(centre)
                for _ in range(per_cluster):
                    for _ in range(8):
                        offset = Vec2(rng.randint(-int(spread), int(spread)),
                                      rng.randint(-int(spread), int(spread)))
                        pos = room.clamp(centre + offset, margin)
                        if put(kind, pos, blocking, variants, scale_range):
                            break
            return used

        def row(kind: str, count: int, start: Vec2, step: Vec2, jitter: float = 10,
                blocking: bool = True, variants: int = 2,
                scale_range: tuple[float, float] = (0.92, 1.08)) -> None:
            """Evenly spaced along a line, with a little wobble.

            Made things stand in made arrangements: a colonnade, a row of
            graves, a fence. The wobble is small on purpose -- the point is that
            someone put these here.
            """
            for i in range(count):
                pos = room.clamp(
                    start + step * i + Vec2(rng.randint(-int(jitter), int(jitter)),
                                            rng.randint(-int(jitter), int(jitter))),
                    margin)
                put(kind, pos, blocking, variants, scale_range)

        def border(kind: str, count: int, depth: float = TILE * 3.2, blocking: bool = True,
                   variants: int = 3, scale_range: tuple[float, float] = (0.85, 1.2)) -> None:
            """Hugging the walls, framing the room rather than filling it."""
            placed = attempts = 0
            while placed < count and attempts < count * 14:
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

        def beside(kind: str, hosts: tuple[str, ...], count: int, reach: float = 64,
                   blocking: bool = False, variants: int = 2,
                   scale_range: tuple[float, float] = (0.8, 1.1)) -> None:
            """Gathered at the foot of something already standing.

            Rubble belongs under the pillar that shed it and bones belong by the
            coffin they came out of; placed independently they read as two
            unrelated things that happen to be near each other.
            """
            anchors = [Vec2(d.x, d.y) for d in room.decor if d.kind in hosts]
            if not anchors:
                return
            for _ in range(count):
                anchor = anchors[rng.randint(0, len(anchors) - 1)]
                for _ in range(8):
                    offset = Vec2(rng.randint(-int(reach), int(reach)),
                                  rng.randint(-int(reach), int(reach)))
                    if put(kind, room.clamp(anchor + offset, margin), blocking, variants, scale_range):
                        break

        def corners(n: int) -> list[Vec2]:
            """`n` of the room's quadrant centres, in a seeded order.

            Copses and collapses go in corners rather than the middle: the
            middle is where the fight happens, and a room whose centre is full
            is a room you cannot move in.
            """
            spots = [Vec2(w * fx, h * fy) for fx in (0.24, 0.76) for fy in (0.24, 0.76)]
            for i in range(len(spots) - 1, 0, -1):
                j = rng.randint(0, i)
                spots[i], spots[j] = spots[j], spots[i]
            return spots[:n]

        biome = room.biome
        if biome == "grove":
            self._dress_grove(template, rng, area, w, h, clump, row, border, beside, scatter, corners)
        elif biome == "ruins":
            self._dress_ruins(template, rng, area, w, h, clump, row, border, beside, scatter, corners)
        elif biome == "sandbox":
            pass    # The Proving is bare on purpose; see `world/sandbox.py`.
        else:
            self._dress_crypt(template, rng, area, w, h, clump, row, border, beside, scatter, corners)

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

    # --- what each biome is made of -----------------------------------------------
    #
    # Each of these composes one room out of the primitives above. They are kept
    # apart from `_place_decor` because they are the *design* of a place, and
    # the machinery that puts a prop down is not.

    def _dress_grove(self, template, rng, area, w, h, clump, row, border, beside, scatter, corners) -> None:
        """A clearing in a wood: trees at the edges, copses inland, litter between.

        The treeline is the silhouette and it goes around the outside, so the
        middle stays open enough to fight in. What varies between two grove
        rooms is which corners the copses take and whether anyone has been here.
        """
        density = template.tree_density
        # The treeline. Big trees first so the smaller ones fill in around them.
        border("tree_big", int(4 * area * density), depth=TILE * 3.0, variants=2, scale_range=(0.95, 1.25))
        border("tree", int(8 * area * density), depth=TILE * 3.6, variants=3, scale_range=(0.85, 1.15))

        # One or two copses inland, in corners rather than the middle.
        copses = clump("tree", max(1, int(2 * area)), rng.randint(2, 4), 92,
                       blocking=True, variants=3, scale_range=(0.85, 1.1),
                       centres=corners(2))
        # Undergrowth gathers where the trees are, not evenly across the floor.
        clump("bush", len(copses), rng.randint(2, 4), 104, variants=3, centres=copses)
        clump("fern_clump", len(copses), rng.randint(2, 3), 88, variants=1, centres=copses)
        beside("mushrooms", ("tree", "tree_big", "fallen_trunk", "stump"),
               int(4 * area * template.flora_density), reach=56, variants=2)

        # Boulders in their own small field, away from the trees.
        clump("rock", 1, rng.randint(2, 4), 80, blocking=True, variants=3)
        beside("moss_rock", ("rock",), int(2 * area * template.rock_density), reach=70, blocking=True, variants=1)

        # Reeds come in one wet patch rather than one at a time.
        clump("reeds", 1, rng.randint(3, 5), 70, variants=1, scale_range=(0.85, 1.2))

        # Someone was here once. One trace per room at most, so it stays a trace.
        trace = rng.randint(0, 3)
        if trace == 0:
            # A fence, going nowhere, with the wheel that lost its cart.
            side = rng.choice((-1, 1))
            start = Vec2(w * (0.5 + side * 0.28), h * 0.3)
            row("fence_post", rng.randint(3, 5), start, Vec2(0, 88), jitter=8, variants=1)
            beside("cart_wheel", ("fence_post",), 1, reach=70, blocking=True, variants=1)
        elif trace == 1:
            # A felled tree and the stump it came off.
            centres = clump("fallen_trunk", 1, 1, 30, blocking=True, variants=1, scale_range=(0.9, 1.1))
            clump("stump", 1, rng.randint(1, 2), 96, blocking=True, variants=1, centres=centres)
        elif trace == 2:
            clump("berry_bush", 1, rng.randint(2, 3), 76, variants=1)

        if template.ruin_density > 0:
            clump("broken_pillar", 1, rng.randint(2, 3), 88, blocking=True, variants=2)

        # Ground litter last, filling whatever is left.
        scatter("flowers", int(12 * area * template.flora_density), variants=4, scale_range=(0.7, 1.1))
        scatter("grass_tuft", int(22 * area * template.flora_density), variants=3, scale_range=(0.7, 1.2))
        scatter("log", int(1 * area), blocking=True, variants=1)

    def _dress_ruins(self, template, rng, area, w, h, clump, row, border, beside, scatter, corners) -> None:
        """Something built, and falling down.

        The colonnade is the spine of the room: a straight run of pillars that
        says a building stood here. Everything else is either still standing in
        relation to it or lying at its feet.
        """
        density = template.ruin_density
        # The colonnade. Down one side, or across, so the room has an axis.
        if density > 0:
            count = max(3, int(5 * area * density))
            if rng.chance(0.5):
                start = Vec2(w * rng.choice((0.22, 0.78)), h * 0.22)
                row("pillar", count, start, Vec2(0, (h * 0.56) / max(1, count - 1)), variants=2)
            else:
                start = Vec2(w * 0.2, h * rng.choice((0.24, 0.76)))
                row("pillar", count, start, Vec2((w * 0.6) / max(1, count - 1), 0), variants=2)
            # The half of it that fell, at the foot of what still stands.
            beside("broken_pillar", ("pillar",), max(2, int(3 * area * density)), reach=96,
                   blocking=True, variants=2)
            beside("column_fallen", ("pillar", "broken_pillar"), int(2 * area * density), reach=110,
                   blocking=True, variants=1)
            beside("rubble", ("pillar", "broken_pillar", "column_fallen"),
                   int(8 * area), reach=86, variants=3)

        # One focal ruin in a corner: an arch, a stair to nowhere, a statue.
        focus = corners(2)
        if density > 0:
            clump("arch_broken", 1, 1, 24, blocking=True, variants=1, centres=focus[:1])
            clump("stair_fragment", 1, 1, 24, blocking=True, variants=1, centres=focus[1:2])
        clump("statue", 1, 1, 30, blocking=True, variants=1)
        beside("bannered_rubble", ("statue", "arch_broken"), int(2 * area), reach=90, variants=1)

        # What people left in it: crates and urns together, a bench on its own.
        stores = clump("crate", 1, rng.randint(2, 3), 74, blocking=True, variants=2)
        clump("urn_cracked", 1, rng.randint(1, 3), 68, blocking=True, variants=1, centres=stores)
        clump("stone_bench", 1, rng.randint(1, 2), 120, blocking=True, variants=1)

        # The wood taking it back, at the edges.
        border("tree", int(3 * area * template.tree_density), depth=TILE * 2.6, variants=3)
        clump("rock_big", 1, rng.randint(1, 2), 90, blocking=True, variants=2)
        scatter("rock", int(3 * area * template.rock_density), blocking=True, variants=3)
        scatter("grass_tuft", int(10 * area * template.flora_density), variants=3)
        scatter("bones", int(3 * area), variants=2)

    def _dress_crypt(self, template, rng, area, w, h, clump, row, border, beside, scatter, corners) -> None:
        """Somewhere people were put, and the things that grew in after.

        Graves come in rows because someone dug them in rows. Everything dead is
        arranged; everything alive -- roots, webs -- is not, and comes in from
        the walls.
        """
        density = template.ruin_density
        if density > 0:
            count = max(3, int(5 * area * density))
            start = Vec2(w * 0.2, h * rng.choice((0.26, 0.74)))
            row("pillar", count, start, Vec2((w * 0.6) / max(1, count - 1), 0), variants=2)

        # Two short rows of graves, offset from each other, like a plot.
        rows = rng.randint(2, 3)
        for i in range(rows):
            start = Vec2(w * (0.24 + i * 0.13), h * 0.3 + rng.randint(-40, 40))
            row("gravestone", rng.randint(2, 4), start, Vec2(0, 96), jitter=14, variants=3,
                scale_range=(0.9, 1.1))

        # The ones that did not stay buried.
        coffins = clump("coffin_cracked", 1, rng.randint(1, 2), 96, blocking=True, variants=1)
        beside("bone_pile", ("coffin_cracked", "gravestone"), int(4 * area), reach=78, variants=1)
        beside("skull_stack", ("coffin_cracked",), int(2 * area), reach=70, blocking=True, variants=1)
        beside("bones", ("gravestone", "coffin_cracked"), int(5 * area), reach=88, variants=2)

        # A place someone knelt: a sarcophagus with candles around it.
        tombs = clump("sarcophagus", 1, 1, 30, blocking=True, variants=1)
        clump("candle_cluster", len(tombs), rng.randint(2, 3), 74, variants=1, centres=tombs)
        beside("candles", ("sarcophagus", "gravestone"), int(4 * area), reach=80, variants=2)
        clump("rune_stone", 1, 1, 40, blocking=True, variants=1, centres=corners(1))
        clump("iron_cage", 1, 1, 36, blocking=True, variants=1)

        # What grew in through the walls.
        border("cobweb", int(4 * area), depth=TILE * 2.2, blocking=False, variants=1,
               scale_range=(0.8, 1.2))
        border("hanging_chain", int(3 * area), depth=TILE * 2.0, blocking=False, variants=1)
        border("root_intrusion", int(3 * area), depth=TILE * 2.6, blocking=False, variants=1)

        clump("brazier", 1, rng.randint(1, 2), 110, blocking=True, variants=1)
        clump("statue", 1, 1, 40, blocking=True, variants=1)
        beside("rubble", ("pillar", "statue", "sarcophagus"), int(8 * area), reach=90, variants=3)
        scatter("rock_big", int(1 * area * template.rock_density), blocking=True, variants=2)



__all__ = ["DungeonGenerator", "DungeonRun", "T_GRASS", "T_WALL", "T_PATH", "T_STONE", "T_DIRT", "T_WATER"]
