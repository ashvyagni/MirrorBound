"""Enemy entity, archetypes and loot tables.

The state machine itself lives in `game/enemy_ai/controller.py`; this module is
data plus the per-enemy state the controller reads and writes.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import Enum

from mirrorbound.game.combat.weapons import ProjectileSpec
from mirrorbound.game.entities.entity import Entity, Vec2


class EnemyBehavior(Enum):
    """How the enemy fights."""
    CHARGE = "charge"                # melee: approach, wind up, strike, brief recover
    KEEP_DISTANCE = "keep_distance"  # ranged: hold range, shoot, sidestep
    DART = "dart"                    # fast: rush in, bite, dart out, repeat
    TANK = "tank"                    # slow, heavy, hard to knock back
    MIRROR = "mirror"                # boss: uses the player's behaviour model


class EnemyState(Enum):
    IDLE = "idle"
    WANDER = "wander"
    CHASE = "chase"
    ATTACK = "attack"          # winding up / striking
    REPOSITION = "reposition"
    RETREAT = "retreat"
    DEAD = "dead"


@dataclass(frozen=True)
class LootTable:
    essence_min: int = 1
    essence_max: int = 3
    shard_chance: float = 0.0
    potion_chance: float = 0.08
    mana_potion_chance: float = 0.06
    weapon_chance: float = 0.0
    relic_chance: float = 0.0
    # Gold is the only thing vendors take. Kept proportional to how much of a
    # fight the enemy is, so the shop prices in world/npc.py stay reachable
    # without grinding (a village trip is ~two cleared rooms' worth).
    gold_min: int = 3
    gold_max: int = 8


@dataclass(frozen=True)
class EnemyDef:
    """Enemy archetype definition."""
    id: str
    name: str
    health: float
    damage: float
    speed: float
    attack_range: float
    aggro_range: float
    attack_cooldown: float
    attack_windup: float
    behavior: EnemyBehavior
    size: float
    xp_reward: int
    sprite: str
    tags: tuple[str, ...] = ()
    knockback: float = 160.0
    knockback_resist: float = 0.0     # 0 = full knockback taken, 1 = immune
    projectile: ProjectileSpec | None = None
    loot: LootTable = LootTable()
    elite: bool = False
    boss: bool = False
    role: str = "melee"                # melee | ranged | fast | tank | boss (client + twin read this)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "sprite": self.sprite,
            "elite": self.elite,
            "boss": self.boss,
        }


SKELETON = EnemyDef(
    id="skeleton", name="Bone Knight", health=62, damage=11, speed=92,
    attack_range=44, aggro_range=260, attack_cooldown=1.3, attack_windup=0.42,
    behavior=EnemyBehavior.CHARGE, size=14, xp_reward=24, sprite="skeleton",
    tags=("MELEE",), knockback=140, loot=LootTable(1, 3, 0.05, 0.10, 0.06), role="melee",
)

ARCHER = EnemyDef(
    id="archer", name="Hollow Archer", health=42, damage=13, speed=78,
    attack_range=300, aggro_range=380, attack_cooldown=1.9, attack_windup=0.55,
    behavior=EnemyBehavior.KEEP_DISTANCE, size=12, xp_reward=28, sprite="archer",
    tags=("RANGED",), knockback=60,
    projectile=ProjectileSpec(kind="bone_arrow", speed=330, radius=5, lifetime=1.6),
    loot=LootTable(1, 3, 0.08, 0.08, 0.10), role="ranged",
)

HOUND = EnemyDef(
    id="hound", name="Gloom Hound", health=38, damage=9, speed=210,
    attack_range=36, aggro_range=340, attack_cooldown=0.9, attack_windup=0.22,
    behavior=EnemyBehavior.DART, size=12, xp_reward=22, sprite="hound",
    tags=("MELEE", "FAST"), knockback=90, loot=LootTable(1, 2, 0.04, 0.06, 0.04), role="fast",
)

SLIME = EnemyDef(
    id="slime", name="Mire Slime", health=115, damage=15, speed=48,
    attack_range=40, aggro_range=220, attack_cooldown=1.8, attack_windup=0.6,
    behavior=EnemyBehavior.TANK, size=18, xp_reward=34, sprite="slime",
    tags=("MELEE", "HEAVY"), knockback=200, knockback_resist=0.7,
    loot=LootTable(2, 4, 0.10, 0.14, 0.06), role="tank",
)

# --- the grove and the ruins -----------------------------------------------------
# The three creatures from docs/art-prompts-2.md that main does not already have.
# Their art was drawn and is already loaded; without these the grove has no weak
# melee and no ranged mob of its own, and the ruins have no weak melee. Stats are
# new -- the doc is an art brief, not a balance sheet -- but the name, biome and
# combat role of each come from it.

SPROUT = EnemyDef(
    id="sprout", name="Bramble Sprout", health=26, damage=7, speed=104,
    attack_range=38, aggro_range=240, attack_cooldown=1.1, attack_windup=0.34,
    behavior=EnemyBehavior.CHARGE, size=11, xp_reward=14, sprite="sprout",
    tags=("MELEE",), knockback=90, loot=LootTable(1, 2, 0.03, 0.06, 0.04), role="melee",
)


SPITTER = EnemyDef(
    id="spitter", name="Thorn Spitter", health=40, damage=11, speed=74,
    attack_range=280, aggro_range=360, attack_cooldown=1.7, attack_windup=0.5,
    behavior=EnemyBehavior.KEEP_DISTANCE, size=12, xp_reward=26, sprite="spitter",
    tags=("RANGED",), knockback=50,
    projectile=ProjectileSpec(kind="thorn", speed=300, radius=5, lifetime=1.6),
    loot=LootTable(1, 3, 0.07, 0.08, 0.10), role="ranged",
)

SHARDLING = EnemyDef(
    id="shardling", name="Shardling", health=30, damage=8, speed=112,
    attack_range=38, aggro_range=250, attack_cooldown=1.05, attack_windup=0.3,
    behavior=EnemyBehavior.CHARGE, size=11, xp_reward=16, sprite="shardling",
    tags=("MELEE",), knockback=95, loot=LootTable(1, 2, 0.04, 0.06, 0.05), role="melee",
)





# --- the crypt -----------------------------------------------------------------

MIRROR = EnemyDef(
    id="mirror", name="The Mirror", health=520, damage=16, speed=190,
    attack_range=70, aggro_range=2000, attack_cooldown=1.0, attack_windup=0.3,
    behavior=EnemyBehavior.MIRROR, size=15, xp_reward=400, sprite="mirror",
    tags=("MELEE", "RANGED", "SPELL"), knockback=200, knockback_resist=0.85,
    projectile=ProjectileSpec(kind="mirror_bolt", speed=430, radius=7, lifetime=1.3),
    loot=LootTable(12, 20, 1.0, 0.5, 0.5, relic_chance=1.0), boss=True, role="boss",
)

# --- added archetypes --------------------------------------------------------
# Each one exists because it asks the player a question the others do not.
# Variants that only change a number were deliberately not added.

ACOLYTE = EnemyDef(
    # The control question: it never closes, and its bolt slows you, so ignoring
    # it while you fight something else is how a fight gets away from you.
    id="acolyte", name="Ash Acolyte", health=48, damage=10, speed=84,
    attack_range=340, aggro_range=420, attack_cooldown=2.4, attack_windup=0.75,
    behavior=EnemyBehavior.KEEP_DISTANCE, size=13, xp_reward=36, sprite="acolyte",
    tags=("RANGED", "SPELL"), knockback=40,
    projectile=ProjectileSpec(kind="acolyte_bolt", speed=270, radius=8, lifetime=2.0,
                              slow=0.55, slow_duration=1.8),
    loot=LootTable(2, 4, 0.12, 0.08, 0.16), role="ranged",
)

BRUTE = EnemyDef(
    # The spacing question: a long, obvious wind-up that hurts badly, and a body
    # that barely flinches. You are meant to see it coming and leave.
    id="brute", name="Crypt Brute", health=180, damage=26, speed=62,
    attack_range=62, aggro_range=280, attack_cooldown=2.6, attack_windup=0.95,
    behavior=EnemyBehavior.TANK, size=22, xp_reward=58, sprite="brute",
    tags=("MELEE", "HEAVY"), knockback=300, knockback_resist=0.8,
    loot=LootTable(4, 7, 0.25, 0.20, 0.10, weapon_chance=0.12), role="tank",
)

SCARAB = EnemyDef(
    # The positioning question: individually trivial, but they arrive in numbers
    # and surround you, so standing still stops being free.
    id="scarab", name="Husk Scarab", health=16, damage=5, speed=185,
    attack_range=28, aggro_range=380, attack_cooldown=0.7, attack_windup=0.15,
    behavior=EnemyBehavior.DART, size=9, xp_reward=8, sprite="scarab",
    tags=("MELEE", "FAST", "SWARM"), knockback=40,
    # A swarm pays per swarm, not per body, or a room of them out-earns a boss.
    loot=LootTable(1, 1, 0.0, 0.02, 0.02, gold_min=0, gold_max=2), role="fast",
)

WARDEN = EnemyDef(
    # The guardian at the bottom of the Ashen Deep. Readable mechanic: it is a
    # tank that keeps hitting the same place, so it is beaten by moving, which
    # is the lesson the Mirror will later punish you for over-learning.
    id="warden", name="The Ashen Warden", health=420, damage=30, speed=96,
    attack_range=84, aggro_range=900, attack_cooldown=2.0, attack_windup=0.85,
    behavior=EnemyBehavior.TANK, size=26, xp_reward=260, sprite="warden",
    tags=("MELEE", "HEAVY", "GUARDIAN"), knockback=340, knockback_resist=0.85,
    loot=LootTable(10, 16, 1.0, 0.4, 0.4, weapon_chance=0.5, relic_chance=0.6),
    elite=True, role="tank",
)

ARCHETYPES: dict[str, EnemyDef] = {
    e.id: e
    for e in (
        SKELETON, ARCHER, HOUND, SLIME, ACOLYTE, BRUTE, SCARAB, WARDEN, MIRROR,
        SPROUT, SPITTER, SHARDLING,
    )
}

# Aliases used by earlier templates.
ARCHETYPES["ranged_skeleton"] = ARCHER


def elite_of(base: EnemyDef) -> EnemyDef:
    """An elite variant: tougher, meaner, better loot, same behaviour."""
    return replace(
        base,
        id=f"elite_{base.id}",
        name=f"Elite {base.name}",
        health=base.health * 2.2,
        damage=base.damage * 1.4,
        speed=base.speed * 1.12,
        size=base.size * 1.25,
        xp_reward=int(base.xp_reward * 2.5),
        knockback_resist=min(0.9, base.knockback_resist + 0.3),
        loot=LootTable(
            base.loot.essence_min * 3, base.loot.essence_max * 3,
            shard_chance=0.9, potion_chance=0.3, mana_potion_chance=0.2,
            weapon_chance=0.35, relic_chance=0.15,
        ),
        elite=True,
    )


def scaled_for_region(base: EnemyDef, difficulty: float) -> EnemyDef:
    """Region scaling: the same archetype is meaningfully harder deeper in.

    Health and damage only. Speed, range and wind-up are left alone on purpose:
    those are what the player has learned to read, and scaling them would make
    a later skeleton a different enemy wearing the same telegraph.
    """
    if difficulty == 1.0:
        return base
    return replace(
        base,
        health=round(base.health * difficulty, 1),
        damage=round(base.damage * (1.0 + (difficulty - 1.0) * 0.7), 1),
        xp_reward=int(base.xp_reward * difficulty),
    )


def get_archetype(name: str, difficulty: float = 1.0) -> EnemyDef:
    if name.startswith("elite_"):
        return scaled_for_region(elite_of(get_archetype(name[len("elite_"):])), difficulty)
    if name not in ARCHETYPES:
        raise ValueError(f"Unknown enemy archetype: {name}")
    return scaled_for_region(ARCHETYPES[name], difficulty)


@dataclass
class Enemy(Entity):
    """Enemy entity; the controller drives the state machine."""
    enemy_def: EnemyDef = SKELETON
    state: EnemyState = EnemyState.IDLE
    attack_timer: float = 0.0        # cooldown until next attack may start
    windup_timer: float = 0.0        # time left before the current attack lands
    state_timer: float = 0.0
    target_id: str | None = None
    # Who has hurt this enemy and by how much (decays): drives target choice so
    # the twin can actually pull aggro by hitting things.
    threat: dict[str, float] = field(default_factory=dict)
    wander_target: Vec2 | None = None
    reposition_target: Vec2 | None = None
    home: Vec2 = field(default_factory=Vec2)
    hits_taken: int = 0
    stagger: float = 0.0             # brief hit-stun; interrupts wind-ups

    def __post_init__(self):
        self.health = self.enemy_def.health
        self.max_health = self.enemy_def.health
        self.radius = self.enemy_def.size
        self.home = self.position.copy()

    @property
    def damage(self) -> float:
        return self.enemy_def.damage

    @property
    def xp_reward(self) -> int:
        return self.enemy_def.xp_reward

    @property
    def speed(self) -> float:
        return self.enemy_def.speed * self.slow_factor

    @property
    def is_winding_up(self) -> bool:
        return self.state is EnemyState.ATTACK and self.windup_timer > 0

    def set_state(self, state: EnemyState) -> None:
        if state is not self.state:
            self.state = state
            self.state_timer = 0.0

    def add_threat(self, source_id: str, amount: float) -> None:
        self.threat[source_id] = self.threat.get(source_id, 0.0) + amount

    def top_threat(self) -> str | None:
        if not self.threat:
            return None
        return max(self.threat.items(), key=lambda kv: kv[1])[0]

    def take_hit(self, amount: float, source_id: str | None = None) -> float:
        actual = self.take_damage(amount)
        if actual > 0:
            self.hits_taken += 1
            if source_id:
                self.add_threat(source_id, actual)
            # A solid hit interrupts a wind-up on everything but bosses/tanks.
            if self.enemy_def.knockback_resist < 0.6:
                self.stagger = 0.18
                if self.state is EnemyState.ATTACK:
                    self.windup_timer = 0
                    self.set_state(EnemyState.CHASE)
        if self.health <= 0:
            self.set_state(EnemyState.DEAD)
        return actual

    def distance_to_pos(self, pos: Vec2) -> float:
        return (self.position - pos).length()

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "type": self.enemy_def.id,
            "name": self.enemy_def.name,
            "role": self.enemy_def.role,
            "sprite": self.enemy_def.sprite,
            "elite": self.enemy_def.elite,
            "boss": self.enemy_def.boss,
            "state": self.state.value,
            "targetId": self.target_id,
            "windingUp": self.is_winding_up,
            "windup": round(self.windup_timer, 2),
        })
        return base
