import pytest

from mirrorbound.game.inventory import Inventory
from mirrorbound.game.progression.progression import xp_to_next
from mirrorbound.game.progression.skills import CATEGORIES, SKILLS, can_unlock, modifiers_for, tree_to_dict


def test_every_branch_runs_four_tiers_deep():
    for cat in CATEGORIES:
        tiers = sorted(n.tier for n in SKILLS.values() if n.category == cat)
        assert tiers == [1, 2, 3, 4], cat


def test_the_tree_is_not_just_percentages():
    """§16: "every skill should change gameplay".

    The beta's twelve nodes were twelve numbers, so picking a branch changed how
    hard you hit rather than how you played. The flat multipliers are allowed to
    stay at tier 1 -- the first point in a branch should be a small, safe
    commitment that says what the branch is about -- but everything past that
    has to turn something on.
    """
    behavioural = ("dash_charges", "riposte_window", "extra_combo_step",
                   "cooldown_on_kill", "drink_on_the_move", "cast_on_the_move",
                   "dash_through", "last_stand_seconds", "twin_learning_mult",
                   "twin_damage_mult", "twin_recovery_mult", "twin_shares_damage")
    deep = [n for n in SKILLS.values() if n.tier >= 3]
    for node in deep:
        assert any(getattr(node, field) for field in behavioural), (
            f"{node.id} is tier {node.tier} and only moves numbers")


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

    # The ability bar is derived from the two hands, so swapping weapons swaps
    # the bar -- there is no stored list that can disagree with what is held.
    assert inv.equipped_weapon == "hunter_bow" and inv.offhand_weapon == "iron_sword"
    assert inv.ability_slots == ["arrow_volley", "mending_light", "aegis", "shadow_dash"]

    inv.equip("iron_sword")
    assert inv.ability_slots == ["aegis", "shadow_dash", "arrow_volley", "mending_light"]


def test_empty_hands_leave_only_the_dash():
    assert Inventory().ability_slots == ["shadow_dash"]


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
