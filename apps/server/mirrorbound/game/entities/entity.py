"""Base entity class for all game objects."""

from __future__ import annotations

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

    def length(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

    def normalized(self) -> Vec2:
        length = self.length()
        if length == 0:
            return Vec2(0, 0)
        return Vec2(self.x / length, self.y / length)

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y}

    @classmethod
    def from_dict(cls, data: dict) -> Vec2:
        return cls(x=data.get("x", 0.0), y=data.get("y", 0.0))


@dataclass
class Entity:
    """Base entity with common properties."""
    id: str
    position: Vec2 = field(default_factory=Vec2)
    velocity: Vec2 = field(default_factory=Vec2)
    health: float = 100.0
    max_health: float = 100.0
    radius: float = 16.0
    status_effects: list[str] = field(default_factory=list)
    active: bool = True

    def take_damage(self, amount: float) -> float:
        """Apply damage and return actual damage dealt."""
        if not self.active:
            return 0.0
        actual = min(amount, self.health)
        self.health -= actual
        if self.health <= 0:
            self.health = 0
            self.active = False
        return actual

    def heal(self, amount: float) -> float:
        """Heal and return actual amount healed."""
        if not self.active:
            return 0.0
        actual = min(amount, self.max_health - self.health)
        self.health += actual
        return actual

    def distance_to(self, other: Entity) -> float:
        """Calculate distance to another entity."""
        return (self.position - other.position).length()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "health": self.health,
            "maxHealth": self.max_health,
            "radius": self.radius,
            "statusEffects": self.status_effects,
            "active": self.active,
        }
