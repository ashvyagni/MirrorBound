"""Projectile entity for ranged attacks."""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.entities.entity import Entity, Vec2


@dataclass
class Projectile(Entity):
    """Projectile fired by player or enemy."""
    owner_id: str = ""
    damage: float = 10.0
    speed: float = 300.0
    lifetime: float = 2.0
    age: float = 0.0
    pierce: bool = False  # Can hit multiple targets
    aoe_radius: float = 0.0  # 0 = no AoE

    def __post_init__(self):
        self.radius = 4.0

    def update(self, dt: float) -> None:
        """Update projectile position and age."""
        self.position = self.position + self.velocity * dt
        self.age += dt
        if self.age >= self.lifetime:
            self.active = False

    def hit_target(self) -> None:
        """Called when projectile hits a target."""
        if not self.pierce:
            self.active = False

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "type": "projectile",
            "ownerId": self.owner_id,
            "damage": self.damage,
        })
        return base
