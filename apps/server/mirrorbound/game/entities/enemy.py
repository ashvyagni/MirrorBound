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

# --- the grove -----------------------------------------------------------------
# Seven archetypes below are the creatures Logesh designed in docs/art-prompts-2.md,
# which assigns each one a biome and a combat role. Stats are new -- the doc is an
# art brief, not a balance sheet -- but every role, name and biome comes from it,
# so the thing you fight matches the thing that was drawn.

SPROUT = EnemyDef(
    id="sprout", name="Bramble Sprout", health=26, damage=7, speed=104,
    attack_range=38, aggro_range=240, attack_cooldown=1.1, attack_windup=0.34,
    behavior=EnemyBehavior.CHARGE, size=11, xp_reward=14, sprite="sprout",
    tags=("MELEE",), knockback=90, loot=LootTable(1, 2, 0.03, 0.06, 0.04), role="melee",
)

BRUTE = EnemyDef(
    id="brute", name="Bark Brute", health=140, damage=19, speed=62,
    attack_range=52, aggro_range=250, attack_cooldown=1.9, attack_windup=0.66,
    behavior=EnemyBehavior.TANK, size=19, xp_reward=40, sprite="brute",
    tags=("MELEE", "HEAVY"), knockback=230, knockback_resist=0.65,
    loot=LootTable(2, 5, 0.12, 0.14, 0.08), role="tank",
)

SPITTER = EnemyDef(
    id="spitter", name="Thorn Spitter", health=40, damage=11, speed=74,
    attack_range=280, aggro_range=360, attack_cooldown=1.7, attack_windup=0.5,
    behavior=EnemyBehavior.KEEP_DISTANCE, size=12, xp_reward=26, sprite="spitter",
    tags=("RANGED",), knockback=50,
    projectile=ProjectileSpec(kind="thorn", speed=300, radius=5, lifetime=1.6),
    loot=LootTable(1, 3, 0.07, 0.08, 0.10), role="ranged",
)

# --- the ruins -----------------------------------------------------------------

SHARDLING = EnemyDef(
    id="shardling", name="Shardling", health=30, damage=8, speed=112,
    attack_range=38, aggro_range=250, attack_cooldown=1.05, attack_windup=0.3,
    behavior=EnemyBehavior.CHARGE, size=11, xp_reward=16, sprite="shardling",
    tags=("MELEE",), knockback=95, loot=LootTable(1, 2, 0.04, 0.06, 0.05), role="melee",
)

WARDEN = EnemyDef(
    # "It is the wall of the biome. It does not chase well; it blocks." -- hence
    # TANK and a deliberately short aggro range: it holds ground rather than
    # crossing the room at you.
    id="warden", name="Pillar Warden", health=175, damage=21, speed=54,
    attack_range=58, aggro_range=210, attack_cooldown=2.1, attack_windup=0.74,
    behavior=EnemyBehavior.TANK, size=20, xp_reward=46, sprite="warden",
    tags=("MELEE", "HEAVY"), knockback=250, knockback_resist=0.78,
    loot=LootTable(3, 6, 0.14, 0.16, 0.08), role="tank",
)

ACOLYTE = EnemyDef(
    id="acolyte", name="Ember Acolyte", health=46, damage=14, speed=80,
    attack_range=310, aggro_range=390, attack_cooldown=2.0, attack_windup=0.6,
    behavior=EnemyBehavior.KEEP_DISTANCE, size=12, xp_reward=32, sprite="acolyte",
    tags=("RANGED", "SPELL"), knockback=70,
    projectile=ProjectileSpec(kind="ember_bolt", speed=320, radius=7, lifetime=1.5),
    loot=LootTable(2, 4, 0.10, 0.08, 0.12), role="ranged",
)

SCARAB = EnemyDef(
    id="scarab", name="Scarab Sentinel", health=44, damage=10, speed=196,
    attack_range=36, aggro_range=340, attack_cooldown=0.95, attack_windup=0.24,
    behavior=EnemyBehavior.DART, size=12, xp_reward=28, sprite="scarab",
    tags=("MELEE", "FAST"), knockback=100, knockback_resist=0.2,
    loot=LootTable(1, 3, 0.06, 0.06, 0.05), role="fast",
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

ARCHETYPES: dict[str, EnemyDef] = {
    e.id: e
    for e in (
        SKELETON, ARCHER, HOUND, SLIME,                      # crypt
        SPROUT, BRUTE, SPITTER,                              # grove
        SHARDLING, WARDEN, ACOLYTE, SCARAB,                  # ruins
        MIRROR,
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


def get_archetype(name: str) -> EnemyDef:
    if name.startswith("elite_"):
        return elite_of(get_archetype(name[len("elite_"):]))
    if name not in ARCHETYPES:
        raise ValueError(f"Unknown enemy archetype: {name}")
    return ARCHETYPES[name]


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
