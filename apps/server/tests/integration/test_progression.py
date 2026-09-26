"""The tree, the bench, and the two things essence was never for.

§16 wants a skill tree where every node changes gameplay rather than a list of
percentages, §17 wants weapons with identities, and §18 wants an economy with
somewhere for its resources to go. The three are one system: what you carry,
what you have spent on it, and what you have learned to do with it.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.combat.weapons import (
    MAX_UPGRADE, UPGRADE_DAMAGE, WEAPONS, canonical_weapon_ids, upgrade_cost,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player
from mirrorbound.game.inventory import Inventory
from mirrorbound.game.progression.skills import CATEGORIES, SKILLS, modifiers_for
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import CampaignState
from mirrorbound.game.world.npc import TALK_RADIUS, VILLAGE_NPCS

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def armed(*skills: str) -> Player:
    p = Player(id="p")
    p.unlocked_skills = set(skills)
    p.recompute_max_health()
    return p


# --- the tree changes how the game plays (§16) --------------------------------

def test_the_tree_is_five_branches_four_deep_with_prerequisites_all_the_way():
    assert len(SKILLS) == len(CATEGORIES) * 4
    for node in SKILLS.values():
        if node.tier == 1:
            assert not node.requires, node.id
        else:
            assert node.requires, node.id
            parent = SKILLS[node.requires[0]]
            assert parent.category == node.category and parent.tier == node.tier - 1


def test_executioner_adds_a_swing_to_a_chain_and_not_to_a_bow():
    """A fourth beat on a sword fight. An extra arrow would just be damage."""
    from mirrorbound.game.combat.weapons import HUNTER_BOW, IRON_SWORD

    plain, deep = armed(), armed("keen_edge", "heavy_hands", "riposte", "executioner")
    assert len(deep.combo_chain_for(IRON_SWORD)) == len(plain.combo_chain_for(IRON_SWORD)) + 1
    assert deep.combo_chain_for(IRON_SWORD)[-1] > plain.combo_chain_for(IRON_SWORD)[-1]
    assert deep.combo_chain_for(HUNTER_BOW) == plain.combo_chain_for(HUNTER_BOW)


def test_riposte_only_pays_inside_its_window():
    p = armed("keen_edge", "heavy_hands", "riposte")
    assert p.riposte_multiplier(10.0) == 1.0, "no dodge, no riposte"
    p.note_dodge(10.0)
    assert p.riposte_multiplier(10.2) == 2.0
    assert p.riposte_multiplier(10.9) == 1.0, "the window closed"


def test_steady_hand_and_overflow_let_you_keep_moving():
    plain, deep = armed(), armed("vitality", "second_wind", "steady_hand")
    plain.set_state("drink")
    deep.set_state("drink")
    assert deep.input_speed(False) > plain.input_speed(False)

    caster = armed("arcane_focus", "pyromancer", "overflow")
    plain.set_state("cast")
    caster.set_state("cast")
    assert caster.input_speed(False) > plain.input_speed(False)


def test_doublestep_is_a_second_dash_before_the_cooldown():
    from mirrorbound.game.combat.abilities import SHADOW_DASH

    p = armed("swift_feet", "shadow_step", "phase_walker", "doublestep")
    p.mana = 200
    p.start_ability(SHADOW_DASH)
    assert SHADOW_DASH.id not in p.ability_cooldowns, "the first of two is free of the wait"
    p.start_ability(SHADOW_DASH)
    assert p.ability_cooldowns[SHADOW_DASH.id] > 0, "and the second starts it"

    plain = armed()
    plain.mana = 200
    plain.start_ability(SHADOW_DASH)
    assert plain.ability_cooldowns[SHADOW_DASH.id] > 0, "without the node, one dash"


def test_last_stand_catches_one_killing_blow_and_then_waits():
    p = armed("vitality", "second_wind", "steady_hand", "iron_skin")
    p.health = 5
    assert p.survive_lethal(100.0)
    assert p.health == 1
    p.health = 5
    assert not p.survive_lethal(160.0), "still cooling down"
    assert p.survive_lethal(260.0), "and ready again later"


def test_the_mirror_branch_is_about_the_twin_and_nothing_else():
    mirror = [n for n in SKILLS.values() if n.category == "MIRROR"]
    assert len(mirror) == 4
    for node in mirror:
        assert (node.twin_learning_mult or node.twin_damage_mult
                or node.twin_recovery_mult or node.twin_shares_damage), node.id


def test_kindling_takes_a_second_off_everything_cooling():
    from mirrorbound.game.combat.abilities import FLAME_BURST

    s = GameSession("kindling", seed=5, record=False, start_area="wakewood_crypt")
    p = s.state.player
    p.unlocked_skills = {"arcane_focus", "pyromancer", "overflow", "kindling"}
    p.recompute_max_health()
    p.ability_cooldowns[FLAME_BURST.id] = 4.0

    enemy = s.state.spawn_enemy("skeleton", p.position + Vec2(60, 0))
    s.combat.damage_enemy(s.state, enemy, 10_000, p.id, [], Vec2(1, 0), 0.0, "test")
    assert p.ability_cooldowns[FLAME_BURST.id] == pytest.approx(3.0)


# --- weapons with identities (§17) ---------------------------------------------

def test_the_new_weapons_are_archetypes_rather_than_better_numbers():
    sword, pike = WEAPONS["iron_sword"], WEAPONS["warden_pike"]
    assert pike.range > sword.range * 1.5, "the pike's argument is reach"
    assert pike.cooldown > sword.cooldown, "paid for in speed"
    assert pike.arc_angle < sword.arc_angle, "and in having to point it"

    lance, frost = WEAPONS["shard_lance"], WEAPONS["frost_staff"]
    assert set(lance.abilities) != set(frost.abilities)


def test_no_weapon_grants_an_ability_the_boss_does_not_pay_for():
    """A boss has no mana, so its abilities cost none. On a weapon that is free
    damage -- which is how the Shard Lance first shipped, and why this is here."""
    from mirrorbound.game.combat.abilities import ABILITIES

    for weapon_id in canonical_weapon_ids(include_admin=True):
        for ability_id in WEAPONS[weapon_id].abilities:
            ability = ABILITIES[ability_id]
            assert ability.cost > 0 or ability.type.value == "dash", (weapon_id, ability_id)


def test_every_weapon_has_something_the_bench_can_give_it():
    for weapon_id in canonical_weapon_ids():
        weapon = WEAPONS[weapon_id]
        if weapon_id == "bare_hands":
            continue
        assert weapon.perk and weapon.perk_name, weapon_id


# --- the bench, and where essence goes (§18) ------------------------------------

def test_upgrading_spends_the_two_resources_that_had_no_sink():
    """`RESOURCES` has described shards as fuel "for relic crafting later" since
    the beta, and essence is the commonest drop in the game. Neither was
    spendable on anything."""
    inv = Inventory()
    inv.add_weapon("iron_sword")
    inv.gold, inv.resources["shards"], inv.resources["essence"] = 2000, 40, 200

    for tier in range(MAX_UPGRADE):
        cost = upgrade_cost(tier)
        gold, shards, essence = inv.gold, inv.resources["shards"], inv.resources["essence"]
        assert inv.upgrade("iron_sword") == (True, "ok")
        assert inv.gold == gold - cost["gold"]
        assert inv.resources["shards"] == shards - cost["shards"]
        assert inv.resources["essence"] == essence - cost["essence"]
    assert inv.tier("iron_sword") == MAX_UPGRADE
    assert inv.upgrade("iron_sword") == (False, "already finished")


def test_a_refused_upgrade_spends_nothing():
    inv = Inventory()
    inv.add_weapon("iron_sword")
    inv.gold, inv.resources["shards"] = 10, 0
    before = (inv.gold, dict(inv.resources), dict(inv.upgrades))
    assert inv.upgrade("iron_sword")[0] is False
    assert (inv.gold, dict(inv.resources), dict(inv.upgrades)) == before


def test_an_upgrade_follows_the_weapon_and_not_the_player():
    """A sword worked to its third tier does nothing for the bow in the other
    hand, which is what makes the bench a choice about what you carry."""
    p = armed()
    p.inventory.add_weapon("iron_sword")
    p.inventory.add_weapon("hunter_bow")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE

    p.inventory.equip("iron_sword")
    worked = p.weapon_damage_multiplier()
    p.inventory.equip("hunter_bow")
    plain = p.weapon_damage_multiplier()
    assert worked == pytest.approx(plain + UPGRADE_DAMAGE[MAX_UPGRADE])


def test_the_smith_works_a_weapon_and_a_stranger_does_not():
    s = GameSession("bench", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.gold, p.inventory.resources["shards"] = 1000, 20

    smith = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    elder = next(n for n in s.state.room.npcs if n.definition.role == "elder")

    # The elder is not a smith, whatever you are standing next to.
    p.position = Vec2(elder.x, elder.y + 40)
    s.handle_input({"type": "COMMAND", "action": "UPGRADE_WEAPON",
                    "npcId": elder.id, "weaponId": "iron_sword"})
    s.step(DT)
    assert p.inventory.tier("iron_sword") == 0

    p.position = Vec2(smith.x, smith.y + TALK_RADIUS * 0.5)
    s.handle_input({"type": "COMMAND", "action": "UPGRADE_WEAPON",
                    "npcId": smith.id, "weaponId": "iron_sword"})
    s.step(DT)
    assert p.inventory.tier("iron_sword") == 1
    assert [e for e in s.state.pending_events if e.type == "WEAPON_UPGRADED"]


def test_you_cannot_upgrade_from_across_the_village():
    s = GameSession("far-bench", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.gold, p.inventory.resources["shards"] = 1000, 20
    smith = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    p.position = Vec2(smith.x + 600, smith.y)
    s.handle_input({"type": "COMMAND", "action": "UPGRADE_WEAPON",
                    "npcId": smith.id, "weaponId": "iron_sword"})
    s.step(DT)
    assert p.inventory.tier("iron_sword") == 0
    assert any(e.data.get("reason") == "too far"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")


def test_upgrades_survive_a_checkpoint():
    from mirrorbound.game.entities.twin import Twin

    player = armed()
    player.inventory.add_weapon("iron_sword")
    player.inventory.upgrades["iron_sword"] = 2
    data = save_system.build_save("s", CampaignState(), player, Twin(id="t"))

    restored = Player(id="p2")
    save_system.apply_save(data, restored, Twin(id="t2"))
    assert restored.inventory.tier("iron_sword") == 2


def test_the_mountain_smith_sells_what_a_mountain_smith_would():
    hask = next(n for n in VILLAGE_NPCS["emberfall"] if n.role == "weaponsmith")
    stocked = {e.item_id for e in hask.stock}
    assert {"warden_pike", "shard_lance"} <= stocked


def test_the_inventory_tells_the_client_what_the_next_tier_costs():
    inv = Inventory()
    inv.add_weapon("iron_sword")
    row = next(w for w in inv.to_dict()["weapons"] if w["id"] == "iron_sword")
    assert row["tier"] == 0 and row["hasPerk"] is False
    assert row["upgradeCost"] == upgrade_cost(0)
    assert row["perkName"]
