"""Authoritative game state container."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.core.clock import SimClock
from mirrorbound.game.core.events import EventBus
from mirrorbound.game.core.ids import IdAllocator
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.player import Player, PlayerInput
from mirrorbound.game.entities.twin import Twin
from mirrorbound.game.entities.enemy import Enemy, EnemyDef
from mirrorbound.game.entities.projectile import Projectile
from mirrorbound.game.entities.entity import Vec2


@dataclass
class Room:
    """Room in the dungeon."""
    width: int = 1280
    height: int = 960
    room_type: str = "combat"
    tiles: list[list[int]] = field(default_factory=list)
    door_positions: list[Vec2] = field(default_factory=list)

    def __post_init__(self):
        if not self.tiles:
            # Initialize empty floor
            self.tiles = [[0 for _ in range(self.width // 32)] for _ in range(self.height // 32)]

    def is_wall(self, x: float, y: float) -> bool:
        """Check if position is inside wall bounds."""
        wall_thickness = 16
        return (
            x < wall_thickness or
            x > self.width - wall_thickness or
            y < wall_thickness or
            y > self.height - wall_thickness
        )

    def to_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "roomType": self.room_type,
            "tiles": self.tiles,
        }


@dataclass
class GameState:
    """Authoritative game state owned by the server."""
    tick: int = 0
    seed: int = 0
    rng: DeterministicRNG = field(default_factory=lambda: DeterministicRNG(0))
    clock: SimClock = field(default_factory=SimClock)
    ids: IdAllocator = field(default_factory=IdAllocator)
    bus: EventBus = field(default_factory=EventBus)

    player: Player = field(default_factory=lambda: Player(id="player_1"))
    twin: Twin = field(default_factory=lambda: Twin(id="twin_1"))
    enemies: list[Enemy] = field(default_factory=list)
    projectiles: list[Projectile] = field(default_factory=list)
    room: Room = field(default_factory=Room)

    def __post_init__(self):
        self.rng = DeterministicRNG(self.seed)
        self.player.position = Vec2(640, 480)
        self.twin.position = Vec2(600, 500)

    def spawn_enemies(self, count: int = 3) -> None:
        """Spawn enemies in the room."""
        combat_rng = self.rng.spawn("enemies")
        for _ in range(count):
            enemy_id = self.ids.next("enemy")
            # Random position avoiding walls
            x = combat_rng.randint(100, self.room.width - 100)
            y = combat_rng.randint(100, self.room.height - 100)

            # Random archetype
            archetypes = [
                EnemyDef.skeleton(),
                EnemyDef.slime(),
                EnemyDef.ranged_skeleton(),
            ]
            enemy_def = combat_rng.choice(archetypes)

            enemy = Enemy(
                id=enemy_id,
                position=Vec2(x, y),
                enemy_def=enemy_def,
            )
            self.enemies.append(enemy)

    def get_active_enemies(self) -> list[Enemy]:
        """Get all active enemies."""
        return [e for e in self.enemies if e.active]

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "player": self.player.to_dict(),
            "twin": self.twin.to_dict(),
            "enemies": [e.to_dict() for e in self.get_active_enemies()],
            "room": self.room.to_dict(),
        }
