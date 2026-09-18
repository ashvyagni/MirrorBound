"""Enemy entity with archetypes and basic AI."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from mirrorbound.game.entities.entity import Entity, Vec2


class EnemyBehavior(Enum):
    """How the enemy behaves in combat."""
    CHARGE = "charge"           # Rush at player
    KEEP_DISTANCE = "keep_distance"  # Stay away, shoot
    CIRCLE = "circle"           # Circle strafe
    AMBUSH = "ambush"           # Wait, then attack


class EnemyState(Enum):
    """Current state of the enemy AI."""
    IDLE = "idle"
    CHASE = "chase"
    ATTACK = "attack"
    RETREAT = "retreat"
    DEAD = "dead"


@dataclass
class EnemyDef:
    """Enemy archetype definition."""
    name: str
    health: float
    damage: float
    speed: float
    attack_range: float
    aggro_range: float
    attack_cooldown: float
    behavior: EnemyBehavior
    color: int  # For rendering
    size: float  # Radius
    xp_reward: int

    @classmethod
    def skeleton(cls) -> EnemyDef:
        return cls(
            name="skeleton",
            health=40,
            damage=10,
            speed=80,
            attack_range=40,
            aggro_range=180,
            attack_cooldown=1.0,
            behavior=EnemyBehavior.CHARGE,
            color=0xAAAAAA,
            size=14,
            xp_reward=20,
        )

    @classmethod
    def slime(cls) -> EnemyDef:
        return cls(
            name="slime",
            health=80,
            damage=8,
            speed=40,
            attack_range=35,
            aggro_range=150,
            attack_cooldown=1.5,
            behavior=EnemyBehavior.CIRCLE,
            color=0x44FF44,
            size=18,
            xp_reward=30,
        )

    @classmethod
    def ranged_skeleton(cls) -> EnemyDef:
        return cls(
            name="ranged_skeleton",
            health=30,
            damage=15,
            speed=60,
            attack_range=200,
            aggro_range=250,
            attack_cooldown=2.0,
            behavior=EnemyBehavior.KEEP_DISTANCE,
            color=0x8888FF,
            size=12,
            xp_reward=25,
        )


@dataclass
class Enemy(Entity):
    """Enemy entity with basic AI state machine."""
    enemy_def: EnemyDef = field(default_factory=EnemyDef.skeleton)
    state: EnemyState = EnemyState.IDLE
    attack_timer: float = 0.0
    state_timer: float = 0.0
    target_id: str | None = None

    def __post_init__(self):
        self.health = self.enemy_def.health
        self.max_health = self.enemy_def.health
        self.radius = self.enemy_def.size

    @property
    def damage(self) -> float:
        return self.enemy_def.damage

    @property
    def xp_reward(self) -> int:
        return self.enemy_def.xp_reward

    def can_attack(self) -> bool:
        return self.attack_timer <= 0 and self.state == EnemyState.ATTACK

    def start_attack(self) -> None:
        self.attack_timer = self.enemy_def.attack_cooldown

    def update_ai(self, dt: float, player_pos: Vec2, player_active: bool) -> None:
        """Basic enemy AI state machine."""
        if not self.active:
            self.state = EnemyState.DEAD
            return

        # Update timers
        if self.attack_timer > 0:
            self.attack_timer -= dt
        self.state_timer += dt

        dist_to_player = self.distance_to_pos(player_pos)

        # State transitions
        if self.state == EnemyState.IDLE:
            if player_active and dist_to_player < self.enemy_def.aggro_range:
                self.state = EnemyState.CHASE
                self.state_timer = 0

        elif self.state == EnemyState.CHASE:
            if not player_active or dist_to_player > self.enemy_def.aggro_range * 1.5:
                self.state = EnemyState.IDLE
                self.state_timer = 0
            elif dist_to_player < self.enemy_def.attack_range:
                self.state = EnemyState.ATTACK
                self.state_timer = 0
            elif self.health < self.enemy_def.health * 0.2:
                self.state = EnemyState.RETREAT
                self.state_timer = 0

        elif self.state == EnemyState.ATTACK:
            if dist_to_player > self.enemy_def.attack_range * 1.3:
                self.state = EnemyState.CHASE
                self.state_timer = 0
            elif not player_active:
                self.state = EnemyState.IDLE
                self.state_timer = 0

        elif self.state == EnemyState.RETREAT:
            if self.health > self.enemy_def.health * 0.5 or self.state_timer > 3.0:
                self.state = EnemyState.CHASE
                self.state_timer = 0

        # Apply movement based on state
        self._apply_movement(dt, player_pos, dist_to_player)

    def _apply_movement(self, dt: float, player_pos: Vec2, dist: float) -> None:
        """Apply velocity based on current state."""
        if self.state == EnemyState.CHASE:
            diff = player_pos - self.position
            if dist > 0:
                self.velocity = diff.normalized() * self.enemy_def.speed
            else:
                self.velocity = Vec2(0, 0)

        elif self.state == EnemyState.KEEP_DISTANCE:
            diff = self.position - player_pos
            if dist < self.enemy_def.attack_range * 0.8:
                # Too close, back away
                if dist > 0:
                    self.velocity = diff.normalized() * self.enemy_def.speed
            elif dist > self.enemy_def.attack_range:
                # Too far, approach
                diff2 = player_pos - self.position
                if dist > 0:
                    self.velocity = diff2.normalized() * self.enemy_def.speed
            else:
                # Circle strafe
                perp = Vec2(-diff.y, diff.x)
                if perp.length() > 0:
                    self.velocity = perp.normalized() * self.enemy_def.speed * 0.5
                else:
                    self.velocity = Vec2(0, 0)

        elif self.state == EnemyState.RETREAT:
            diff = self.position - player_pos
            if dist > 0:
                self.velocity = diff.normalized() * self.enemy_def.speed * 0.8
            else:
                self.velocity = Vec2(0, 0)

        else:
            self.velocity = Vec2(0, 0)

    def distance_to_pos(self, pos: Vec2) -> float:
        return (self.position - pos).length()

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "type": self.enemy_def.name,
            "state": self.state.value,
        })
        return base
