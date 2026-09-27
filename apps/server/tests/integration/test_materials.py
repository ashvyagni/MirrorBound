"""Ore, the five attributes, and the forge that joins them.

The v1.2 premise is that these are one economy rather than three features:

    a vein in the ground -> ore in the bag -> a point in an attribute
                                           -> a tier-3 node unlocked
                         -> a material in a weapon -> a different weapon

So the tests that matter most here are the ones that cross those arrows. A test
that only checks `MATERIALS` has eight entries in it proves nothing; a test that
proves a tier-3 node is *refused* until the ground has been dug up is the whole
design in one assertion.

The gate is the specific thing worth guarding. The existing progression tests
set `unlocked_skills` directly to reach the deep nodes they are about, which
means they walk straight past `can_unlock` -- so the gate could be wrong in
every direction and 640 tests would still pass. That is exactly the shape of
failure the v1.1 campaign-walkthrough test was written to catch, and this file
is the same idea applied to a smaller system.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator
from mirrorbound.game.entities.enemy import BRUTE, HOUND, Enemy
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player
from mirrorbound.game.progression.attributes import (
    ATTRIBUTES, BRANCH_ATTRIBUTE, MAX_ATTRIBUTE, POINTS_PER_LEVEL, Attributes, bonuses_for,
)
from mirrorbound.game.progression.materials import (
    MATERIALS, VEIN_TABLE, forge_bonuses, slots_for_tier, training_cost, yield_for,
)
from mirrorbound.game.progression.skills import SKILLS, can_unlock, gate_on
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS, CampaignState
from mirrorbound.game.world.npc import TALK_RADIUS
from mirrorbound.game.world.region import build_region

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def maxed(attribute: str) -> Attributes:
    a = Attributes()
    a.points[attribute] = MAX_ATTRIBUTE
    return a


# --- the gate: the tree cannot be finished by levelling alone -------------------

def test_every_branch_is_gated_by_exactly_one_attribute_and_no_two_share_it():
    branches = {node.category for node in SKILLS.values()}
    assert branches == set(BRANCH_ATTRIBUTE), "a branch with no attribute cannot gate"
    ores = [a.ore for a in ATTRIBUTES.values()]
    assert len(set(ores)) == len(ores), "two attributes fed by one ore is one attribute"
    assert all(ore in MATERIALS for ore in ores)


def test_the_first_two_tiers_are_open_and_the_last_two_are_not():
    for node in SKILLS.values():
        attribute, needed = gate_on(node)
        if node.tier <= 2:
            assert needed == 0, f"{node.id} gates the part of the branch that explains it"
        else:
            assert needed > 0 and attribute, f"{node.id} is deep and ungated"
            assert ATTRIBUTES[attribute].branch == node.category


def test_a_tier_three_node_is_refused_until_the_attribute_is_there():
    # Everything else about the unlock is satisfied: the prerequisites are held
    # and the points are paid for. The only thing missing is the ore.
    unlocked = {"keen_edge", "heavy_hands"}
    ok, reason = can_unlock("riposte", unlocked, 99, Attributes())
    assert not ok and "Might" in reason

    ready = Attributes()
    ready.points["might"] = gate_on(SKILLS["riposte"])[1]
    ok, reason = can_unlock("riposte", unlocked, 99, ready)
    assert ok, reason


def test_the_gate_reads_the_matching_branch_and_not_just_any_attribute():
    """Twenty Vigour must not unlock a COMBAT node. The bug this guards against
    is the easy one: folding all five attributes into a total and comparing that."""
    wrong = maxed("vigour")
    ok, _ = can_unlock("riposte", {"keen_edge", "heavy_hands"}, 99, wrong)
    assert not ok, "Vigour opened a Might gate"


def test_the_player_path_enforces_the_gate_too():
    p = Player(id="p")
    p.skill_points = 30
    assert p.unlock_skill("keen_edge")[0]
    assert p.unlock_skill("heavy_hands")[0]
    ok, reason = p.unlock_skill("riposte")
    assert not ok and "Might" in reason
    p.attributes.points["might"] = 5
    assert p.unlock_skill("riposte")[0], "still refused with the ore paid for"


def test_levels_pay_attribute_points_but_never_enough_to_finish_the_tree():
    p = Player(id="p")
    p.add_xp(100_000)
    earned = p.attributes.unspent
    assert earned == (p.level - 1) * POINTS_PER_LEVEL
    gates = sum(max(gate_on(n)[1] for n in SKILLS.values() if n.category == branch)
                for branch in BRANCH_ATTRIBUTE)
    assert earned < gates, "levelling alone reaches every deep node; mining is pointless"


def test_refunding_attributes_gives_back_the_nodes_it_was_holding_up():
    p = Player(id="p")
    p.skill_points = 30
    p.attributes.points["might"] = 5
    for node in ("keen_edge", "heavy_hands", "riposte"):
        assert p.unlock_skill(node)[0], node
    spent = p.skill_points

    moved = p.refund_attributes()
    assert moved == 5 and p.attributes.unspent == 5
    # The gated node is gone; the ungated ones it was built on are not.
    assert "riposte" not in p.unlocked_skills
    assert {"keen_edge", "heavy_hands"} <= p.unlocked_skills
    assert p.skill_points > spent, "the refunded node's points went nowhere"
    # And the build that comes back is one the rules allow.
    for node in p.unlocked_skills:
        assert gate_on(SKILLS[node])[1] == 0


# --- attributes are worth something --------------------------------------------

def test_a_point_moves_the_number_it_says_it_moves():
    plain, strong = Player(id="a"), Player(id="b")
    strong.attributes.points["vigour"] = 10
    strong.recompute_max_health()
    assert strong.max_health == plain.max_health + 10 * ATTRIBUTES["vigour"].max_health

    caster = Player(id="c")
    caster.attributes.points["focus"] = 10
    assert caster.max_mana > plain.max_mana
    assert caster.spell_damage_multiplier() > plain.spell_damage_multiplier()


def test_hunger_resistance_can_never_reach_immunity():
    assert bonuses_for(maxed("vigour")).hunger_resist <= 0.75


def test_raising_vigour_keeps_the_bar_where_it_was_rather_than_filling_it():
    """The same bargain `recompute_max_health` already makes for a skill node:
    the health *fraction* survives a change of maximum, so a bigger ceiling is
    not a way out of a bad fight. Worth asserting rather than assuming, because
    the obvious implementations are "top up to full" (a free heal at a trainer)
    and "leave the number alone" (a hidden nerf: the same hit points are now a
    smaller share of the bar)."""
    p = Player(id="p")
    p.attributes.grant(2)
    p.health = 40.0
    before = p.health / p.max_health
    p.spend_attribute("vigour")
    p.spend_attribute("vigour")
    assert p.max_health == 100.0 + 2 * ATTRIBUTES["vigour"].max_health
    assert p.health / p.max_health == pytest.approx(before)
    assert p.health < p.max_health, "a trainer healed the player"


# --- the forge changes the weapon's shape, not only its size --------------------

def test_mithril_makes_a_weapon_faster_and_iron_makes_it_slower():
    from mirrorbound.game.combat.weapons import get_weapon

    sword = get_weapon("iron_sword")
    quick, heavy = Player(id="q"), Player(id="h")
    for p, material in ((quick, "mithril"), (heavy, "iron")):
        p.inventory.add_weapon("iron_sword")
        p.inventory.add_material(material)
        assert p.inventory.fit_material("iron_sword", material)[0]
        p.start_attack(sword)

    assert quick.attack_cooldown < sword.cooldown < heavy.attack_cooldown
    # And iron pays for the wait with damage, which is the trade.
    assert heavy.weapon_damage_multiplier() > quick.weapon_damage_multiplier()


def test_no_combination_of_speed_can_make_an_attack_free():
    from mirrorbound.game.combat.weapons import get_weapon

    sword = get_weapon("iron_sword")
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = 3
    p.attributes.points["finesse"] = MAX_ATTRIBUTE
    for _ in range(slots_for_tier(3)):
        p.inventory.add_material("mithril")
        p.inventory.fit_material("iron_sword", "mithril")
    p.start_attack(sword)
    assert p.attack_cooldown >= sword.cooldown * 0.2


def test_gold_is_for_a_staff_and_wrong_in_a_blade():
    good = forge_bonuses(["gold"], "staff")
    bad = forge_bonuses(["gold"], "sword")
    # The upside is halved and the downside doubled, so the same ingot is a
    # bargain in one hand and a mistake in the other.
    assert good.mana_cost_mult < bad.mana_cost_mult < 0
    assert bad.damage_mult < good.damage_mult < 0


def test_gold_in_the_staff_discounts_the_staff_and_not_the_other_hand():
    from mirrorbound.game.combat.abilities import ABILITIES

    p = Player(id="p")
    p.inventory.add_weapon("ember_staff")
    p.inventory.add_weapon("hunter_bow")
    p.inventory.equip("ember_staff")
    from mirrorbound.game.combat.weapons import get_weapon

    spell = ABILITIES[p.inventory.ability_slots[0]]
    bow_ability = next(ABILITIES[a] for a in p.inventory.ability_slots
                       if a in get_weapon("hunter_bow").abilities)
    before = p.mana_cost_for(spell)
    bow_before = p.mana_cost_for(bow_ability)

    p.inventory.add_material("gold")
    p.inventory.fit_material("ember_staff", "gold")
    assert p.mana_cost_for(spell) < before
    assert p.mana_cost_for(bow_ability) == bow_before, "the offhand got the staff's discount"


def test_a_spell_never_becomes_free():
    from mirrorbound.game.combat.abilities import ABILITIES

    p = Player(id="p")
    p.inventory.add_weapon("ember_staff")
    p.inventory.upgrades["ember_staff"] = 3
    for _ in range(slots_for_tier(3)):
        p.inventory.add_material("gold")
        p.inventory.fit_material("ember_staff", "gold")
    spell = ABILITIES[p.inventory.ability_slots[0]]
    assert p.mana_cost_for(spell) >= spell.cost * 0.1 > 0


def test_slots_come_from_the_bench_so_the_two_halves_are_one_progression():
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    assert p.inventory.forge_slots("iron_sword") == 1
    p.inventory.add_material("iron")
    p.inventory.add_material("mithril")
    assert p.inventory.fit_material("iron_sword", "iron")[0]
    ok, reason = p.inventory.fit_material("iron_sword", "mithril")
    assert not ok and reason == "no free slot"
    # Worked at the bench, the same weapon has somewhere to put it.
    p.inventory.upgrades["iron_sword"] = 2
    assert p.inventory.fit_material("iron_sword", "mithril")[0]


def test_fuel_is_never_fitted_and_stripping_refunds_nothing():
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    p.inventory.add_material("coal", 5)
    ok, reason = p.inventory.fit_material("iron_sword", "coal")
    assert not ok and "fuel" in reason

    p.inventory.add_material("iron")
    p.inventory.fit_material("iron_sword", "iron")
    assert p.inventory.clear_fittings("iron_sword") == 1
    assert p.inventory.material_count("iron") == 0, "melting it out handed the ore back"


# --- armour, and the one material that answers it ------------------------------

def test_armour_replaces_health_rather_than_adding_to_it():
    """The three armoured creatures had their health cut by exactly the
    reciprocal when armour arrived, so a weapon with no obsidian in it kills them
    in the same number of hits as before -- which is what keeps every difficulty
    number measured in v1.1 true."""
    assert BRUTE.armour > 0
    effective = BRUTE.health / (1.0 - BRUTE.armour)
    assert effective == pytest.approx(180.0, abs=1.0), "the brute got tougher, not different"


def test_obsidian_is_worth_more_against_armour_than_against_a_hound():
    s = GameSession("pierce", seed=5, record=False)
    state = s.state
    p = state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.equip("iron_sword")

    def hit(enemy_def, fitted: bool) -> float:
        p.inventory.fitted.pop("iron_sword", None)
        if fitted:
            p.inventory.add_material("obsidian")
            p.inventory.fit_material("iron_sword", "obsidian")
        enemy = Enemy(id="e", position=Vec2(400, 400), enemy_def=enemy_def)
        before = enemy.health
        s.combat._through_armour(state, enemy, 100.0, p.id, "iron_sword")
        return s.combat._through_armour(state, enemy, 100.0, p.id, "iron_sword") if before else 0.0

    bare_brute = hit(BRUTE, False)
    sharp_brute = hit(BRUTE, True)
    bare_hound = hit(HOUND, False)
    sharp_hound = hit(HOUND, True)

    assert sharp_brute > bare_brute, "obsidian did nothing to an armoured target"
    assert sharp_hound == bare_hound, "obsidian helped against a creature with no armour"
    assert HOUND.armour == 0.0


def test_pierce_is_capped_however_much_obsidian_is_fitted():
    from mirrorbound.game.progression.materials import MAX_PIERCE

    assert forge_bonuses(["obsidian"] * 6, "sword").pierce <= MAX_PIERCE


# --- the ground ----------------------------------------------------------------

def test_every_place_the_world_can_build_has_geology():
    """A terrain or biome with no vein table is a place nobody has decided the
    geology of, and `place_veins` deliberately puts nothing there rather than
    inventing iron. This asserts the decision has been made for everywhere the
    campaign actually builds."""
    for area in AREAS.values():
        if area.kind == "region":
            assert area.terrain in VEIN_TABLE, f"{area.id} has no ore table"
        elif area.kind == "dungeon":
            assert area.biome in VEIN_TABLE, f"{area.id} has no ore table"


def test_a_region_holds_ore_and_the_deep_metals_are_not_in_a_grass_field():
    campaign = CampaignState()
    shallow = build_region("hollowreach_vale", DeterministicRNG(3), campaign.is_open, set())
    assert shallow.veins, "a region with nothing in the ground"
    assert all(MATERIALS[v.material].tier <= 2 for v in shallow.veins)

    # And the deepest two are dungeon-only, which is what makes a dungeon worth
    # walking into for something other than the boss at the end of it.
    above_ground = {m for area in AREAS.values() if area.kind == "region"
                    for m, _ in VEIN_TABLE.get(area.terrain, ())}
    assert "adamantine" not in above_ground and "diamond" not in above_ground


def test_a_vein_is_solid_and_never_lands_where_the_player_arrives():
    campaign = CampaignState()
    for area_id in ("hollowreach_vale", "kiln_terraces", "drowned_flats",
                    "wakewood", "emberfall_basin", "greenmoor"):
        room = build_region(area_id, DeterministicRNG(9), campaign.is_open, set())
        for vein in room.veins:
            at = Vec2(vein.x, vein.y)
            assert (at - room.player_spawn).length() > 200, f"{area_id}: vein on the spawn"
            assert room.is_blocked(at, 4.0), f"{area_id}: vein you can walk through"
        # And nothing sealed the way out.
        assert not room.is_blocked(room.player_spawn, 14.0)


def test_a_deeper_vein_gives_up_less():
    assert yield_for("iron") > yield_for("mithril") > yield_for("adamantine")


def test_the_same_seed_puts_the_same_ore_in_the_same_ground():
    campaign = CampaignState()
    def veins(seed: int):
        room = build_region("kiln_terraces", DeterministicRNG(seed), campaign.is_open, set())
        return [(v.material, round(v.x), round(v.y), v.remaining) for v in room.veins]

    assert veins(21) == veins(21)
    assert veins(21) != veins(22), "the ore is in the same place whatever the run"


def test_a_dungeon_puts_ore_in_its_rooms_but_not_in_the_boss_arena():
    run = DungeonGenerator(DeterministicRNG(4)).generate(7, biome="crypt")
    assert any(room.veins for room in run.rooms)
    for room in run.rooms:
        if room.room_type in ("boss", "guardian", "entrance"):
            assert not room.veins, f"{room.room_type} room has a boulder in it"


# --- mining --------------------------------------------------------------------

def stand_at_a_vein(session: GameSession):
    room = session.state.room
    vein = next(v for v in room.veins if not v.spent)
    session.state.player.position = Vec2(vein.x, vein.y + vein.radius + 20)
    return vein


def test_mining_a_vein_yields_its_material_and_empties_it():
    s = GameSession("mine", seed=5, record=False, start_area="hollowreach_vale")
    p = s.state.player
    vein = stand_at_a_vein(s)
    material, total = vein.material, vein.total

    for swing in range(total):
        p.state = "idle"
        s.handle_input({"type": "COMMAND", "action": "MINE", "veinId": vein.id})
        s.step(DT)
        assert p.inventory.material_count(material) == swing + 1

    assert vein.spent
    # A spent vein is still standing there, and the server refuses it.
    p.state = "idle"
    s.handle_input({"type": "COMMAND", "action": "MINE", "veinId": vein.id})
    s.step(DT)
    assert p.inventory.material_count(material) == total
    assert any(e.type == "ACTION_REJECTED" and e.data.get("reason") == "nothing to mine"
               for e in s.state.pending_events)


def test_you_cannot_mine_from_across_the_region():
    s = GameSession("far-mine", seed=5, record=False, start_area="hollowreach_vale")
    p = s.state.player
    vein = next(v for v in s.state.room.veins if not v.spent)
    p.position = Vec2(vein.x + 900, vein.y)
    s.handle_input({"type": "COMMAND", "action": "MINE", "veinId": vein.id})
    s.step(DT)
    assert not p.inventory.materials


def test_mining_holds_you_still():
    """The cost the whole system is priced against. Without it, ore is free and
    the only limit on it is how many boulders the generator placed."""
    s = GameSession("mine-cost", seed=5, record=False, start_area="hollowreach_vale")
    p = s.state.player
    vein = stand_at_a_vein(s)
    s.handle_input({"type": "COMMAND", "action": "MINE", "veinId": vein.id})
    s.step(DT)
    assert p.state == "drink", "mining was free"
    assert not p.can_attack()


def test_the_server_refuses_a_vein_the_client_did_not_mean():
    s = GameSession("wrong-vein", seed=5, record=False, start_area="hollowreach_vale")
    p = s.state.player
    stand_at_a_vein(s)
    s.handle_input({"type": "COMMAND", "action": "MINE", "veinId": "not_a_vein"})
    s.step(DT)
    assert not p.inventory.materials
    assert any(e.type == "ACTION_REJECTED" and e.data.get("reason") == "not that one"
               for e in s.state.pending_events)


# --- training ------------------------------------------------------------------

def test_a_trainer_sells_a_point_and_the_price_climbs():
    s = GameSession("train", seed=5, record=False)
    p = s.state.player
    trainer = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    p.position = Vec2(trainer.x, trainer.y + TALK_RADIUS * 0.5)
    for material in ("iron", "coal"):
        p.inventory.add_material(material, 200)

    first = training_cost("iron", 0)
    s.handle_input({"type": "COMMAND", "action": "TRAIN_ATTRIBUTE",
                    "npcId": trainer.id, "attributeId": "vigour"})
    s.step(DT)
    assert p.attributes.unspent == 1

    # Bought, not spent: where it goes is still the player's decision.
    assert p.attributes.get("vigour") == 0
    s.handle_input({"type": "COMMAND", "action": "SPEND_ATTRIBUTE", "attributeId": "vigour"})
    s.step(DT)
    assert p.attributes.get("vigour") == 1 and p.attributes.unspent == 0

    assert training_cost("iron", 1)["iron"] > first["iron"]


def test_training_refuses_before_it_takes_the_ore():
    s = GameSession("poor", seed=5, record=False)
    p = s.state.player
    trainer = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    p.position = Vec2(trainer.x, trainer.y + TALK_RADIUS * 0.5)
    p.inventory.add_material("iron", 1)   # and no coal

    s.handle_input({"type": "COMMAND", "action": "TRAIN_ATTRIBUTE",
                    "npcId": trainer.id, "attributeId": "vigour"})
    s.step(DT)
    assert p.attributes.unspent == 0
    assert p.inventory.material_count("iron") == 1, "the ore went and the point did not"


def test_every_bill_wants_coal_so_one_ore_is_never_enough():
    for definition in ATTRIBUTES.values():
        for points in (0, 5, 12):
            cost = training_cost(definition.ore, points)
            assert cost.get("coal", 0) > 0
            assert cost.get(definition.ore, 0) > 0


def test_a_trainer_will_not_sell_past_the_ceiling():
    p = Player(id="p")
    p.attributes = maxed("vigour")
    p.attributes.unspent = 5
    ok, reason = p.spend_attribute("vigour")
    assert not ok and "maximum" in reason


# --- it survives a save --------------------------------------------------------

def test_ore_fittings_and_attributes_all_come_back():
    s = GameSession("carry", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = 2
    p.inventory.add_material("mithril", 3)
    p.inventory.add_material("coal", 7)
    p.inventory.fit_material("iron_sword", "mithril")
    p.attributes.points["finesse"] = 6
    p.attributes.unspent = 2

    data = save_system.build_save("carry", s.state.campaign, p, s.state.twin)
    assert data["version"] == save_system.SAVE_VERSION

    fresh = GameSession("carry2", seed=5, record=False)
    save_system.apply_save(data, fresh.state.player, fresh.state.twin)
    loaded = fresh.state.player
    assert loaded.inventory.material_count("mithril") == 2
    assert loaded.inventory.material_count("coal") == 7
    assert loaded.inventory.fittings("iron_sword") == ["mithril"]
    assert loaded.attributes.get("finesse") == 6 and loaded.attributes.unspent == 2


def test_a_save_from_before_the_ore_pays_the_points_its_levels_earned():
    """A v1.1 run must not open into a tree it can no longer finish. The levels
    it already has are what pay for the gates that arrived after it."""
    old = {"version": 3, "player": {"level": 9, "xp": 12, "skillPoints": 3,
                                    "unlockedSkills": ["vitality"]}}
    migrated = save_system.migrate(old)
    assert migrated is not None
    assert migrated["player"]["attributes"]["unspent"] == 8 * POINTS_PER_LEVEL


def test_fittings_never_come_back_wider_than_the_weapon():
    """A save whose weapon has since been un-upgraded, or was written by a build
    with more slots, must not restore a forge the bench can no longer work on."""
    s = GameSession("overfull", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")          # tier 0, so one slot
    data = {"version": save_system.SAVE_VERSION,
            "player": {"weapons": ["iron_sword"], "equippedWeapon": "iron_sword",
                       "fitted": {"iron_sword": ["iron", "mithril", "diamond"],
                                  "warden_pike": ["adamantine"]}},
            "twin": {}}
    save_system.apply_save(data, p, s.state.twin)
    assert len(p.inventory.fittings("iron_sword")) == p.inventory.forge_slots("iron_sword")
    assert "warden_pike" not in p.inventory.fitted, "a forge on a weapon nobody owns"
