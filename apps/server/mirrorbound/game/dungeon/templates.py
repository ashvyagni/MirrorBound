"""Handcrafted room pieces the generator arranges.

A template fixes the things a designer wants to control — shape, where enemies
stand, where the doors are, what the room is called — and leaves floor
variation and decoration to seeded procedural placement.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DungeonKind(Enum):
    """What kind of place a dungeon is, and therefore how it plays.

    §8 asks for three archetypes whose *gameplay loops* differ -- explicitly not
    "the same rooms with different enemies". The difference is in what a room
    asks of you and what opens its far door:

        COMBAT   the door opens when the room is clear. Escalating encounters,
                 arenas, something heavy at the bottom. The question is the fight.
        PUZZLE   the door opens when you work out what opens it. Switches behind
                 hazards, keys in side rooms, very few creatures. The question is
                 the room.
        MIRROR   both, plus rooms that are not straightforward: doors that need
                 two switches at once, and the shard-lit halls near the Sanctum.
    """
    COMBAT = "combat"
    PUZZLE = "puzzle"
    MIRROR = "mirror"


class RoomType(Enum):
    ENTRANCE = "entrance"
    COMBAT = "combat"
    EXPLORATION = "exploration"
    TREASURE = "treasure"
    EVENT = "event"
    #: A room whose far door is opened by a switch rather than by a fight.
    PUZZLE = "puzzle"
    #: A room off the main chain: optional, and worth the detour.
    SIDE = "side"
    ELITE = "elite"
    GUARDIAN = "guardian"
    BOSS = "boss"
    VILLAGE = "village"


@dataclass(frozen=True)
class SpawnSpec:
    enemy_type: str
    # Fractions of room width/height, so a template works at any size.
    fx: float
    fy: float


@dataclass(frozen=True)
class RoomTemplate:
    name: str
    room_type: RoomType
    width: int
    height: int
    spawns: tuple[SpawnSpec, ...] = ()
    # Fractional positions for chests / treasure pickups.
    treasure: tuple[tuple[str, float, float], ...] = ()
    # Decor density multipliers per category.
    tree_density: float = 1.0
    rock_density: float = 1.0
    ruin_density: float = 0.0
    flora_density: float = 1.0
    torches: int = 4
    has_water: bool = False
    title_pool: tuple[str, ...] = ("Hall",)
    #: Where the plates sit, as fractions of the room. A puzzle room's far door
    #: waits on all of them.
    switches: tuple[tuple[float, float], ...] = ()
    #: Whether the way on is locked until every switch here is thrown.
    #:
    #: This is what makes a puzzle room a puzzle room rather than a combat room
    #: with scenery: clearing it does not open the door.
    gated_by_switches: bool = False
    #: A key left in this room, for a door further in.
    key: str = ""
    #: A door this room's far exit waits on a key for.
    needs_key: str = ""


ENTRANCE = RoomTemplate(
    name="entrance_clearing", room_type=RoomType.ENTRANCE, width=1280, height=960,
    tree_density=1.4, rock_density=0.6, flora_density=1.6, torches=2, has_water=True,
    title_pool=("Wakewood Clearing", "The Mossy Threshold"),
)

COMBAT_GLADE = RoomTemplate(
    name="combat_glade", room_type=RoomType.COMBAT, width=1280, height=960,
    spawns=(
        SpawnSpec("skeleton", 0.25, 0.30), SpawnSpec("skeleton", 0.72, 0.30),
        SpawnSpec("hound", 0.50, 0.22), SpawnSpec("archer", 0.50, 0.62),
    ),
    tree_density=1.0, rock_density=0.8, flora_density=1.0, torches=4,
    title_pool=("Hollow Glade", "Briar Court", "The Thornfield"),
)

COMBAT_RUIN = RoomTemplate(
    name="combat_ruin", room_type=RoomType.COMBAT, width=1600, height=1200,
    spawns=(
        SpawnSpec("skeleton", 0.22, 0.32), SpawnSpec("skeleton", 0.78, 0.32),
        SpawnSpec("archer", 0.50, 0.24), SpawnSpec("slime", 0.36, 0.66),
        SpawnSpec("hound", 0.64, 0.66), SpawnSpec("hound", 0.50, 0.44),
    ),
    tree_density=0.4, rock_density=1.0, ruin_density=1.3, flora_density=0.5, torches=6,
    title_pool=("Sunken Colonnade", "Ruined Antechamber", "Hall of Fallen Kings"),
)

EXPLORATION_GROVE = RoomTemplate(
    name="exploration_grove", room_type=RoomType.EXPLORATION, width=1600, height=1120,
    spawns=(SpawnSpec("hound", 0.78, 0.26), SpawnSpec("skeleton", 0.30, 0.70),
            SpawnSpec("sprout", 0.18, 0.40)),
    treasure=(("essence", 0.16, 0.24), ("essence", 0.84, 0.72), ("health_potion", 0.50, 0.14), ("shards", 0.14, 0.78)),
    tree_density=1.8, rock_density=0.9, flora_density=2.0, torches=3, has_water=True,
    title_pool=("Whisperfen", "The Drowned Orchard", "Lanternmoss Reach"),
)

TREASURE_VAULT = RoomTemplate(
    name="treasure_vault", room_type=RoomType.TREASURE, width=960, height=768,
    spawns=(SpawnSpec("skeleton", 0.50, 0.32),),
    treasure=(("chest", 0.50, 0.50), ("shards", 0.30, 0.55), ("shards", 0.70, 0.55), ("mana_potion", 0.50, 0.72)),
    tree_density=0.0, rock_density=0.5, ruin_density=1.6, flora_density=0.3, torches=6,
    title_pool=("The Reliquary", "Vault of Quiet Gold"),
)

ELITE_ARENA = RoomTemplate(
    name="elite_arena", room_type=RoomType.ELITE, width=1280, height=960,
    spawns=(
        SpawnSpec("elite_skeleton", 0.50, 0.32), SpawnSpec("archer", 0.24, 0.30),
        SpawnSpec("archer", 0.76, 0.30), SpawnSpec("slime", 0.50, 0.64),
    ),
    tree_density=0.2, rock_density=0.8, ruin_density=1.8, flora_density=0.3, torches=8,
    title_pool=("The Bone Court", "Champion's Ring"),
)

BOSS_MIRROR = RoomTemplate(
    name="boss_mirror", room_type=RoomType.BOSS, width=1600, height=1200,
    spawns=(SpawnSpec("mirror", 0.50, 0.34),),
    tree_density=0.0, rock_density=0.3, ruin_density=2.2, flora_density=0.1, torches=10,
    title_pool=("The Mirror Sanctum",),
)

SWARM_NEST = RoomTemplate(
    # The scarabs' room. Nothing here is dangerous on its own, which is the
    # point: the room is about where you stand, not what you kill first.
    name="swarm_nest", room_type=RoomType.COMBAT, width=1280, height=960,
    spawns=(
        SpawnSpec("scarab", 0.20, 0.24), SpawnSpec("scarab", 0.35, 0.20),
        SpawnSpec("scarab", 0.50, 0.18), SpawnSpec("scarab", 0.65, 0.20),
        SpawnSpec("scarab", 0.80, 0.24), SpawnSpec("scarab", 0.28, 0.58),
        SpawnSpec("scarab", 0.72, 0.58), SpawnSpec("brute", 0.50, 0.40),
    ),
    tree_density=0.3, rock_density=1.2, ruin_density=1.0, flora_density=0.4, torches=5,
    title_pool=("The Husk Nest", "Chitin Hollow"),
)

THICKET_AMBUSH = RoomTemplate(
    # The sprouts' room. They notice you at 130 units where everything else in
    # the game notices you at three hundred, so the dressing is the mechanic:
    # this is the densest flora of any template on purpose, and what looks like
    # scenery is standing in it. One spitter at the back, so hugging the wall
    # away from the undergrowth is not a free answer either.
    name="thicket_ambush", room_type=RoomType.COMBAT, width=1280, height=1120,
    spawns=(
        SpawnSpec("sprout", 0.22, 0.30), SpawnSpec("sprout", 0.74, 0.34),
        SpawnSpec("sprout", 0.38, 0.66), SpawnSpec("sprout", 0.66, 0.70),
        SpawnSpec("spitter", 0.50, 0.18),
    ),
    tree_density=1.6, rock_density=0.5, flora_density=2.6, torches=3,
    title_pool=("The Bitterthicket", "Snaproot Hollow"),
)

KILN_TERRACE = RoomTemplate(
    # The shardling's room, and the only place in the game that throws a spread
    # at you. Open floor with ruin cover: the fan cannot be sidestepped, so the
    # room has to offer something to get behind, or the answer would only ever
    # be "walk backwards". Two spitters make standing behind that cover cost
    # something as well.
    name="kiln_terrace", room_type=RoomType.COMBAT, width=1600, height=1120,
    spawns=(
        SpawnSpec("shardling", 0.50, 0.28), SpawnSpec("spitter", 0.20, 0.22),
        SpawnSpec("spitter", 0.80, 0.22), SpawnSpec("skeleton", 0.36, 0.60),
        SpawnSpec("skeleton", 0.64, 0.60),
    ),
    tree_density=0.2, rock_density=1.4, ruin_density=1.8, flora_density=0.3, torches=6,
    title_pool=("The Firing Terrace", "Kiln Yard", "The Cracked Ambry"),
)


COMBAT_SANCTUM = RoomTemplate(
    # Acolytes behind a brute: the ranged control problem, with something in
    # front of it that punishes walking straight at the casters.
    name="combat_sanctum", room_type=RoomType.COMBAT, width=1600, height=1120,
    spawns=(
        SpawnSpec("acolyte", 0.28, 0.24), SpawnSpec("acolyte", 0.72, 0.24),
        SpawnSpec("brute", 0.50, 0.42), SpawnSpec("skeleton", 0.36, 0.62),
        SpawnSpec("skeleton", 0.64, 0.62),
    ),
    tree_density=0.0, rock_density=0.6, ruin_density=2.0, flora_density=0.2, torches=8,
    title_pool=("The Ash Sanctum", "Choir of Cinders"),
)

# --- puzzle rooms -------------------------------------------------------------
#
# Almost nothing to fight. What stops you is the room: the plates are in the
# corners behind the standing water and the collapsed stone, so the work is
# reading the floor and getting to them, and the creatures that are here exist
# to make standing still while you think about it a bad idea.

CISTERN_FLOOR = RoomTemplate(
    name="cistern_floor", room_type=RoomType.PUZZLE, width=1600, height=1120,
    spawns=(SpawnSpec("spitter", 0.50, 0.16),),
    switches=((0.14, 0.24), (0.86, 0.24)),
    gated_by_switches=True,
    tree_density=0.0, rock_density=1.2, ruin_density=1.6, flora_density=0.2,
    torches=8, has_water=True,
    title_pool=("The Cistern Floor", "The Standing Water"),
)

TALLY_HALL = RoomTemplate(
    # Three plates, one of them behind the only thing in the room that hits
    # hard. You can take the fight or you can take the long way round it.
    name="tally_hall", room_type=RoomType.PUZZLE, width=1600, height=1200,
    spawns=(SpawnSpec("brute", 0.50, 0.30), SpawnSpec("scarab", 0.20, 0.62),
            SpawnSpec("scarab", 0.80, 0.62)),
    switches=((0.12, 0.18), (0.88, 0.18), (0.50, 0.80)),
    gated_by_switches=True,
    tree_density=0.0, rock_density=0.8, ruin_density=2.0, flora_density=0.1, torches=10,
    title_pool=("The Tally Hall", "Hall of the Count"),
)

LOCKPLATE_STAIR = RoomTemplate(
    # The door here wants a key, and the key is in the side room off it.
    name="lockplate_stair", room_type=RoomType.PUZZLE, width=1280, height=1120,
    spawns=(SpawnSpec("acolyte", 0.28, 0.24), SpawnSpec("acolyte", 0.72, 0.24)),
    needs_key="barrow_key",
    tree_density=0.0, rock_density=0.6, ruin_density=1.8, flora_density=0.1, torches=8,
    title_pool=("The Lockplate Stair", "The Barred Descent"),
)

#: Rooms off the main chain: optional, and the reason to look.
#:
#: §10 asks for branching, optional rooms and secrets, and §23 asks that finding
#: one be worth it. A side room is short, has something in it, and is never on
#: the way to anywhere -- so taking it is a decision rather than a corridor.

SIDE_VAULT = RoomTemplate(
    name="side_vault", room_type=RoomType.SIDE, width=960, height=768,
    spawns=(SpawnSpec("skeleton", 0.50, 0.30),),
    treasure=(("chest", 0.50, 0.52), ("shards", 0.28, 0.58), ("shards", 0.72, 0.58)),
    tree_density=0.0, rock_density=0.5, ruin_density=1.6, flora_density=0.2, torches=6,
    title_pool=("The Keyward", "A Walled Cell"),
)

SIDE_OSSUARY = RoomTemplate(
    name="side_ossuary", room_type=RoomType.SIDE, width=960, height=768,
    spawns=(SpawnSpec("scarab", 0.30, 0.30), SpawnSpec("scarab", 0.70, 0.30),
            SpawnSpec("skeleton", 0.50, 0.58)),
    treasure=(("essence", 0.32, 0.62), ("shards", 0.68, 0.62), ("mana_potion", 0.50, 0.36)),
    tree_density=0.0, rock_density=0.4, ruin_density=1.4, flora_density=0.1, torches=5,
    title_pool=("The Ossuary", "The Quiet Shelf"),
)

# --- mirror rooms --------------------------------------------------------------

SHARDLIGHT_HALL = RoomTemplate(
    # The mirror archetype's own room: a fight *and* a lock, so neither answer
    # is enough on its own. Two plates at opposite ends, and a shardling in the
    # middle that punishes crossing the room in a straight line.
    name="shardlight_hall", room_type=RoomType.PUZZLE, width=1600, height=1200,
    spawns=(SpawnSpec("shardling", 0.50, 0.44), SpawnSpec("acolyte", 0.22, 0.24),
            SpawnSpec("acolyte", 0.78, 0.24)),
    switches=((0.10, 0.70), (0.90, 0.70)),
    gated_by_switches=True,
    tree_density=0.0, rock_density=0.4, ruin_density=2.2, flora_density=0.0, torches=12,
    title_pool=("The Shardlight Hall", "Hall of Facets"),
)

WARDEN_GATE = RoomTemplate(
    # The Warden calls its own help now, in its second phase, so the room no
    # longer opens with two scarabs already standing in it -- the summon is the
    # beat, and pre-placing them spends it before the fight starts.
    name="warden_gate", room_type=RoomType.GUARDIAN, width=1440, height=1080,
    spawns=(SpawnSpec("warden", 0.50, 0.34),),
    tree_density=0.0, rock_density=0.5, ruin_density=2.0, flora_density=0.1, torches=10,
    title_pool=("The Warden's Gate",),
)

BARROW_TALLY = RoomTemplate(
    # The Stonecount's. Open in the middle with cover at the edges, because the
    # fight is about the adds: you need somewhere to put your back and a reason
    # not to stand there forever.
    name="barrow_tally", room_type=RoomType.GUARDIAN, width=1440, height=1120,
    spawns=(SpawnSpec("stonecount", 0.50, 0.30),),
    tree_density=0.0, rock_density=0.6, ruin_density=2.2, flora_density=0.0, torches=9,
    title_pool=("The Last Stone", "Where the Count Is Kept"),
)

SHARDMOTHER_KILN = RoomTemplate(
    # The Shardmother's. Pillars, deliberately: the fan cannot be sidestepped,
    # so a room with nothing to get behind would only ever be a race.
    name="shardmother_kiln", room_type=RoomType.GUARDIAN, width=1600, height=1200,
    spawns=(SpawnSpec("shardmother", 0.50, 0.28),),
    tree_density=0.0, rock_density=0.4, ruin_density=2.6, flora_density=0.0, torches=12,
    title_pool=("The Firing Chamber", "The Mother Kiln"),
)

#: The combat room the game teaches fighting in.
#:
#: Four enemies, no brute, and one of each role -- two chargers, a darter and a
#: shooter -- so the first fight shows what the archetypes are without needing
#: an answer to all of them at once. Any combat room may roll any template
#: except this one case: the first fight of a run is taken alone, at level one,
#: with a starter sword and whatever potions were bought, and it comes *before*
#: the twin is found. Rolling the five-enemy sanctum there is the difference
#: between a tutorial and a wall.
TUTORIAL_COMBAT = COMBAT_GLADE

TEMPLATES: dict[RoomType, tuple[RoomTemplate, ...]] = {
    RoomType.ENTRANCE: (ENTRANCE,),
    RoomType.COMBAT: (COMBAT_GLADE, COMBAT_RUIN, SWARM_NEST, COMBAT_SANCTUM,
                      THICKET_AMBUSH, KILN_TERRACE),
    RoomType.EXPLORATION: (EXPLORATION_GROVE,),
    RoomType.TREASURE: (TREASURE_VAULT,),
    RoomType.EVENT: (EXPLORATION_GROVE,),
    RoomType.PUZZLE: (CISTERN_FLOOR, TALLY_HALL, LOCKPLATE_STAIR, SHARDLIGHT_HALL),
    RoomType.SIDE: (SIDE_VAULT, SIDE_OSSUARY),
    RoomType.ELITE: (ELITE_ARENA,),
    RoomType.GUARDIAN: (WARDEN_GATE, BARROW_TALLY, SHARDMOTHER_KILN),
    RoomType.BOSS: (BOSS_MIRROR,),
}

#: Guardian rooms by name, so a dungeon can ask for its own.
GUARDIAN_ROOMS: dict[str, RoomTemplate] = {
    t.name: t for t in TEMPLATES[RoomType.GUARDIAN]
}

# The vertical slice's fixed progression (section 12 of the directive).
DEFAULT_SEQUENCE: tuple[RoomType, ...] = (
    RoomType.ENTRANCE, RoomType.COMBAT, RoomType.EXPLORATION, RoomType.TREASURE,
    RoomType.COMBAT, RoomType.ELITE, RoomType.BOSS,
)


def biome_for(index: int, total: int) -> str:
    """Grove near the surface, ruins in the middle, crypt at the bottom."""
    frac = index / max(1, total - 1)
    if frac < 0.4:
        return "grove"
    if frac < 0.8:
        return "ruins"
    return "crypt"


def get_random_template(room_type: RoomType, rng) -> RoomTemplate:
    templates = TEMPLATES.get(room_type)
    if not templates:
        raise ValueError(f"No templates for room type: {room_type}")
    return rng.choice(templates)


__all__ = [
    "DEFAULT_SEQUENCE",
    "DungeonKind",
    "GUARDIAN_ROOMS",
    "TEMPLATES",
    "TUTORIAL_COMBAT",
    "RoomTemplate",
    "RoomType",
    "SpawnSpec",
    "biome_for",
    "get_random_template",
]
