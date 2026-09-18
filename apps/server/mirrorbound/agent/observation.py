"""Agent observation dataclass for AI integration."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Vec2


@dataclass
class EntitySnapshot:
    """Snapshot of an entity for AI observation."""
    id: str
    position: Vec2
    health: float
    max_health: float
    velocity: Vec2
    status_effects: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "health": self.health,
            "maxHealth": self.max_health,
            "velocity": self.velocity.to_dict(),
            "statusEffects": self.status_effects,
        }


@dataclass
class RoomSnapshot:
    """Room context for AI observation."""
    room_type: str
    width: int
    height: int
    doors: list[Vec2] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "roomType": self.room_type,
            "width": self.width,
            "height": self.height,
            "doors": [d.to_dict() for d in self.doors],
        }


@dataclass
class AgentObservation:
    """Complete observation for AI decision-making."""
    tick: int
    player_state: EntitySnapshot
    twin_state: EntitySnapshot
    enemies: list[EntitySnapshot] = field(default_factory=list)
    recent_events: list[dict] = field(default_factory=list)
    room_context: RoomSnapshot | None = None

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "playerState": self.player_state.to_dict(),
            "twinState": self.twin_state.to_dict(),
            "enemies": [e.to_dict() for e in self.enemies],
            "recentEvents": self.recent_events,
            "roomContext": self.room_context.to_dict() if self.room_context else None,
        }
