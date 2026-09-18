"""Twin entity - AI-controlled companion."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Any

from mirrorbound.game.entities.entity import Entity, Vec2


class TwinController(Protocol):
    """Protocol for twin decision-making. Ojas implements this."""
    def decide(self, observation: Any) -> Any:
        """Given an observation, return a TwinIntent."""
        ...


@dataclass
class TwinIntent:
    """What the twin wants to do. Game validates and executes."""
    intent_type: str  # "FOLLOW", "ATTACK", "FLANK", "RETREAT", "HEAL"
    target_id: str | None = None
    position: Vec2 | None = None
    confidence: float = 0.5

    def to_dict(self) -> dict:
        return {
            "intentType": self.intent_type,
            "targetId": self.target_id,
            "position": self.position.to_dict() if self.position else None,
            "confidence": self.confidence,
        }


@dataclass
class Twin(Entity):
    """Twin entity controlled by AI."""
    controller: TwinController | None = None
    intent_history: list[TwinIntent] = field(default_factory=list)
    speed: float = 140.0
    follow_offset: Vec2 = field(default_factory=lambda: Vec2(-40, 20))

    def __post_init__(self):
        self.max_health = 80.0
        self.health = self.max_health
        self.radius = 14.0

    def set_controller(self, controller: TwinController) -> None:
        """Set the AI controller."""
        self.controller = controller

    def decide(self, observation: Any) -> TwinIntent:
        """Ask the controller for a decision."""
        if self.controller is None:
            # Default: follow player
            return TwinIntent(
                intent_type="FOLLOW",
                confidence=0.5,
            )
        return self.controller.decide(observation)

    def execute_intent(self, intent: TwinIntent, player_pos: Vec2) -> None:
        """Execute a validated intent by updating velocity."""
        if intent.intent_type == "FOLLOW":
            target = player_pos + self.follow_offset
            diff = target - self.position
            if diff.length() > 5:
                self.velocity = diff.normalized() * self.speed
            else:
                self.velocity = Vec2(0, 0)

        elif intent.intent_type == "ATTACK" and intent.position:
            diff = intent.position - self.position
            if diff.length() > 20:
                self.velocity = diff.normalized() * self.speed
            else:
                self.velocity = Vec2(0, 0)

        elif intent.intent_type == "RETREAT" and intent.position:
            diff = self.position - intent.position
            self.velocity = diff.normalized() * self.speed

        else:
            self.velocity = Vec2(0, 0)

        self.intent_history.append(intent)
        if len(self.intent_history) > 100:
            self.intent_history = self.intent_history[-100:]

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "type": "twin",
        })
        return base
