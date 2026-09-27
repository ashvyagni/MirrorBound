"""Putting ore in the ground.

One function, used by both the region builder and the dungeon generator, because
a vein should mean the same thing wherever it is: a boulder you stand next to and
work, holding a fixed number of swings' worth of one material.

Where the ore is comes from `materials.VEIN_TABLE`, keyed by a region's terrain
or a dungeon's biome. That is what gives a place an economy — the Kiln Terraces
are where adamantine is, and being the only source of it is most of the reason
to ever walk back up there.

**Veins are re-rolled on every visit**, exactly like the enemies and the caches
already are. Nothing tracks which vein a player has already worked. That is a
deliberate choice rather than an oversight: the alternative is per-area depletion
state in the save, which buys scarcity the cost curve in `training_cost` already
provides, and a world that is permanently mined out is a world with no reason to
be in it. What limits ore is how long it takes to walk somewhere and how little a
deep vein gives up, not a counter.

The art is `stone`'s rock frames, tinted per material by the client. §35 asks for
composition before new assets, and an ore vein seen from above is a rock.
"""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import TILE, T_PATH, T_WALL, T_WATER, Decor, Room, Vein
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.progression.materials import VEIN_TABLE, yield_for

#: How solid a vein is. Matched to the `rockBig` frames it is drawn as.
VEIN_RADIUS = 30.0
#: Margin from the room's own edge, so a vein is never half outside the world.
EDGE_MARGIN = TILE * 3
#: How far apart two veins must be. Below this they read as one lump of rock with
#: two prompts on it.
MIN_SPACING = 190.0


def place_veins(room: Room, place_key: str, rng: DeterministicRNG, count: int,
                settlement=None) -> None:
    """Scatter `count` veins of whatever `place_key`'s ground holds.

    Nothing is placed when the key is unknown, rather than falling back to a
    default table. A biome with no entry is a biome nobody has decided the
    geology of yet, and inventing iron for it would hide that decision instead of
    surfacing it.
    """
    table = VEIN_TABLE.get(place_key)
    if not table:
        return
    materials = [material for material, _ in table]
    weights = [weight for _, weight in table]
    total = sum(weights)
    if total <= 0:
        return

    placed: list[Vec2] = []
    # A bounded number of attempts rather than a while-loop: a small room with a
    # village in most of it can genuinely have nowhere left to put a boulder, and
    # a generator that spins on that is worse than one that places three.
    for attempt in range(count * 12):
        if len(placed) >= count:
            break
        roll = rng.next_float() * total
        material = materials[-1]
        for candidate, weight in zip(materials, weights):
            roll -= weight
            if roll <= 0:
                material = candidate
                break
        pos = Vec2(
            rng.randint(int(EDGE_MARGIN), int(room.width - EDGE_MARGIN)),
            rng.randint(int(EDGE_MARGIN), int(room.height - EDGE_MARGIN)),
        )
        if not _open_ground(room, pos, settlement):
            continue
        if any((pos - other).length() < MIN_SPACING for other in placed):
            continue
        index = len(room.veins)
        amount = yield_for(material)
        room.veins.append(Vein(
            id=f"{room.id}_vein{index}", material=material,
            x=pos.x, y=pos.y, remaining=amount, total=amount,
            radius=VEIN_RADIUS, variant=rng.randint(0, 4),
        ))
        # The rock that makes it solid. Drawn by the client from the vein record,
        # so this decor carries no variant of its own -- it exists to be in the
        # way, which is what makes standing at a vein a position rather than a
        # keypress.
        room.decor.append(Decor(kind="vein", x=pos.x, y=pos.y,
                                blocking=True, radius=VEIN_RADIUS * 0.8))
        placed.append(pos)


def _open_ground(room: Room, pos: Vec2, settlement) -> bool:
    """Whether a boulder can stand here without spoiling something.

    Off the roads, out of the water, clear of the walls, outside the village, and
    not on top of the spot the player arrives on. The last one is the reason this
    is a function: the well landing on the player spawn during v1.1 was exactly
    this mistake made with a different prop, and a boulder there would wedge the
    player into the geometry on arrival.
    """
    if room.tile_at(pos.x, pos.y) in (T_PATH, T_WATER, T_WALL):
        return False
    if settlement is not None and settlement.contains(pos):
        return False
    if (pos - room.player_spawn).length() < 220.0:
        return False
    for door in room.doors:
        if (pos - Vec2(door.x, door.y)).length() < 200.0:
            return False
    for switch in room.switches:
        if (pos - Vec2(switch.x, switch.y)).length() < 140.0:
            return False
    # `Room._blocking_buckets` is stamped on `len(decor)`, so appending a vein's
    # rock invalidates the cache on its own and this query always sees the veins
    # placed before it.
    return not room.is_blocked(pos, VEIN_RADIUS)
