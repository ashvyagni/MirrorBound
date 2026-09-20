"""Twin entity - the AI-controlled companion.

The twin holds *state* (health, weapon, inventory, its current intent). It
does not decide anything: a `TwinController` produces a `TwinIntent`, and the
game (`mirrorbound.game.twin_executor`) validates and executes it. That split is
what lets Ojas swap the controller without touching the entity or the game.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from mirrorbound.game.combat.weapons import BARE_HANDS, TWIN_STARTING_WEAPON, WeaponDef, get_weapon
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.inventory import Inventory

INTENT_TYPES = (
    "FOLLOW", "PROTECT", "INTERCEPT", "FLANK", "ATTACK", "RETREAT",
    "DISTRACT", "COMBO", "REPOSITION", "HEAL", "EXPLORE", "ASSIST",
)


class TwinController(Protocol):
    """Protocol for twin decision-making. The full agent implements this."""

    def decide(self, observation: Any) -> "TwinIntent":
        """Given an observation, return a TwinIntent."""
        ...


@dataclass
class TwinIntent:
    """What the twin wants to do. The game validates and executes it."""
    intent_type: str                       # one of INTENT_TYPES
    target_id: str | None = None
    position: Vec2 | None = None
    confidence: float = 0.5
    # Utility score per candidate action, for the debug HUD ("why this?").
    utilities: dict[str, float] = field(default_factory=dict)
    reason: str = ""
    # Orthogonal to intent_type: a weapon the controller would like equipped,
    # from what it actually owns (see agent/twin/controller.py). The executor
    # validates this before acting on it -- the controller only ever suggests.
    desired_weapon: str | None = None

    def to_dict(self) -> dict:
        return {
            "intentType": self.intent_type,
            "targetId": self.target_id,
            "position": self.position.to_dict() if self.position else None,
            "confidence": round(self.confidence, 3),
            "utilities": {k: round(v, 3) for k, v in self.utilities.items()},
            "reason": self.reason,
            "desiredWeapon": self.desired_weapon,
        }


@dataclass
class Twin(Entity):
    """Twin entity controlled by an AI controller."""
    controller: TwinController | None = None
    inventory: Inventory = field(default_factory=Inventory)
    intent: TwinIntent = field(default_factory=lambda: TwinIntent("FOLLOW"))
    intent_history: list[TwinIntent] = field(default_factory=list)
    speed: float = 185.0
    attack_cooldown: float = 0.0
    state: str = "idle"          # idle | walk | attack | cast | downed
    state_timer: float = 0.0
    downed_timer: float = 0.0
    mana: float = 50.0
    max_mana: float = 50.0
    mana_regen: float = 6.0
    kills: int = 0
    damage_dealt: float = 0.0
    damage_taken: float = 0.0
    revives: int = 0
    # True before the twin has been found. A dormant twin is not in the world at
    # all: it does not decide, move, fight, take damage or pick things up. The
    # entity still exists so nothing downstream has to cope with it being None.
    dormant: bool = True
    # Set the moment the twin takes the Warden's shard, and cleared on the
    # threshold of the Sanctum when the shard finishes with it. Purely a
    # presentation flag on the server's side -- nothing about the twin's
    # fighting changes -- but it is the only warning the player gets.
    corrupted: bool = False
    name: str = "the Twin"
    call_remaining: float = 0.0
    # Ticks between controller decisions. 6 ticks = 10 decisions/second, which
    # is plenty for an ally and keeps the controller cheap.
    decision_interval: int = 6

    def __post_init__(self):
        self.max_health = 90.0
        self.health = self.max_health
        self.radius = 13.0
        self.inventory.add_weapon(TWIN_STARTING_WEAPON)

    @property
    def weapon(self) -> WeaponDef:
        return get_weapon(self.inventory.equipped_weapon or BARE_HANDS.id)

    @property
    def available(self) -> bool:
        """Only a living, present companion participates in combat and physics."""
        return not self.dormant and not self.downed and self.alive

    @property
    def downed(self) -> bool:
        return self.state == "downed"

    def set_controller(self, controller: TwinController) -> None:
        self.controller = controller

    def decide(self, observation: Any) -> TwinIntent:
        """Ask the controller for a decision (no controller: follow)."""
        if self.controller is None:
            return TwinIntent(intent_type="FOLLOW", confidence=0.5, reason="no controller")
        intent = self.controller.decide(observation)
        if intent.intent_type not in INTENT_TYPES:
            intent = TwinIntent("FOLLOW", confidence=0.3, reason=f"invalid intent {intent.intent_type!r}")
        return intent

    def remember(self, intent: TwinIntent) -> None:
        self.intent = intent
        self.intent_history.append(intent)
        if len(self.intent_history) > 60:
            self.intent_history = self.intent_history[-60:]

    def set_state(self, state: str) -> None:
        if state != self.state:
            self.state = state
            self.state_timer = 0.0

    def update(self, dt: float) -> None:
        self.state_timer += dt
        self.tick_status(dt)
        if self.attack_cooldown > 0:
            self.attack_cooldown -= dt
        if self.state == "downed":
            self.velocity = Vec2()
            self.downed_timer -= dt
            return
        self.mana = min(self.max_mana, self.mana + self.mana_regen * dt)
        if self.state in ("attack", "cast") and self.state_timer > 0.3:
            self.set_state("idle")
        if self.state in ("idle", "walk"):
            self.set_state("walk" if self.velocity.length() > 5 else "idle")

    def can_attack(self) -> bool:
        return self.available and self.attack_cooldown <= 0

    def start_attack(self) -> None:
        self.attack_cooldown = self.weapon.cooldown * 1.1
        self.set_state("attack" if self.weapon.is_melee else "cast")

    def awaken(self, near: Vec2, name: str) -> None:
        """Found. From here on it is a participant, not scenery."""
        self.dormant = False
        self.active = True
        self.velocity = Vec2()
        self.knockback = Vec2()
        self.status_effects.clear()
        self.slow_factor = 1.0
        self.call_remaining = 0.0
        self.intent = TwinIntent("FOLLOW")
        self.name = name
        self.position = near + Vec2(-46, 26)
        self.health = self.max_health
        self.mana = self.max_mana
        self.invulnerable_for = 2.0
        self.set_state("idle")

    def take_hit(self, amount: float) -> float:
        if self.state == "downed" or self.dormant:
            return 0.0
        actual = self.take_damage(amount)
        self.damage_taken += actual
        if self.health <= 0:
            # The companion goes down instead of dying: it gets back up after a
            # while so a bad fight never removes the game's defining feature.
            self.active = True
            self.set_state("downed")
            self.downed_timer = 9.0
            self.velocity = Vec2()
        return actual

    def revive(self, near: Vec2) -> None:
        self.health = self.max_health * 0.55
        self.position = near + Vec2(-30, 20)
        self.invulnerable_for = 1.5
        self.status_effects.clear()
        self.slow_factor = 1.0
        self.revives += 1
        self.set_state("idle")

    def to_dict(self, detail: bool = True) -> dict:
        base = super().to_dict()
        base.update({
            "type": "twin",
            "state": self.state,
            "dormant": self.dormant,
            "corrupted": self.corrupted,
            "name": self.name,
            "mana": round(self.mana, 1),
            "maxMana": round(self.max_mana, 1),
            "currentWeapon": self.weapon.id,
            "intent": self.intent.to_dict(),
            "kills": self.kills,
            "damageDealt": round(self.damage_dealt),
            "damageTaken": round(self.damage_taken),
            "downedFor": round(max(0.0, self.downed_timer), 1) if self.downed else 0,
            "attackCooldown": round(max(0.0, self.attack_cooldown), 2),
        })
        if detail:
            base["weapon"] = self.weapon.to_dict()
            base["inventory"] = self.inventory.to_dict()
        return base
