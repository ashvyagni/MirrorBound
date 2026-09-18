"""Basic enemy AI controller."""

from __future__ import annotations

from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.enemy import Enemy, EnemyState, EnemyBehavior
from mirrorbound.game.entities.player import Player


class BasicEnemyController:
    """Controls enemy behavior based on archetype."""

    def update(self, dt: float, enemy: Enemy, player: Player) -> None:
        """Update enemy AI."""
        enemy.update_ai(dt, player.position, player.active)

        # Additional behavior based on archetype
        if enemy.enemy_def.behavior == EnemyBehavior.KEEP_DISTANCE:
            self._keep_distance_behavior(enemy, player)
        elif enemy.enemy_def.behavior == EnemyBehavior.CIRCLE:
            self._circle_behavior(enemy, player)

    def _keep_distance_behavior(self, enemy: Enemy, player: Player) -> None:
        """Keep distance and shoot."""
        dist = enemy.distance_to(player)

        # If too close, back away
        if dist < enemy.enemy_def.attack_range * 0.6:
            diff = enemy.position - player.position
            if diff.length() > 0:
                enemy.velocity = diff.normalized() * enemy.enemy_def.speed
        # If in range, strafe
        elif dist < enemy.enemy_def.attack_range:
            diff = enemy.position - player.position
            perp = Vec2(-diff.y, diff.x)
            if perp.length() > 0:
                enemy.velocity = perp.normalized() * enemy.enemy_def.speed * 0.5
        # If too far, approach
        else:
            diff = player.position - enemy.position
            if diff.length() > 0:
                enemy.velocity = diff.normalized() * enemy.enemy_def.speed

    def _circle_behavior(self, enemy: Enemy, player: Player) -> None:
        """Circle around the player."""
        dist = enemy.distance_to(player)

        # Calculate direction to circle
        diff = enemy.position - player.position
        if diff.length() > 0:
            # Perpendicular direction for circling
            perp = Vec2(-diff.y, diff.x)
            if perp.length() > 0:
                circle_dir = perp.normalized()

                # Adjust distance
                if dist < enemy.enemy_def.attack_range * 0.7:
                    # Too close, move away while circling
                    away = diff.normalized()
                    enemy.velocity = Vec2(
                        (circle_dir.x + away.x) * enemy.enemy_def.speed * 0.5,
                        (circle_dir.y + away.y) * enemy.enemy_def.speed * 0.5,
                    )
                elif dist > enemy.enemy_def.attack_range:
                    # Too far, move closer while circling
                    toward = diff.normalized().multiply(-1)
                    enemy.velocity = Vec2(
                        (circle_dir.x + toward.x) * enemy.enemy_def.speed * 0.5,
                        (circle_dir.y + toward.y) * enemy.enemy_def.speed * 0.5,
                    )
                else:
                    # Good distance, just circle
                    enemy.velocity = Vec2(
                        circle_dir.x * enemy.enemy_def.speed * 0.5,
                        circle_dir.y * enemy.enemy_def.speed * 0.5,
                    )
