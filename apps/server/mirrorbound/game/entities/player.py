"""Player entity: input, facing, resources, cooldowns, progression, inventory."""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.abilities import ABILITIES, AbilityDef, AbilityType
from mirrorbound.game.combat.weapons import BARE_HANDS, STARTING_WEAPON, WeaponDef, get_weapon
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
    #: Unit vector toward the cursor. Zero when the client has none to send.
    aim_x: float = 0.0
    aim_y: float = 0.0
    # Legacy field, kept so older clients do not fail validation.
    aim_angle: float = 0.0


PLAYER_STATES = ("idle", "walk", "run", "attack", "cast", "channel", "drink", "dash", "hurt", "dead")

# --- potions -----------------------------------------------------------------
# Drinking is a commitment, not a free action: it takes real time, slows you
# while it happens, and locks out attacking, casting and dashing. One shared
# cooldown covers every potion so swapping health for mana is not a way to
# drink twice as often.
DRINK_SECONDS = 0.4
DRINK_SLOW = 0.45            # movement multiplier while drinking
POTION_SHARED_COOLDOWN = 6.0
# Movement multiplier while channelling a cast (Mending Light).
CHANNEL_SLOW = 0.35


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
    #: Seconds left on a press that arrived while the last swing was recovering.
    attack_buffer: float = 0.0
    # ability id -> seconds remaining / total, for the HUD ring.
    ability_cooldowns: dict[str, float] = field(default_factory=dict)
    ability_cooldown_max: dict[str, float] = field(default_factory=dict)

    inventory: Inventory = field(default_factory=Inventory)
    xp: int = 0
    level: int = 1
    skill_points: int = 0
    unlocked_skills: set[str] = field(default_factory=set)

    # Potion drinking. `finished_drink` is set for exactly one tick when a drink
    # completes; the session reads it and is the only thing that consumes the
    # item, so a drink that never finishes never costs anything.
    drink_item: str = ""
    drink_timer: float = 0.0
    potion_cooldown: float = 0.0
    finished_drink: str | None = None
    # Channelled casts (Mending Light). Same one-tick handoff as drinking.
    channel_ability: str = ""
    channel_timer: float = 0.0
    finished_channel: str | None = None

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
        if STARTING_WEAPON:
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
        """What is actually swinging. Empty hands are a weapon too.

        `BARE_HANDS` rather than a null: every combat path reads exactly one
        `WeaponDef`, and giving unarmed a real definition means none of them
        had to learn about not having one.
        """
        return get_weapon(self.inventory.equipped_weapon or BARE_HANDS.id)

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

    def input_speed(self, running: bool) -> float:
        """Movement allowed in the current state, also sent for view prediction."""
        if self.state in ("dead", "hurt", "dash"):
            return 0.0
        speed = self.run_speed if running else self.speed
        if self.state in ("attack", "cast"):
            speed *= .45
        elif self.state == "drink":
            speed *= DRINK_SLOW
        elif self.state == "channel":
            speed *= CHANNEL_SLOW
        return speed

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
        self.velocity = move * self.input_speed(self.is_running)
        if not move.is_zero():
            self.last_move_dir = move

        # Where you point is where the cursor is, not where you are walking.
        #
        # That separation is what makes a top-down game feel aimed rather than
        # driven: you can back away from something while still hitting it, and
        # a spell goes where you were looking instead of where your last
        # keypress happened to send you. Everything downstream -- the melee
        # arc, the projectile's heading, which way the sprite is drawn --
        # already reads `facing`, so pointing it at the cursor aims all of them
        # at once.
        #
        # Movement is the fallback, for a client that sends no cursor (or a
        # player using only the keyboard), so the old behaviour is still there
        # underneath rather than replaced.
        aim = Vec2(inp.aim_x, inp.aim_y)
        if not aim.is_zero():
            self.face(aim)
        elif not move.is_zero():
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
        self.finished_drink = None
        self.finished_channel = None

        if self.potion_cooldown > 0:
            self.potion_cooldown = max(0.0, self.potion_cooldown - dt)
        if self.attack_cooldown > 0:
            self.attack_cooldown -= dt
        if self.attack_buffer > 0:
            self.attack_buffer = max(0.0, self.attack_buffer - dt)
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

        if self.state == "drink":
            self.drink_timer -= dt
            if self.drink_timer <= 0:
                # Hand the finished item to the session; it applies the effect
                # and takes the item from the inventory. Nothing is consumed
                # here, so an interrupted drink costs the player nothing.
                self.finished_drink = self.drink_item
                self.drink_item = ""
                self.potion_cooldown = POTION_SHARED_COOLDOWN
                self.set_state("idle")
        elif self.state == "channel":
            self.channel_timer -= dt
            if self.channel_timer <= 0:
                self.finished_channel = self.channel_ability
                self.channel_ability = ""
                self.set_state("idle")
        elif self.state == "dash":
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
        return self.attack_cooldown <= 0 and self.state not in ("dead", "hurt", "dash", "drink", "channel")

    #: Grace on top of the wait a buffered press is already covering.
    #:
    #: Without a buffer an attack pressed during recovery was dropped outright,
    #: and the sword's three-hit chain was unreachable in practice: the chain
    #: needs its next press between the 0.42s cooldown and the 0.9s combo
    #: window, so anyone clicking at a natural rate spent every press inside the
    #: cooldown, landed hit one over and over, and never saw hits two or three.
    ATTACK_BUFFER = 0.25

    def buffer_attack(self) -> None:
        """Remember a press, whether or not it can be acted on this tick.

        Held for whatever is left of the current recovery plus a grace period,
        rather than a flat window: a flat one shorter than the weapon's
        cooldown still drops presses -- which is the bug this exists to fix --
        and one long enough for the slowest weapon would feel like lag on the
        fastest. It is a single flag, not a count, so mashing buys one swing
        and never queues a burst for when the player has stopped asking.
        """
        self.attack_buffer = max(0.0, self.attack_cooldown) + self.ATTACK_BUFFER

    def take_buffered_attack(self) -> bool:
        """Whether a remembered press should swing now, consuming it."""
        if self.attack_buffer <= 0 or not self.can_attack():
            return False
        self.attack_buffer = 0.0
        return True

    # --- potions ----------------------------------------------------------------

    def can_drink(self, item_id: str, spec: dict) -> tuple[bool, str]:
        """Whether a drink may start. Checks the state machine, the shared
        cooldown, and whether the potion would do anything at all."""
        if self.state in ("dead", "hurt", "dash"):
            return False, "incapacitated"
        if self.state == "drink":
            return False, "already drinking"
        if self.potion_cooldown > 0:
            return False, "cooldown"
        if self.inventory.consumables.get(item_id, 0) <= 0:
            return False, "none left"
        # Drinking at full is a wasted potion, not a valid action.
        if spec.get("heal") and self.health >= self.max_health:
            return False, "health full"
        if spec.get("mana") and self.mana >= self.max_mana:
            return False, "mana full"
        return True, "ok"

    def begin_drink(self, item_id: str) -> None:
        self.drink_item = item_id
        self.drink_timer = DRINK_SECONDS
        self.channel_ability = ""
        self.set_state("drink")

    def cancel_drink(self) -> str:
        """Abort a drink in progress without consuming anything. Returns the
        item that was being drunk (empty when none was)."""
        item, self.drink_item = self.drink_item, ""
        self.drink_timer = 0.0
        if self.state == "drink":
            self.set_state("idle")
        return item

    # --- channelled casts --------------------------------------------------------

    def begin_channel(self, ability_id: str, duration: float) -> None:
        self.channel_ability = ability_id
        self.channel_timer = duration
        self.set_state("channel")

    def interrupt_channel(self) -> str:
        """Abort a channel. The mana and cooldown were already spent at the
        start, so an interrupt is a real loss -- that is the point of it."""
        ability, self.channel_ability = self.channel_ability, ""
        self.channel_timer = 0.0
        if self.state == "channel":
            self.set_state("idle")
        return ability

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

    def clear_shield_cooldown(self) -> list[str]:
        """Make every ward the player carries ready again. Returns what changed.

        This is the parry's whole reward. It deliberately does not refund the
        mana or extend the ward that is already up: the ward still runs out on
        its own timer, and re-raising it still costs. Mana is what stops a
        player who is being hit constantly from holding a shield forever, and
        removing the cooldown without removing that limit is what makes reading
        an attack worth doing rather than mandatory.
        """
        cleared: list[str] = []
        for aid in list(self.ability_cooldowns):
            ability = ABILITIES.get(aid)
            if ability is not None and ability.type is AbilityType.SHIELD:
                del self.ability_cooldowns[aid]
                self.ability_cooldown_max.pop(aid, None)
                cleared.append(aid)
        return cleared

    def ability_cooldown_for(self, ability: AbilityDef) -> float:
        mult = self.mods.ability_cooldown_mult
        if ability.id == "shadow_dash":
            mult *= self.mods.dash_cooldown_mult
        return max(0.2, ability.cooldown * mult)

    def can_use_ability(self, ability: AbilityDef) -> tuple[bool, str]:
        if self.state in ("dead", "hurt"):
            return False, "incapacitated"
        if self.state == "drink":
            return False, "drinking"
        if self.state == "channel":
            return False, "channelling"
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
            # Death cancels everything pending. The drink is not consumed; the
            # channel's mana is already gone, which is the cost of being caught
            # mid-cast.
            self.drink_item = ""
            self.drink_timer = 0.0
            self.channel_ability = ""
            self.channel_timer = 0.0
            self.finished_drink = None
            self.finished_channel = None
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

    def respec(self) -> int:
        """Refund every unlocked node and return the points handed back.

        All of them, not one at a time: the tree has prerequisites, so
        unlearning a tier-1 node while a tier-3 node depends on it would leave
        a build the tree itself says is impossible. Clearing the whole thing is
        the only refund that cannot produce an illegal state.

        Health is recomputed and clamped rather than refilled -- respeccing out
        of Resilience must not be a way to top up, and it must not leave the
        player above a maximum that just went down.
        """
        from mirrorbound.game.progression.skills import SKILLS

        if not self.unlocked_skills:
            return 0
        refunded = sum(SKILLS[s].cost for s in self.unlocked_skills if s in SKILLS)
        self.unlocked_skills.clear()
        self.skill_points += refunded
        self.recompute_max_health()
        self.health = min(self.health, self.max_health)
        self.mana = min(self.mana, self.max_mana)
        return refunded

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

    def to_dict(self, detail: bool = True) -> dict:
        """`detail=False` omits the inventory/skill tree/stat blocks that only
        change on discrete actions; the session sends those on detail snapshots
        and the client caches them."""
        base = super().to_dict()
        base.update({
            "type": "player",
            "state": self.state,
            "moveSpeed": round(self.input_speed(False), 3),
            "runSpeed": round(self.input_speed(True), 3),
            "mana": round(self.mana, 1),
            "maxMana": round(self.max_mana, 1),
            "xp": self.xp,
            "xpToNext": xp_to_next(self.level),
            "level": self.level,
            "skillPoints": self.skill_points,
            "currentWeapon": self.current_weapon,
            "attackCooldown": round(max(0.0, self.attack_cooldown), 2),
            "comboStep": self.combo_step,
            "comboLength": len(self.weapon.combo_chain),
            "abilities": self.abilities_to_dict(),
            "kills": self.kills,
            "deaths": self.deaths,
            "targetId": self.target_id,
            "potionCooldown": round(max(0.0, self.potion_cooldown), 2),
            "potionCooldownTotal": POTION_SHARED_COOLDOWN,
            "drinking": self.drink_item or None,
            "channelling": self.channel_ability or None,
            "gold": self.inventory.gold,
            "respawnIn": round(max(0.0, self.respawn_timer), 1) if self.state == "dead" else 0,
        })
        if detail:
            from mirrorbound.game.progression.skills import tree_to_dict

            base.update({
                "unlockedSkills": sorted(self.unlocked_skills),
                "skillTree": tree_to_dict(self.unlocked_skills, self.skill_points),
                "weapon": self.weapon.to_dict(),
                "inventory": self.inventory.to_dict(),
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
