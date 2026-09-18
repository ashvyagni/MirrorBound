"""Player entity: input, facing, resources, cooldowns, progression, inventory."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.abilities import ABILITIES, AbilityDef
from mirrorbound.game.combat.weapons import STARTING_WEAPON, WeaponDef, get_weapon
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.inventory import Inventory
from mirrorbound.game.progression.progression import MAX_LEVEL, level_up_rewards, xp_to_next
from mirrorbound.game.progression.skills import StatModifiers, modifiers_for


@dataclass
class PlayerInput:
    """Input from the client for a single tick."""
    move_x: float = 0.0
    move_y: float = 0.0
    attack: bool = False
    run: bool = False
    ability: int | None = None      # slot 1-4 pressed this tick
    # Legacy field: ignored for aiming (facing comes from movement) but kept so
    # older clients don't fail validation.
    aim_angle: float = 0.0


PLAYER_STATES = ("idle", "walk", "run", "attack", "cast", "dash", "hurt", "dead")


@dataclass
class Player(Entity):
    """Player entity with input handling and combat state."""
    base_speed: float = 175.0
    base_run_speed: float = 290.0
    base_max_health: float = 100.0
    base_max_mana: float = 60.0
    base_mana_regen: float = 4.5
    mana: float = 60.0

    attack_cooldown: float = 0.0
    combo_step: int = 0
    combo_timer: float = 0.0
    # ability id -> seconds remaining / total, for the HUD ring.
    ability_cooldowns: dict[str, float] = field(default_factory=dict)
    ability_cooldown_max: dict[str, float] = field(default_factory=dict)

    inventory: Inventory = field(default_factory=Inventory)
    xp: int = 0
    level: int = 1
    skill_points: int = 0
    unlocked_skills: set[str] = field(default_factory=set)

    state: str = "idle"
    state_timer: float = 0.0
    dash_timer: float = 0.0
    dash_velocity: Vec2 = field(default_factory=Vec2)
    respawn_timer: float = 0.0
    deaths: int = 0
    kills: int = 0
    # The enemy the player most recently hit; the twin reads it as "the player's target".
    target_id: str | None = None
    last_move_dir: Vec2 = field(default_factory=Vec2)
    is_running: bool = False

    def __post_init__(self):
        self.radius = 14.0
        self.max_health = self.base_max_health
        self.health = self.max_health
        self.mana = self.base_max_mana
        self.inventory.add_weapon(STARTING_WEAPON)

    # --- derived stats ---------------------------------------------------------

    @property
    def mods(self) -> StatModifiers:
        return modifiers_for(self.unlocked_skills)

    @property
    def max_mana(self) -> float:
        return self.base_max_mana + self.mods.max_mana_bonus + (self.level - 1) * 8

    @property
    def speed(self) -> float:
        return self.base_speed * self.mods.speed_mult * self.slow_factor

    @property
    def run_speed(self) -> float:
        return self.base_run_speed * self.mods.speed_mult * self.slow_factor

    @property
    def mana_regen(self) -> float:
        return self.base_mana_regen * self.mods.mana_regen_mult

    @property
    def weapon(self) -> WeaponDef:
        return get_weapon(self.inventory.equipped_weapon or STARTING_WEAPON)

    @property
    def current_weapon(self) -> str:
        return self.weapon.id

    def weapon_damage_multiplier(self) -> float:
        return self.mods.weapon_damage_mult + self.inventory.relic_bonus("weapon_damage_mult")

    def spell_damage_multiplier(self) -> float:
        return self.mods.spell_damage_mult + self.inventory.relic_bonus("spell_damage_mult")

    def crit_chance_bonus(self) -> float:
        return self.mods.crit_chance_bonus

    def recompute_max_health(self) -> None:
        new_max = self.base_max_health + self.mods.max_health_bonus + (self.level - 1) * 12
        ratio = self.health / self.max_health if self.max_health > 0 else 1.0
        self.max_health = new_max
        self.health = min(new_max, max(self.health, ratio * new_max))

    # --- input ----------------------------------------------------------------

    @property
    def controllable(self) -> bool:
        return self.state not in ("dead", "hurt", "dash")

    def apply_input(self, dt: float, inp: PlayerInput) -> None:
        """Turn movement input into velocity and facing."""
        if self.state == "dead":
            self.velocity = Vec2()
            return
        if self.state == "dash":
            self.velocity = self.dash_velocity
            return
        if self.state == "hurt":
            self.velocity = Vec2()
            return

        move = Vec2(inp.move_x, inp.move_y)
        if move.length() > 1:
            move = move.normalized()
        self.is_running = bool(inp.run) and not move.is_zero()
        top = self.run_speed if self.is_running else self.speed
        # Swinging slows you down, but doesn't root you.
        if self.state in ("attack", "cast"):
            top *= 0.45
        self.velocity = move * top
        if not move.is_zero():
            self.last_move_dir = move
            # The player's latest meaningful movement direction is their facing.
            self.face(move)

    # --- state machine ----------------------------------------------------------

    def set_state(self, state: str) -> None:
        if state != self.state:
            self.state = state
            self.state_timer = 0.0

    def update(self, dt: float) -> None:
        """Per-tick housekeeping: cooldowns, regen, state timers."""
        self.state_timer += dt
        self.tick_status(dt)

        if self.attack_cooldown > 0:
            self.attack_cooldown -= dt
        if self.combo_timer > 0:
            self.combo_timer -= dt
            if self.combo_timer <= 0:
                self.combo_step = 0
        for aid in list(self.ability_cooldowns):
            self.ability_cooldowns[aid] -= dt
            if self.ability_cooldowns[aid] <= 0:
                del self.ability_cooldowns[aid]
                self.ability_cooldown_max.pop(aid, None)

        if self.state != "dead":
            self.mana = min(self.max_mana, self.mana + self.mana_regen * dt)

        if self.state == "dash":
            self.dash_timer -= dt
            if self.dash_timer <= 0:
                self.dash_velocity = Vec2()
                self.set_state("idle")
        elif self.state in ("attack", "cast"):
            if self.state_timer >= 0.32:
                self.set_state("idle")
        elif self.state == "hurt":
            if self.state_timer >= 0.22:
                self.set_state("idle")
        elif self.state == "dead":
            self.respawn_timer -= dt

        if self.state in ("idle", "walk", "run"):
            speed = self.velocity.length()
            if speed < 5:
                self.set_state("idle")
            elif self.is_running:
                self.set_state("run")
            else:
                self.set_state("walk")

    # --- combat -----------------------------------------------------------------

    def can_attack(self) -> bool:
        return self.attack_cooldown <= 0 and self.state not in ("dead", "hurt", "dash")

    def start_attack(self, weapon: WeaponDef) -> float:
        """Begin an attack; returns the combo damage multiplier for this hit."""
        chain = weapon.combo_chain
        if self.combo_timer <= 0 or self.combo_step >= len(chain):
            self.combo_step = 0
        multiplier = chain[self.combo_step]
        self.combo_step += 1
        self.combo_timer = weapon.combo_window
        # The finisher of a chain costs a bit more recovery.
        self.attack_cooldown = weapon.cooldown * (1.25 if self.combo_step == len(chain) and len(chain) > 1 else 1.0)
        self.set_state("attack")
        return multiplier

    def ability_in_slot(self, slot: int) -> AbilityDef | None:
        slots = self.inventory.ability_slots
        if 1 <= slot <= len(slots):
            return ABILITIES.get(slots[slot - 1])
        return None

    def ability_cooldown_for(self, ability: AbilityDef) -> float:
        mult = self.mods.ability_cooldown_mult
        if ability.id == "shadow_dash":
            mult *= self.mods.dash_cooldown_mult
        return max(0.2, ability.cooldown * mult)

    def can_use_ability(self, ability: AbilityDef) -> tuple[bool, str]:
        if self.state in ("dead", "hurt"):
            return False, "incapacitated"
        if self.state == "dash" and ability.type.value != "dash":
            return False, "dashing"
        if self.ability_cooldowns.get(ability.id, 0) > 0:
            return False, "cooldown"
        if self.mana < ability.cost:
            return False, "mana"
        return True, "ok"

    def start_ability(self, ability: AbilityDef) -> None:
        cd = self.ability_cooldown_for(ability)
        self.ability_cooldowns[ability.id] = cd
        self.ability_cooldown_max[ability.id] = cd
        self.mana -= ability.cost
        if ability.type.value != "dash":
            self.set_state("cast")

    def begin_dash(self, direction: Vec2, distance: float, duration: float, invuln: float) -> None:
        d = direction if not direction.is_zero() else self.facing
        self.dash_velocity = d.normalized() * (distance / max(duration, 0.05))
        self.dash_timer = duration
        self.invulnerable_for = max(self.invulnerable_for, invuln)
        self.set_state("dash")

    def take_hit(self, amount: float) -> float:
        """Damage with skill mitigation; enters the hurt state when it lands."""
        if self.state == "dead":
            return 0.0
        mitigated = amount * self.mods.damage_taken_mult
        actual = self.take_damage(mitigated)
        if actual > 0 and self.health > 0:
            self.set_state("hurt")
        if self.health <= 0:
            self.set_state("dead")
            self.active = True  # the player entity persists while dead so the camera has somewhere to be
            self.respawn_timer = 3.0
            self.deaths += 1
            self.velocity = Vec2()
        return actual

    def respawn(self, position: Vec2) -> None:
        self.position = position
        self.velocity = Vec2()
        self.health = self.max_health
        self.mana = self.max_mana
        self.status_effects.clear()
        self.slow_factor = 1.0
        self.invulnerable_for = 1.5
        self.attack_cooldown = 0
        self.combo_step = 0
        self.set_state("idle")

    # --- progression ---------------------------------------------------------------

    def add_xp(self, amount: int) -> list[dict]:
        """Add XP; returns one reward dict per level gained."""
        gained: list[dict] = []
        if self.level >= MAX_LEVEL:
            return gained
        self.xp += amount
        while self.level < MAX_LEVEL and self.xp >= xp_to_next(self.level):
            self.xp -= xp_to_next(self.level)
            self.level += 1
            reward = level_up_rewards(self.level)
            self.skill_points += reward["skillPoints"]
            self.recompute_max_health()
            self.health = self.max_health
            self.mana = self.max_mana
            gained.append(reward)
        return gained

    def unlock_skill(self, skill_id: str) -> tuple[bool, str]:
        from mirrorbound.game.progression.skills import SKILLS, can_unlock

        ok, reason = can_unlock(skill_id, self.unlocked_skills, self.skill_points)
        if not ok:
            return False, reason
        self.skill_points -= SKILLS[skill_id].cost
        self.unlocked_skills.add(skill_id)
        self.recompute_max_health()
        return True, "ok"

    # --- serialisation -----------------------------------------------------------------

    def abilities_to_dict(self) -> list[dict]:
        out = []
        for slot, aid in enumerate(self.inventory.ability_slots, start=1):
            ability = ABILITIES.get(aid)
            if ability is None:
                continue
            remaining = self.ability_cooldowns.get(aid, 0.0)
            total = self.ability_cooldown_max.get(aid, self.ability_cooldown_for(ability))
            ok, reason = self.can_use_ability(ability)
            out.append({
                "slot": slot,
                "id": ability.id,
                "name": ability.name,
                "icon": ability.icon,
                "cost": ability.cost,
                "cooldown": round(max(0.0, remaining), 2),
                "cooldownTotal": round(total, 2),
                "ready": ok,
                "blockedBy": None if ok else reason,
                "tags": list(ability.tags),
                "description": ability.description,
            })
        return out

    def to_dict(self) -> dict:
        from mirrorbound.game.progression.skills import tree_to_dict

        base = super().to_dict()
        base.update({
            "type": "player",
            "state": self.state,
            "mana": round(self.mana, 1),
            "maxMana": round(self.max_mana, 1),
            "xp": self.xp,
            "xpToNext": xp_to_next(self.level),
            "level": self.level,
            "skillPoints": self.skill_points,
            "unlockedSkills": sorted(self.unlocked_skills),
            "skillTree": tree_to_dict(self.unlocked_skills, self.skill_points),
            "currentWeapon": self.current_weapon,
            "weapon": self.weapon.to_dict(),
            "attackCooldown": round(max(0.0, self.attack_cooldown), 2),
            "comboStep": self.combo_step,
            "comboLength": len(self.weapon.combo_chain),
            "abilities": self.abilities_to_dict(),
            "inventory": self.inventory.to_dict(),
            "kills": self.kills,
            "deaths": self.deaths,
            "targetId": self.target_id,
            "respawnIn": round(max(0.0, self.respawn_timer), 1) if self.state == "dead" else 0,
            "stats": {
                "speed": round(self.speed),
                "weaponDamageMult": round(self.weapon_damage_multiplier(), 2),
                "spellDamageMult": round(self.spell_damage_multiplier(), 2),
                "critChance": round(self.weapon.crit_chance + self.crit_chance_bonus(), 2),
                "damageTakenMult": round(self.mods.damage_taken_mult, 2),
                "manaRegen": round(self.mana_regen, 1),
            },
        })
        return base
