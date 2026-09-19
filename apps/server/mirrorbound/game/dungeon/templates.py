"""Handcrafted room pieces the generator arranges.

A template fixes the things a designer wants to control — shape, where enemies
stand, where the doors are, what the room is called — and leaves floor
variation and decoration to seeded procedural placement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from mirrorbound.game.entities.entity import Vec2


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
    # A role from ENEMY_ROLES (resolved per biome), or a literal archetype id.
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


# --- who lives where ------------------------------------------------------------
# docs/art-prompts-2.md designs eleven creatures as a role-by-biome matrix: each
# biome fields its own small/broad/tall/flat silhouette so three mobs on one
# screen are told apart by mass. Templates therefore name a *role*, not a
# creature, and generation resolves it against the room's biome -- so the same
# handcrafted layout fights sprouts in the grove and skeletons in the crypt.

ENEMY_ROLES = ("melee", "tank", "ranged", "fast")

BIOME_ROSTER: dict[str, dict[str, str]] = {
    "grove": {"melee": "sprout", "tank": "brute", "ranged": "spitter",
              # The grove has no fourth silhouette in the design ("—" in the
              # table), so its quick slot falls back to the sprout.
              "fast": "sprout"},
    # The ruins' heavy is the brute, not the Warden. The Warden is a 420hp
    # elite guardian placed by hand at its own gate; putting it behind a
    # generic `tank` slot would drop a mini-boss into every ruins combat room.
    "ruins": {"melee": "shardling", "tank": "brute", "ranged": "acolyte", "fast": "scarab"},
    "crypt": {"melee": "skeleton", "tank": "slime", "ranged": "archer", "fast": "hound"},
}


def resolve_spawn(enemy_type: str, biome: str) -> str:
    """Turn a template's role slot into this biome's creature for that role.

    A literal archetype id (``mirror``) passes straight through, so a template
    can still pin one exact creature when that is the point. ``elite_`` survives
    the round trip either way.
    """
    elite = enemy_type.startswith("elite_")
    base = enemy_type[len("elite_"):] if elite else enemy_type
    roster = BIOME_ROSTER.get(biome, BIOME_ROSTER["crypt"])
    resolved = roster.get(base, base)
    return f"elite_{resolved}" if elite else resolved


ENTRANCE = RoomTemplate(
    name="entrance_clearing", room_type=RoomType.ENTRANCE, width=1280, height=960,
    tree_density=1.4, rock_density=0.6, flora_density=1.6, torches=2, has_water=True,
    title_pool=("Wakewood Clearing", "The Mossy Threshold"),
)

COMBAT_GLADE = RoomTemplate(
    name="combat_glade", room_type=RoomType.COMBAT, width=1280, height=960,
    spawns=(
        SpawnSpec("melee", 0.25, 0.30), SpawnSpec("melee", 0.72, 0.30),
        SpawnSpec("fast", 0.50, 0.22), SpawnSpec("ranged", 0.50, 0.62),
    ),
    tree_density=1.0, rock_density=0.8, flora_density=1.0, torches=4,
    title_pool=("Hollow Glade", "Briar Court", "The Thornfield"),
)

COMBAT_RUIN = RoomTemplate(
    name="combat_ruin", room_type=RoomType.COMBAT, width=1600, height=1200,
    spawns=(
        SpawnSpec("melee", 0.22, 0.32), SpawnSpec("melee", 0.78, 0.32),
        SpawnSpec("ranged", 0.50, 0.24), SpawnSpec("tank", 0.36, 0.66),
        SpawnSpec("fast", 0.64, 0.66), SpawnSpec("fast", 0.50, 0.44),
    ),
    tree_density=0.4, rock_density=1.0, ruin_density=1.3, flora_density=0.5, torches=6,
    title_pool=("Sunken Colonnade", "Ruined Antechamber", "Hall of Fallen Kings"),
)

EXPLORATION_GROVE = RoomTemplate(
    name="exploration_grove", room_type=RoomType.EXPLORATION, width=1600, height=1120,
    spawns=(SpawnSpec("fast", 0.78, 0.26), SpawnSpec("melee", 0.30, 0.70)),
    treasure=(("essence", 0.16, 0.24), ("essence", 0.84, 0.72), ("health_potion", 0.50, 0.14), ("shards", 0.14, 0.78)),
    tree_density=1.8, rock_density=0.9, flora_density=2.0, torches=3, has_water=True,
    title_pool=("Whisperfen", "The Drowned Orchard", "Lanternmoss Reach"),
)

TREASURE_VAULT = RoomTemplate(
    name="treasure_vault", room_type=RoomType.TREASURE, width=960, height=768,
    spawns=(SpawnSpec("melee", 0.50, 0.32),),
    treasure=(("chest", 0.50, 0.50), ("shards", 0.30, 0.55), ("shards", 0.70, 0.55), ("mana_potion", 0.50, 0.72)),
    tree_density=0.0, rock_density=0.5, ruin_density=1.6, flora_density=0.3, torches=6,
    title_pool=("The Reliquary", "Vault of Quiet Gold"),
)

ELITE_ARENA = RoomTemplate(
    name="elite_arena", room_type=RoomType.ELITE, width=1280, height=960,
    spawns=(
        SpawnSpec("elite_melee", 0.50, 0.32), SpawnSpec("ranged", 0.24, 0.30),
        SpawnSpec("ranged", 0.76, 0.30), SpawnSpec("tank", 0.50, 0.64),
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

TEMPLATES: dict[RoomType, tuple[RoomTemplate, ...]] = {
    RoomType.ENTRANCE: (ENTRANCE,),
    RoomType.COMBAT: (COMBAT_GLADE, COMBAT_RUIN, SWARM_NEST, COMBAT_SANCTUM),
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
    "RoomType", "RoomTemplate", "SpawnSpec", "TEMPLATES", "DEFAULT_SEQUENCE",
    "biome_for", "get_random_template",
]
