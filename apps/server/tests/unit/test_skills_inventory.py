import pytest

from mirrorbound.game.inventory import Inventory
from mirrorbound.game.progression.progression import xp_to_next
from mirrorbound.game.progression.skills import CATEGORIES, SKILLS, can_unlock, modifiers_for, tree_to_dict


def test_tree_has_all_four_categories_with_three_tiers():
    for cat in CATEGORIES:
        tiers = sorted(n.tier for n in SKILLS.values() if n.category == cat)
        assert tiers == [1, 2, 3]


def test_prerequisites_gate_unlocks():
    ok, reason = can_unlock("shadow_step", set(), skill_points=5)
    assert not ok and "Swift Feet" in reason
    ok, _ = can_unlock("swift_feet", set(), skill_points=1)
    assert ok
    ok, reason = can_unlock("swift_feet", set(), skill_points=0)
    assert not ok and "skill points" in reason
    ok, reason = can_unlock("swift_feet", {"swift_feet"}, skill_points=3)
    assert not ok and "already" in reason


def test_modifiers_fold_additively():
    mods = modifiers_for({"swift_feet", "keen_edge", "vitality"})
    assert mods.speed_mult == pytest.approx(1.12)
    assert mods.weapon_damage_mult == pytest.approx(1.15)
    assert mods.max_health_bonus == 30
    assert mods.damage_taken_mult == 1.0  # iron_skin not unlocked


def test_tree_to_dict_marks_availability():
    rows = {r["id"]: r for r in tree_to_dict({"swift_feet"}, skill_points=1)}
    assert rows["swift_feet"]["unlocked"]
    assert rows["shadow_step"]["available"]
    assert not rows["phase_walker"]["available"]


def test_xp_curve_grows():
    assert xp_to_next(1) < xp_to_next(2) < xp_to_next(5)


def test_inventory_weapons_equip_and_slots():
    inv = Inventory()
    assert inv.add_weapon("iron_sword")
    assert not inv.add_weapon("iron_sword")
    assert inv.equipped_weapon == "iron_sword"
    assert not inv.equip("hunter_bow")
    inv.add_weapon("hunter_bow")
    assert inv.equip("hunter_bow")
    # swapping ability slots keeps them unique
    inv.set_slot(1, "shadow_dash")
    assert inv.ability_slots.count("shadow_dash") == 1
    assert inv.ability_slots[0] == "shadow_dash"
    assert "arcane_bolt" in inv.ability_slots


def test_inventory_stackables_and_relics():
    inv = Inventory()
    inv.add_consumable("health_potion", 2)
    assert inv.take_consumable("health_potion")
    assert inv.take_consumable("health_potion")
    assert not inv.take_consumable("health_potion")
    inv.add_resource("essence", 5)
    assert inv.resources["essence"] == 5
    inv.add_relic("wolf_fang")
    assert inv.relic_bonus("weapon_damage_mult") == pytest.approx(0.10)
    with pytest.raises(ValueError):
        inv.add_resource("gold", 1)
    d = inv.to_dict()
    assert d["relics"][0]["id"] == "wolf_fang"
