"""Basic follow controller for the twin."""

from __future__ import annotations

from mirrorbound.agent.observation import AgentObservation
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent


class BasicFollowController:
    """Simple follow-player controller. Ojas replaces this with real AI."""

    def __init__(self, follow_distance: float = 60.0, attack_range: float = 100.0):
        self.follow_distance = follow_distance
        self.attack_range = attack_range

    def decide(self, observation: AgentObservation) -> TwinIntent:
        """Make a decision based on the current observation."""
        player_pos = Vec2(
            observation.player_state.position.x,
            observation.player_state.position.y,
        )
        twin_pos = Vec2(
            observation.twin_state.position.x,
            observation.twin_state.position.y,
        )

        # Find nearest enemy
        nearest_enemy = None
        nearest_dist = float('inf')
        for enemy in observation.enemies:
            enemy_pos = Vec2(enemy.position.x, enemy.position.y)
            dist = twin_pos.distance_to(enemy_pos)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_enemy = enemy

        # Decision logic
        if nearest_enemy and nearest_dist < self.attack_range:
            # Enemy in range, attack it
            return TwinIntent(
                intent_type="ATTACK",
                target_id=nearest_enemy.id,
                position=Vec2(nearest_enemy.position.x, nearest_enemy.position.y),
                confidence=0.7,
            )
        elif nearest_enemy and nearest_dist < self.attack_range * 2:
            # Enemy nearby, move toward to attack
            return TwinIntent(
                intent_type="ATTACK",
                target_id=nearest_enemy.id,
                position=Vec2(nearest_enemy.position.x, nearest_enemy.position.y),
                confidence=0.5,
            )
        else:
            # No immediate threat, follow player
            # Calculate offset position behind player
            offset = Vec2(-self.follow_distance * 0.5, self.follow_distance * 0.3)
            target = player_pos + offset

            return TwinIntent(
                intent_type="FOLLOW",
                position=target,
                confidence=0.6,
            )
