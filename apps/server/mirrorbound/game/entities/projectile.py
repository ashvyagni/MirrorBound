"""Projectile entity for ranged attacks and spells."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Entity, Vec2


@dataclass
class Projectile(Entity):
    """Projectile fired by the player, the twin, or an enemy."""
    owner_id: str = ""
    kind: str = "arrow"        # client texture key
    damage: float = 10.0
    speed: float = 300.0
    lifetime: float = 2.0
    age: float = 0.0
    pierce: bool = False
    aoe_radius: float = 0.0
    knockback: float = 60.0
    slow: float = 0.0           # target speed multiplier when > 0
    slow_duration: float = 0.0
    tags: tuple[str, ...] = ()
    source: str = ""            # weapon or ability id, for telemetry
    hit_ids: set[str] = field(default_factory=set)

    def __post_init__(self):
        if self.radius == 16.0:
            self.radius = 5.0
        self.health = 1
        self.max_health = 1

    @property
    def faction(self) -> str:
        """'ally' for the player and twin, 'enemy' otherwise."""
        return "enemy" if self.owner_id.startswith("enemy") or self.owner_id.startswith("boss") else "ally"

    def update(self, dt: float) -> None:
        self.position = self.position + self.velocity * dt
        self.age += dt
        if self.age >= self.lifetime:
            self.active = False

    def hit_target(self, target_id: str) -> None:
        self.hit_ids.add(target_id)
        if not self.pierce:
            self.active = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "ownerId": self.owner_id,
            "faction": self.faction,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "radius": self.radius,
        }
