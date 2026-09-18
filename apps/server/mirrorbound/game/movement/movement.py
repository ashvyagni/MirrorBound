"""Movement system - integrates velocity into position."""

from __future__ import annotations

from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.state import GameState


class MovementSystem:
    """Handles entity movement and room bounds collision."""

    def __init__(self, bus: EventBus):
        self.bus = bus

    def update(self, dt: float, state: GameState) -> None:
        """Update all entity positions based on velocity."""
        # Update player
        self._move_entity(dt, state.player, state)

        # Update twin
        self._move_entity(dt, state.twin, state)

        # Update enemies
        for enemy in state.get_active_enemies():
            self._move_entity(dt, enemy, state)

        # Update projectiles
        for projectile in state.projectiles:
            if projectile.active:
                projectile.update(dt)

    def _move_entity(self, dt: float, entity: Entity, state: GameState) -> None:
        """Move a single entity, clamping to room bounds."""
        if not entity.active:
            return

        # Store old position for event
        old_pos = Vec2(entity.position.x, entity.position.y)

        # Apply velocity
        new_x = entity.position.x + entity.velocity.x * dt
        new_y = entity.position.y + entity.velocity.y * dt

        # Clamp to room bounds (accounting for entity radius)
        wall = 16
        new_x = max(wall + entity.radius, min(state.room.width - wall - entity.radius, new_x))
        new_y = max(wall + entity.radius, min(state.room.height - wall - entity.radius, new_y))

        entity.position = Vec2(new_x, new_y)

        # Publish movement event for player
        if entity.id == "player_1":
            distance = (entity.position - old_pos).length()
            if distance > 0.1:
                self.bus.publish(Event(
                    tick=state.tick,
                    type="PLAYER_MOVED",
                    data={
                        "position": entity.position.to_dict(),
                        "distance": distance,
                    }
                ))
