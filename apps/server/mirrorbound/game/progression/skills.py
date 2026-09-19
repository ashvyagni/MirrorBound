"""The compact skill tree: four branches, three tiers each.

Nodes are data. `StatModifiers` is the only thing the rest of the game reads —
it folds every unlocked node into a handful of multipliers/bonuses that
`Player.derived_stats()` applies.
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
        # MOBILITY
        SkillNode("swift_feet", "Swift Feet", "MOBILITY", 1, 1, "+12% movement speed.", speed_mult=0.12),
        SkillNode("shadow_step", "Shadow Step", "MOBILITY", 2, 1, "Shadow Dash cooldown -30%.", requires=("swift_feet",), dash_cooldown_mult=-0.30),
        SkillNode("phase_walker", "Phase Walker", "MOBILITY", 3, 2, "Dash invulnerability lasts 0.2s longer.", requires=("shadow_step",), dash_invuln_bonus=0.2),
        # COMBAT
        SkillNode("keen_edge", "Keen Edge", "COMBAT", 1, 1, "+15% weapon damage.", weapon_damage_mult=0.15),
        SkillNode("heavy_hands", "Heavy Hands", "COMBAT", 2, 1, "+40% knockback on hits.", requires=("keen_edge",), knockback_mult=0.40),
        SkillNode("executioner", "Executioner", "COMBAT", 3, 2, "+12% critical strike chance.", requires=("heavy_hands",), crit_chance_bonus=0.12),
        # MAGIC
        SkillNode("arcane_focus", "Arcane Focus", "MAGIC", 1, 1, "+25 maximum mana.", max_mana_bonus=25),
        SkillNode("pyromancer", "Pyromancer", "MAGIC", 2, 1, "+25% spell damage.", requires=("arcane_focus",), spell_damage_mult=0.25),
        SkillNode("overflow", "Overflow", "MAGIC", 3, 2, "+60% mana regeneration, ability cooldowns -15%.", requires=("pyromancer",), mana_regen_mult=0.60, ability_cooldown_mult=-0.15),
        # SURVIVAL
        SkillNode("vitality", "Vitality", "SURVIVAL", 1, 1, "+30 maximum health.", max_health_bonus=30),
        SkillNode("second_wind", "Second Wind", "SURVIVAL", 2, 1, "Clearing a room heals 25 health.", requires=("vitality",), heal_on_clear=25),
        SkillNode("iron_skin", "Iron Skin", "SURVIVAL", 3, 2, "Take 15% less damage.", requires=("second_wind",), damage_taken_mult=-0.15),
    )
}

CATEGORIES = ("MOBILITY", "COMBAT", "MAGIC", "SURVIVAL")


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
