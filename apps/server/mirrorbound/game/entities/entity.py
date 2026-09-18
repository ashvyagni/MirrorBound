"""Base entity class for all game objects."""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class Vec2:
    """2D vector for positions and velocities."""
    x: float = 0.0
    y: float = 0.0

    def __add__(self, other: Vec2) -> Vec2:
        return Vec2(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Vec2) -> Vec2:
        return Vec2(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: float) -> Vec2:
        return Vec2(self.x * scalar, self.y * scalar)

    __rmul__ = __mul__

    def __neg__(self) -> Vec2:
        return Vec2(-self.x, -self.y)

    def __truediv__(self, scalar: float) -> Vec2:
        return Vec2(self.x / scalar, self.y / scalar)

    def multiply(self, scalar: float) -> Vec2:
        """Alias of `*` kept for callers written against the older API."""
        return self * scalar

    def dot(self, other: Vec2) -> float:
        return self.x * other.x + self.y * other.y

    def length(self) -> float:
        return math.hypot(self.x, self.y)

    def normalized(self) -> Vec2:
        length = self.length()
        if length == 0:
            return Vec2(0, 0)
        return Vec2(self.x / length, self.y / length)

    def perpendicular(self) -> Vec2:
        return Vec2(-self.y, self.x)

    def angle(self) -> float:
        """Radians, 0 = +x, PI/2 = +y (screen-down)."""
        return math.atan2(self.y, self.x)

    def distance_to(self, other: Vec2) -> float:
        return (self - other).length()

    def is_zero(self) -> bool:
        return self.x == 0 and self.y == 0

    def copy(self) -> Vec2:
        return Vec2(self.x, self.y)

    @classmethod
    def from_angle(cls, radians: float, length: float = 1.0) -> Vec2:
        return cls(math.cos(radians) * length, math.sin(radians) * length)

    def to_dict(self) -> dict:
        return {"x": round(self.x, 2), "y": round(self.y, 2)}

    @classmethod
    def from_dict(cls, data: dict) -> Vec2:
        return cls(x=data.get("x", 0.0), y=data.get("y", 0.0))


@dataclass
class Entity:
    """Base entity with common properties."""
    id: str
    position: Vec2 = field(default_factory=Vec2)
    velocity: Vec2 = field(default_factory=Vec2)
    facing: Vec2 = field(default_factory=lambda: Vec2(1, 0))
    health: float = 100.0
    max_health: float = 100.0
    radius: float = 16.0
    # Timed status effects: name -> seconds remaining. `slow` also carries its
    # strength in `slow_factor` so a 40% slow and a 70% slow don't collide.
    status_effects: dict[str, float] = field(default_factory=dict)
    slow_factor: float = 1.0
    active: bool = True
    invulnerable_for: float = 0.0
    # Knockback impulse that decays every tick; separate from velocity so an
    # entity's own movement decision doesn't cancel it.
    knockback: Vec2 = field(default_factory=Vec2)

    @property
    def alive(self) -> bool:
        return self.active and self.health > 0

    def take_damage(self, amount: float) -> float:
        """Apply damage and return actual damage dealt."""
        if not self.active or amount <= 0:
            return 0.0
        if self.invulnerable_for > 0:
            return 0.0
        actual = min(amount, self.health)
        self.health -= actual
        if self.health <= 0:
            self.health = 0
            self.active = False
        return actual

    def heal(self, amount: float) -> float:
        """Heal and return actual amount healed."""
        if not self.active or amount <= 0:
            return 0.0
        actual = min(amount, self.max_health - self.health)
        self.health += actual
        return actual

    def apply_status(self, name: str, duration: float, slow_factor: float | None = None) -> None:
        self.status_effects[name] = max(self.status_effects.get(name, 0.0), duration)
        if slow_factor is not None:
            self.slow_factor = min(self.slow_factor, slow_factor)

    def tick_status(self, dt: float) -> None:
        expired = []
        for name in self.status_effects:
            self.status_effects[name] -= dt
            if self.status_effects[name] <= 0:
                expired.append(name)
        for name in expired:
            del self.status_effects[name]
        if "slow" not in self.status_effects:
            self.slow_factor = 1.0
        if self.invulnerable_for > 0:
            self.invulnerable_for = max(0.0, self.invulnerable_for - dt)
        # Knockback bleeds off quickly.
        if not self.knockback.is_zero():
            decay = max(0.0, 1.0 - dt * 8.0)
            self.knockback = self.knockback * decay
            if self.knockback.length() < 2:
                self.knockback = Vec2()

    def face(self, direction: Vec2) -> None:
        if not direction.is_zero():
            self.facing = direction.normalized()

    def distance_to(self, other: Entity) -> float:
        """Calculate distance to another entity."""
        return (self.position - other.position).length()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "facing": self.facing.to_dict(),
            "health": round(self.health, 1),
            "maxHealth": round(self.max_health, 1),
            "radius": self.radius,
            "statusEffects": sorted(self.status_effects.keys()),
            "invulnerable": self.invulnerable_for > 0,
            "active": self.active,
        }
