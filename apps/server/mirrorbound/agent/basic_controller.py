"""The original follow-and-poke controller, kept as the simplest possible
`TwinController` for tests and as a fallback. Twin v0 lives in agent/twin/.
"""

from __future__ import annotations

from mirrorbound.agent.observation import AgentObservation
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent


class BasicFollowController:
    """Follow the player; attack the nearest enemy if one is close."""

    def __init__(self, follow_distance: float = 60.0, attack_range: float = 160.0):
        self.follow_distance = follow_distance
        self.attack_range = attack_range

    def decide(self, observation: AgentObservation) -> TwinIntent:
        player_pos = observation.player_state.position
        twin_pos = observation.twin_state.position

        nearest, nearest_dist = None, float("inf")
        for enemy in observation.enemies:
            dist = twin_pos.distance_to(enemy.position)
            if dist < nearest_dist:
                nearest, nearest_dist = enemy, dist

        if nearest is not None and nearest_dist < self.attack_range * 2:
            return TwinIntent(intent_type="ATTACK", target_id=nearest.id, position=nearest.position.copy(),
                              confidence=0.7 if nearest_dist < self.attack_range else 0.5, reason="nearest enemy")
        offset = Vec2(-self.follow_distance * 0.5, self.follow_distance * 0.3)
        return TwinIntent(intent_type="FOLLOW", position=player_pos + offset, confidence=0.6, reason="following")
