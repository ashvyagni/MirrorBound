"""Agent observation: everything a twin controller is allowed to see.

This is the contract between the game and the agent. The controller never
touches `GameState`; it reads one of these and returns a `TwinIntent`.
"""

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
    facing: Vec2 = field(default_factory=lambda: Vec2(1, 0))
    radius: float = 14.0
    state: str = "idle"
    role: str = "unknown"            # player | twin | melee | ranged | fast | tank | boss
    target_id: str | None = None
    winding_up: bool = False
    windup: float = 0.0
    attack_range: float = 0.0
    weapon_is_melee: bool = True
    elite: bool = False
    boss: bool = False
    status_effects: list[str] = field(default_factory=list)

    @property
    def health_fraction(self) -> float:
        return self.health / self.max_health if self.max_health > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "health": self.health,
            "maxHealth": self.max_health,
            "velocity": self.velocity.to_dict(),
            "facing": self.facing.to_dict(),
            "state": self.state,
            "role": self.role,
            "targetId": self.target_id,
            "windingUp": self.winding_up,
            "attackRange": self.attack_range,
            "statusEffects": self.status_effects,
        }


@dataclass
class RoomSnapshot:
    """Room context for AI observation."""
    room_type: str
    width: int
    height: int
    doors: list[Vec2] = field(default_factory=list)
    index: int = 0
    cleared: bool = False

    def to_dict(self) -> dict:
        return {
            "roomType": self.room_type,
            "width": self.width,
            "height": self.height,
            "doors": [d.to_dict() for d in self.doors],
            "index": self.index,
            "cleared": self.cleared,
        }


@dataclass
class PickupSnapshot:
    id: str
    kind: str
    position: Vec2


@dataclass
class AgentObservation:
    """Complete observation for AI decision-making."""
    tick: int
    player_state: EntitySnapshot
    twin_state: EntitySnapshot
    enemies: list[EntitySnapshot] = field(default_factory=list)
    recent_events: list[dict] = field(default_factory=list)
    room_context: RoomSnapshot | None = None
    pickups: list[PickupSnapshot] = field(default_factory=list)
    # What the modelling half of the agent currently believes about the player:
    # {"traits": {...}, "predictions": [...], "spatial": {...}}.
    player_model: dict = field(default_factory=dict)
    # The twin's own learned style (see agent/twin/style.py).
    twin_style: dict = field(default_factory=dict)
    player_target_id: str | None = None
    player_last_action: str | None = None
    player_mana_fraction: float = 1.0
    twin_can_attack: bool = True
    twin_weapon_range: float = 60.0
    twin_weapon_is_melee: bool = False
    seconds_since_decision: float = 0.1
    # For autonomous weapon selection: which weapon is currently equipped,
    # and every weapon id the twin actually owns and could switch to.
    twin_weapon_id: str = ""
    twin_owned_weapons: list[str] = field(default_factory=list)

    def enemy(self, enemy_id: str | None) -> EntitySnapshot | None:
        for e in self.enemies:
            if e.id == enemy_id:
                return e
        return None

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "playerState": self.player_state.to_dict(),
            "twinState": self.twin_state.to_dict(),
            "enemies": [e.to_dict() for e in self.enemies],
            "recentEvents": self.recent_events,
            "roomContext": self.room_context.to_dict() if self.room_context else None,
            "playerTargetId": self.player_target_id,
            "playerLastAction": self.player_last_action,
        }
