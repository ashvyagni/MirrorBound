"""Room templates for dungeon generation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from mirrorbound.game.entities.entity import Vec2


class RoomType(Enum):
    """Types of rooms in the dungeon."""
    ENTRANCE = "entrance"
    COMBAT = "combat"
    TREASURE = "treasure"
    ELITE = "elite"
    BOSS = "boss"


@dataclass
class EnemySpawn:
    """Enemy spawn point."""
    enemy_type: str  # "skeleton", "slime", "ranged_skeleton"
    position: Vec2


@dataclass
class RoomTemplate:
    """Template for a room layout."""
    name: str
    width: int
    height: int
    room_type: RoomType
    enemy_spawns: list[EnemySpawn]
    player_spawn: Vec2
    twin_spawn: Vec2
    door_positions: list[Vec2]


# Room templates
ENTRANCE_ROOM = RoomTemplate(
    name="entrance",
    width=1280,
    height=960,
    room_type=RoomType.ENTRANCE,
    enemy_spawns=[],
    player_spawn=Vec2(640, 480),
    twin_spawn=Vec2(600, 500),
    door_positions=[Vec2(640, 16), Vec2(640, 944)],
)

COMBAT_ROOM_SMALL = RoomTemplate(
    name="combat_small",
    width=1280,
    height=960,
    room_type=RoomType.COMBAT,
    enemy_spawns=[
        EnemySpawn("skeleton", Vec2(300, 300)),
        EnemySpawn("skeleton", Vec2(900, 300)),
        EnemySpawn("slime", Vec2(640, 600)),
    ],
    player_spawn=Vec2(640, 800),
    twin_spawn=Vec2(600, 820),
    door_positions=[Vec2(640, 16), Vec2(640, 944)],
)

COMBAT_ROOM_LARGE = RoomTemplate(
    name="combat_large",
    width=1600,
    height=1200,
    room_type=RoomType.COMBAT,
    enemy_spawns=[
        EnemySpawn("skeleton", Vec2(400, 400)),
        EnemySpawn("skeleton", Vec2(1200, 400)),
        EnemySpawn("ranged_skeleton", Vec2(800, 300)),
        EnemySpawn("slime", Vec2(600, 800)),
        EnemySpawn("slime", Vec2(1000, 800)),
    ],
    player_spawn=Vec2(800, 1000),
    twin_spawn=Vec2(760, 1020),
    door_positions=[Vec2(800, 16), Vec2(800, 1184)],
)

TREASURE_ROOM = RoomTemplate(
    name="treasure",
    width=960,
    height=720,
    room_type=RoomType.TREASURE,
    enemy_spawns=[
        EnemySpawn("skeleton", Vec2(480, 360)),
    ],
    player_spawn=Vec2(480, 600),
    twin_spawn=Vec2(440, 620),
    door_positions=[Vec2(480, 16)],
)

ELITE_ROOM = RoomTemplate(
    name="elite",
    width=1280,
    height=960,
    room_type=RoomType.ELITE,
    enemy_spawns=[
        EnemySpawn("ranged_skeleton", Vec2(300, 300)),
        EnemySpawn("ranged_skeleton", Vec2(900, 300)),
        EnemySpawn("slime", Vec2(640, 500)),
    ],
    player_spawn=Vec2(640, 800),
    twin_spawn=Vec2(600, 820),
    door_positions=[Vec2(640, 16), Vec2(640, 944)],
)

BOSS_ROOM = RoomTemplate(
    name="boss",
    width=1600,
    height=1200,
    room_type=RoomType.BOSS,
    enemy_spawns=[
        EnemySpawn("slime", Vec2(800, 400)),  # Boss placeholder
    ],
    player_spawn=Vec2(800, 1000),
    twin_spawn=Vec2(760, 1020),
    door_positions=[Vec2(800, 16)],
)

# Template registry
ROOM_TEMPLATES: dict[RoomType, list[RoomTemplate]] = {
    RoomType.ENTRANCE: [ENTRANCE_ROOM],
    RoomType.COMBAT: [COMBAT_ROOM_SMALL, COMBAT_ROOM_LARGE],
    RoomType.TREASURE: [TREASURE_ROOM],
    RoomType.ELITE: [ELITE_ROOM],
    RoomType.BOSS: [BOSS_ROOM],
}


def get_random_template(room_type: RoomType, rng) -> RoomTemplate:
    """Get a random template for the given room type."""
    templates = ROOM_TEMPLATES.get(room_type, [])
    if not templates:
        raise ValueError(f"No templates for room type: {room_type}")
    return rng.choice(templates)
