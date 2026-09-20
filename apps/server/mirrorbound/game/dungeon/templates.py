"""Handcrafted room pieces the generator arranges.

A template fixes the things a designer wants to control — shape, where enemies
stand, where the doors are, what the room is called — and leaves floor
variation and decoration to seeded procedural placement.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class RoomType(Enum):
    ENTRANCE = "entrance"
    COMBAT = "combat"
    EXPLORATION = "exploration"
    TREASURE = "treasure"
    EVENT = "event"
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

WARDEN_GATE = RoomTemplate(
    name="warden_gate", room_type=RoomType.GUARDIAN, width=1440, height=1080,
    spawns=(SpawnSpec("warden", 0.50, 0.34), SpawnSpec("scarab", 0.24, 0.30),
            SpawnSpec("scarab", 0.76, 0.30)),
    tree_density=0.0, rock_density=0.5, ruin_density=2.0, flora_density=0.1, torches=10,
    title_pool=("The Warden's Gate",),
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
    RoomType.ELITE: (ELITE_ARENA,),
    RoomType.GUARDIAN: (WARDEN_GATE,),
    RoomType.BOSS: (BOSS_MIRROR,),
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
    "TEMPLATES",
    "TUTORIAL_COMBAT",
    "RoomTemplate",
    "RoomType",
    "SpawnSpec",
    "biome_for",
    "get_random_template",
]
