"""Collision system - detects and resolves collisions."""

from __future__ import annotations

from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.entities.projectile import Projectile
from mirrorbound.game.state import GameState


class CollisionSystem:
    """Handles collision detection between entities."""

    def __init__(self, bus: EventBus):
        self.bus = bus

    def update(self, dt: float, state: GameState) -> None:
        """Check all relevant collisions."""
        # Check projectile-entity collisions
        self._check_projectile_collisions(state)

        # Check player-enemy melee collisions
        self._check_melee_collisions(state)

    def _check_projectile_collisions(self, state: GameState) -> None:
        """Check if projectiles hit entities."""
        for projectile in state.projectiles:
            if not projectile.active:
                continue

            # Check against enemies (if owned by player)
            if projectile.owner_id == "player_1":
                for enemy in state.get_active_enemies():
                    if self._circles_overlap(projectile, enemy):
                        self._on_projectile_hit(projectile, enemy, state)
                        break

            # Check against player (if owned by enemy)
            elif projectile.owner_id.startswith("enemy_"):
                if self._circles_overlap(projectile, state.player):
                    self._on_projectile_hit_player(projectile, state.player, state)

    def _check_melee_collisions(self, state: GameState) -> None:
        """Check melee attacks hitting entities."""
        # This is handled by the combat system when attacks are initiated
        pass

    def _circles_overlap(self, a: Entity, b: Entity) -> bool:
        """Check if two circular entities overlap."""
        dist = a.distance_to(b)
        return dist < (a.radius + b.radius)

    def _on_projectile_hit(self, projectile: Projectile, enemy: Entity, state: GameState) -> None:
        """Handle projectile hitting an enemy."""
        damage = projectile.damage
        actual = enemy.take_damage(damage)

        # Publish damage event
        self.bus.publish(Event(
            tick=state.tick,
            type="DAMAGE_DEALT",
            data={
                "attacker": projectile.owner_id,
                "target": enemy.id,
                "damage": actual,
                "remaining": enemy.health,
                "position": enemy.position.to_dict(),
            }
        ))

        # Check for enemy death
        if not enemy.active:
            self.bus.publish(Event(
                tick=state.tick,
                type="ENEMY_KILLED",
                data={
                    "enemy_id": enemy.id,
                    "enemy_type": enemy.enemy_def.name if hasattr(enemy, 'enemy_def') else "unknown",
                    "xp_reward": enemy.xp_reward if hasattr(enemy, 'xp_reward') else 0,
                    "position": enemy.position.to_dict(),
                }
            ))

        projectile.hit_target()

    def _on_projectile_hit_player(self, projectile: Projectile, player: Entity, state: GameState) -> None:
        """Handle projectile hitting the player."""
        damage = projectile.damage
        actual = player.take_damage(damage)

        self.bus.publish(Event(
            tick=state.tick,
            type="DAMAGE_TAKEN",
            data={
                "attacker": projectile.owner_id,
                "damage": actual,
                "remaining": player.health,
            }
        ))

        projectile.hit_target()
