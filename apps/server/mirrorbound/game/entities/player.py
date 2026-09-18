"""Player entity."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Entity, Vec2


@dataclass
class PlayerInput:
    """Input from the client for a single tick."""
    move_x: float = 0.0
    move_y: float = 0.0
    attack: bool = False
    run: bool = False
    aim_angle: float = 0.0
    ability: int | None = None


@dataclass
class Player(Entity):
    """Player entity with input handling and combat state."""
    speed: float = 150.0
    run_speed: float = 280.0
    attack_cooldown: float = 0.0
    ability_cooldowns: dict[int, float] = field(default_factory=dict)
    current_weapon: str = "sword"
    xp: int = 0
    level: int = 1

    def __post_init__(self):
        self.max_health = 100.0
        self.health = self.max_health
        self.radius = 16.0

    def apply_input(self, dt: float, inp: PlayerInput) -> None:
        """Apply input to update velocity."""
        # Normalize diagonal movement
        move_x = inp.move_x
        move_y = inp.move_y
        if move_x != 0 and move_y != 0:
            move_x *= 0.707
            move_y *= 0.707

        top_speed = self.run_speed if inp.run else self.speed
        self.velocity = Vec2(move_x * top_speed, move_y * top_speed)

    def can_attack(self) -> bool:
        """Check if player can perform an attack."""
        return self.attack_cooldown <= 0

    def start_attack(self) -> None:
        """Start attack cooldown."""
        self.attack_cooldown = 0.4

    def can_use_ability(self, slot: int) -> bool:
        """Check if ability in slot is available."""
        return self.ability_cooldowns.get(slot, 0) <= 0

    def start_ability(self, slot: int, cooldown: float) -> None:
        """Start ability cooldown."""
        self.ability_cooldowns[slot] = cooldown

    def add_xp(self, amount: int) -> bool:
        """Add XP and check for level up."""
        self.xp += amount
        xp_needed = self.level * 100
        if self.xp >= xp_needed:
            self.xp -= xp_needed
            self.level += 1
            self.max_health += 10
            self.health = self.max_health
            return True
        return False

    def update_cooldowns(self, dt: float) -> None:
        """Update all cooldowns."""
        if self.attack_cooldown > 0:
            self.attack_cooldown -= dt
        for slot in list(self.ability_cooldowns.keys()):
            if self.ability_cooldowns[slot] > 0:
                self.ability_cooldowns[slot] -= dt

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "type": "player",
            "xp": self.xp,
            "level": self.level,
            "currentWeapon": self.current_weapon,
        })
        return base
