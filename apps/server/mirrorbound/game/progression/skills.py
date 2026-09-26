"""The skill tree: five branches, four tiers each.

Nodes are data. `StatModifiers` is the only thing the rest of the game reads —
it folds every unlocked node into the numbers `Player.derived_stats()` applies
and the **behaviours** the combat and movement systems check.

That second half is the point of the v1.1 expansion here. The beta had twelve
nodes and all twelve were percentages, so the tree was a list of small numbers
and picking a branch changed how hard you hit rather than how you played. §16 is
explicit: "do NOT simply create 30 abilities that all increase damage by 5% --
every skill should change gameplay". So every tier-2 and tier-3 node in this
tree turns something on that was not there before: a fourth swing, a second
dash, a parry window, drinking on the move, a kill that refunds a cooldown.

The flat multipliers survive at tier 1, where they belong: the first point in a
branch should be a small, safe commitment that says what the branch is about.

Prerequisites run down the branch, so specialising costs the alternatives —
which is what makes it a choice rather than a shopping list.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SkillNode:
    id: str
    name: str
    category: str          # MOBILITY | COMBAT | MAGIC | SURVIVAL
    tier: int              # 1..3, tier N requires a tier N-1 node in the same branch
    cost: int              # skill points
    description: str
    requires: tuple[str, ...] = ()
    # Effects, applied additively into StatModifiers.
    speed_mult: float = 0.0
    dash_cooldown_mult: float = 0.0
    dash_invuln_bonus: float = 0.0
    weapon_damage_mult: float = 0.0
    knockback_mult: float = 0.0
    crit_chance_bonus: float = 0.0
    max_mana_bonus: float = 0.0
    spell_damage_mult: float = 0.0
    mana_regen_mult: float = 0.0
    max_health_bonus: float = 0.0
    heal_on_clear: float = 0.0
    damage_taken_mult: float = 0.0
    ability_cooldown_mult: float = 0.0
    # --- behaviours, not numbers ---------------------------------------------
    #
    # §16's requirement. Each of these turns something on that the combat,
    # movement or twin systems check for; none of them is a percentage.
    #: Extra dashes available before the cooldown starts.
    dash_charges: int = 0
    #: Seconds after a dodge during which a strike counts as a riposte.
    riposte_window: float = 0.0
    riposte_mult: float = 0.0
    #: Extra hits on the end of a melee chain.
    extra_combo_step: int = 0
    #: Seconds taken off every cooling ability when something dies.
    cooldown_on_kill: float = 0.0
    #: Drinking no longer slows you.
    drink_on_the_move: bool = False
    #: Casting no longer slows you.
    cast_on_the_move: bool = False
    #: A dash goes through whatever is standing in the way.
    dash_through: bool = False
    #: A killing blow leaves you at 1 instead, at most this often.
    last_stand_seconds: float = 0.0
    #: How much faster the twin learns, and how much harder it hits.
    twin_learning_mult: float = 0.0
    twin_damage_mult: float = 0.0
    #: Change to how long the twin stays down (negative is faster).
    twin_recovery_mult: float = 0.0
    #: Fraction of a hit the twin takes instead, while it is protecting you.
    twin_shares_damage: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "tier": self.tier,
            "cost": self.cost,
            "description": self.description,
            "requires": list(self.requires),
        }


SKILLS: dict[str, SkillNode] = {
    n.id: n
    for n in (
        # --- MOBILITY: where you are, and how fast you stop being there ------
        SkillNode("swift_feet", "Swift Feet", "MOBILITY", 1, 1,
                  "+12% movement speed.", speed_mult=0.12),
        SkillNode("shadow_step", "Shadow Step", "MOBILITY", 2, 1,
                  "Shadow Dash cooldown -30%.", requires=("swift_feet",),
                  dash_cooldown_mult=-0.30),
        SkillNode("phase_walker", "Phase Walker", "MOBILITY", 3, 2,
                  "Dash straight through anything in the way, and stay untouchable "
                  "0.2s longer while you do.",
                  requires=("shadow_step",), dash_invuln_bonus=0.2, dash_through=True),
        SkillNode("doublestep", "Doublestep", "MOBILITY", 4, 3,
                  "A second dash, straight after the first, before the cooldown starts.",
                  requires=("phase_walker",), dash_charges=1),

        # --- COMBAT: what a swing is -----------------------------------------
        SkillNode("keen_edge", "Keen Edge", "COMBAT", 1, 1,
                  "+15% weapon damage.", weapon_damage_mult=0.15),
        SkillNode("heavy_hands", "Heavy Hands", "COMBAT", 2, 1,
                  "+40% knockback on hits.", requires=("keen_edge",), knockback_mult=0.40),
        SkillNode("riposte", "Riposte", "COMBAT", 3, 2,
                  "Striking within 0.4s of dodging a blow hits for double.",
                  requires=("heavy_hands",), riposte_window=0.4, riposte_mult=2.0),
        SkillNode("executioner", "Executioner", "COMBAT", 4, 3,
                  "A fourth swing on the end of every melee chain, and +12% critical chance.",
                  requires=("riposte",), extra_combo_step=1, crit_chance_bonus=0.12),

        # --- MAGIC: what casting costs ----------------------------------------
        SkillNode("arcane_focus", "Arcane Focus", "MAGIC", 1, 1,
                  "+25 maximum mana.", max_mana_bonus=25),
        SkillNode("pyromancer", "Pyromancer", "MAGIC", 2, 1,
                  "+25% spell damage.", requires=("arcane_focus",), spell_damage_mult=0.25),
        SkillNode("overflow", "Overflow", "MAGIC", 3, 2,
                  "Cast at a walk instead of a standstill. +60% mana regeneration, "
                  "ability cooldowns -15%.",
                  requires=("pyromancer",), mana_regen_mult=0.60, ability_cooldown_mult=-0.15,
                  cast_on_the_move=True),
        SkillNode("kindling", "Kindling", "MAGIC", 4, 3,
                  "A kill takes a second off every ability still cooling down.",
                  requires=("overflow",), cooldown_on_kill=1.0),

        # --- SURVIVAL: staying up ----------------------------------------------
        SkillNode("vitality", "Vitality", "SURVIVAL", 1, 1,
                  "+30 maximum health.", max_health_bonus=30),
        SkillNode("second_wind", "Second Wind", "SURVIVAL", 2, 1,
                  "Clearing a room heals 25 health.", requires=("vitality",), heal_on_clear=25),
        SkillNode("steady_hand", "Steady Hand", "SURVIVAL", 3, 2,
                  "Drink at walking pace: potions no longer slow you.",
                  requires=("second_wind",), drink_on_the_move=True),
        SkillNode("iron_skin", "Iron Skin", "SURVIVAL", 4, 3,
                  "Take 15% less damage, and a hit that would kill you leaves you at 1 once "
                  "every two minutes.",
                  requires=("steady_hand",), damage_taken_mult=-0.15, last_stand_seconds=120.0),

        # --- MIRROR: the branch about the thing following you -------------------
        #
        # New in v1.1, and the one that could not have existed in the beta: the
        # twin is the game's subject, and until now nothing in the tree was
        # about it. Every node here changes what the twin does rather than what
        # the player's numbers are.
        SkillNode("shared_sight", "Shared Sight", "MIRROR", 1, 1,
                  "Your twin learns your habits 25% faster.", twin_learning_mult=0.25),
        SkillNode("close_order", "Close Order", "MIRROR", 2, 1,
                  "Your twin hits for 75% of a weapon's damage instead of 60%.",
                  requires=("shared_sight",), twin_damage_mult=0.25),
        SkillNode("covering_fire", "Covering Fire", "MIRROR", 3, 2,
                  "Your twin is back on its feet in 4 seconds instead of 9.",
                  requires=("close_order",), twin_recovery_mult=-0.55),
        SkillNode("reflection", "Reflection", "MIRROR", 4, 3,
                  "While your twin is protecting you, it takes a third of what you would have.",
                  requires=("covering_fire",), twin_shares_damage=0.33),
    )
}

CATEGORIES = ("MOBILITY", "COMBAT", "MAGIC", "SURVIVAL", "MIRROR")


@dataclass
class StatModifiers:
    speed_mult: float = 1.0
    dash_cooldown_mult: float = 1.0
    dash_invuln_bonus: float = 0.0
    weapon_damage_mult: float = 1.0
    knockback_mult: float = 1.0
    crit_chance_bonus: float = 0.0
    max_mana_bonus: float = 0.0
    spell_damage_mult: float = 1.0
    mana_regen_mult: float = 1.0
    max_health_bonus: float = 0.0
    heal_on_clear: float = 0.0
    damage_taken_mult: float = 1.0
    ability_cooldown_mult: float = 1.0
    # --- behaviours ------------------------------------------------------------
    dash_charges: int = 0
    riposte_window: float = 0.0
    #: 0 when nothing grants a riposte; `Player.riposte_multiplier` reads it as
    #: 1.0 then. Defaulting this to 1.0 and adding the node's 2.0 on top made a
    #: riposte hit for *triple* -- the node says double and it should mean it.
    riposte_mult: float = 0.0
    extra_combo_step: int = 0
    cooldown_on_kill: float = 0.0
    drink_on_the_move: bool = False
    cast_on_the_move: bool = False
    dash_through: bool = False
    last_stand_seconds: float = 0.0
    twin_learning_mult: float = 0.0
    twin_damage_mult: float = 0.0
    twin_recovery_mult: float = 1.0
    twin_shares_damage: float = 0.0
    unlocked: list[str] = field(default_factory=list)


def modifiers_for(unlocked: set[str] | list[str]) -> StatModifiers:
    mods = StatModifiers(unlocked=sorted(unlocked))
    for skill_id in unlocked:
        node = SKILLS.get(skill_id)
        if node is None:
            continue
        mods.speed_mult += node.speed_mult
        mods.dash_cooldown_mult += node.dash_cooldown_mult
        mods.dash_invuln_bonus += node.dash_invuln_bonus
        mods.weapon_damage_mult += node.weapon_damage_mult
        mods.knockback_mult += node.knockback_mult
        mods.crit_chance_bonus += node.crit_chance_bonus
        mods.max_mana_bonus += node.max_mana_bonus
        mods.spell_damage_mult += node.spell_damage_mult
        mods.mana_regen_mult += node.mana_regen_mult
        mods.max_health_bonus += node.max_health_bonus
        mods.heal_on_clear += node.heal_on_clear
        mods.damage_taken_mult += node.damage_taken_mult
        mods.ability_cooldown_mult += node.ability_cooldown_mult
        # Behaviours. Additive like the rest, so two nodes granting the same
        # thing would stack rather than one silently winning -- none do today,
        # and the tree would have to say so on purpose for it to happen.
        mods.dash_charges += node.dash_charges
        mods.riposte_window += node.riposte_window
        mods.riposte_mult += node.riposte_mult
        mods.extra_combo_step += node.extra_combo_step
        mods.cooldown_on_kill += node.cooldown_on_kill
        mods.drink_on_the_move = mods.drink_on_the_move or node.drink_on_the_move
        mods.cast_on_the_move = mods.cast_on_the_move or node.cast_on_the_move
        mods.dash_through = mods.dash_through or node.dash_through
        mods.last_stand_seconds = max(mods.last_stand_seconds, node.last_stand_seconds)
        mods.twin_learning_mult += node.twin_learning_mult
        mods.twin_damage_mult += node.twin_damage_mult
        mods.twin_recovery_mult += node.twin_recovery_mult
        mods.twin_shares_damage += node.twin_shares_damage
    return mods


def can_unlock(skill_id: str, unlocked: set[str], skill_points: int) -> tuple[bool, str]:
    node = SKILLS.get(skill_id)
    if node is None:
        return False, "unknown skill"
    if skill_id in unlocked:
        return False, "already unlocked"
    if skill_points < node.cost:
        return False, "not enough skill points"
    for req in node.requires:
        if req not in unlocked:
            return False, f"requires {SKILLS[req].name}"
    return True, "ok"


def tree_to_dict(unlocked: set[str], skill_points: int) -> list[dict]:
    out = []
    for node in SKILLS.values():
        ok, reason = can_unlock(node.id, unlocked, skill_points)
        d = node.to_dict()
        d["unlocked"] = node.id in unlocked
        d["available"] = ok
        d["reason"] = reason
        out.append(d)
    return out
