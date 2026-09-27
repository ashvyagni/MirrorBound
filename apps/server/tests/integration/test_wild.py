"""The living overworld: herds, predators, two new terrains, and hunger.

What this file is mostly guarding is the *edges* of adding non-hostile creatures
to a game that has never had one. Two existing tests found them immediately --
"every creature announces its attack" and "the sprout notices you last" were both
true of a world where everything wanted to kill you -- so the tests here are
written in the same spirit: they assert the properties that make a cow a cow
rather than a skeleton with no damage.

The hunger tests are about the three decisions in `progression/survival.py`, and
the most important one is the boss freeze. v1.1 measured the guardians at 0.67 and
0.89 clear, and a hunger debuff multiplies into that invisibly.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import (
    ARCHETYPES, COW, LIVESTOCK, SHEEP, TIGER, Enemy, EnemyBehavior, EnemyState,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player
from mirrorbound.game.inventory import CONSUMABLES, COOKS_INTO, FOODS
from mirrorbound.game.progression import survival
from mirrorbound.game.progression.survival import MAX_HUNGER, Hunger
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS, CROSSINGS, CampaignState, crossings_of
from mirrorbound.game.world.region import ENCOUNTERS, build_region

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


# --- livestock is not a skeleton with the damage turned off ---------------------

def test_livestock_has_no_attack_no_reach_and_notices_nothing():
    for beast_id in LIVESTOCK:
        beast = ARCHETYPES[beast_id]
        assert beast.damage == 0, f"{beast_id} fights back"
        assert beast.aggro_range == 0, f"{beast_id} hunts"
        assert beast.attack_range == 0
        assert beast.behavior is EnemyBehavior.GRAZE
        assert beast.livestock


def test_livestock_carries_no_essence_gold_or_relics():
    """Essence is what a creature of the Reach leaves behind, and a cow is not one
    of those. It leaves meat."""
    for beast_id in LIVESTOCK:
        loot = ARCHETYPES[beast_id].loot
        assert loot.essence_max == 0 and loot.gold_max == 0
        assert loot.relic_chance == 0 and loot.weapon_chance == 0


def test_killing_a_cow_leaves_meat_and_a_cow_is_worth_three_sheep():
    s = GameSession("butcher", seed=5, record=False, start_area="the_proving")
    state = s.state

    def meat(enemy_def) -> int:
        enemy = Enemy(id="b", position=Vec2(500, 500), enemy_def=enemy_def)
        drops = s.combat.loot.drop_for(state, enemy)
        assert all(d.kind == "raw_meat" for d in drops), "a cow dropped something else"
        return len(drops)

    assert meat(COW) == 3
    assert meat(SHEEP) == 1


def test_farming_sheep_is_not_a_way_to_level():
    """Their XP is deliberately negligible. A player who out-levels the campaign
    by standing in a field has found a way to skip the game."""
    hostile = min(e.xp_reward for eid, e in ARCHETYPES.items()
                  if e.damage > 0 and not e.boss and not eid.startswith("elite_"))
    for beast_id in LIVESTOCK:
        assert ARCHETYPES[beast_id].xp_reward < hostile / 2


def test_a_grazing_animal_wanders_until_it_is_hit_and_then_runs():
    s = GameSession("bolt", seed=5, record=False, start_area="the_proving")
    state = s.state
    cow = Enemy(id="cow1", position=state.player.position + Vec2(120, 0), enemy_def=COW)
    cow.home = cow.position.copy()
    state.enemies.append(cow)

    for _ in range(40):
        s.step(DT)
    assert cow.state in (EnemyState.IDLE, EnemyState.WANDER)
    assert cow.target_id is None, "a cow picked a target"

    before = (cow.position - state.player.position).length()
    s.combat.damage_enemy(state, cow, 1.0, state.player.id, ["MELEE"], Vec2(1, 0), 0.0, "iron_sword")
    for _ in range(45):
        s.step(DT)
    assert cow.state is EnemyState.RETREAT
    assert (cow.position - state.player.position).length() > before, "it stood there"


def test_a_frightened_animal_never_calms_down_and_goes_back_to_the_grass():
    """There is no version of this that decides the danger has passed: the only
    thing that hits a cow is a player who is still standing there."""
    s = GameSession("no-calm", seed=5, record=False, start_area="the_proving")
    state = s.state
    sheep = Enemy(id="s1", position=state.player.position + Vec2(90, 0), enemy_def=SHEEP)
    sheep.home = sheep.position.copy()
    state.enemies.append(sheep)
    s.combat.damage_enemy(state, sheep, 1.0, state.player.id, ["MELEE"], Vec2(1, 0), 0.0, "iron_sword")
    for _ in range(600):
        s.step(DT)
    assert sheep.state is EnemyState.RETREAT


def test_a_panicking_animal_is_faster_than_a_grazing_one():
    s = GameSession("flee-speed", seed=5, record=False, start_area="the_proving")
    state = s.state
    sheep = Enemy(id="s1", position=state.player.position + Vec2(80, 0), enemy_def=SHEEP)
    sheep.home = sheep.position.copy()
    state.enemies.append(sheep)
    s.combat.damage_enemy(state, sheep, 1.0, state.player.id, ["MELEE"], Vec2(1, 0), 0.0, "iron_sword")
    s.step(DT)
    assert sheep.velocity.length() > SHEEP.speed


def test_nothing_hostile_and_nothing_edible_stands_inside_a_village():
    """The promise a settlement makes. And the reason livestock lives in the
    fields: a player who has to decide whether to butcher somebody's cow in front
    of them is a player owed a crime system nobody asked for."""
    campaign = CampaignState()
    for area in AREAS.values():
        if area.kind != "region" or not area.settlement:
            continue
        room = build_region(area.id, DeterministicRNG(11), campaign.is_open, set())
        settlement = room.settlements[0]
        for spawn in room.enemy_spawns:
            assert not settlement.contains(spawn.position), f"{spawn.enemy_type} on the green"


# --- the predators -------------------------------------------------------------

def test_the_tiger_notices_you_from_further_off_than_anything_that_has_to_reach_you():
    """The property that makes it an open-ground threat: it sees you at four
    hundred and twenty units and then has to run every one of them.

    Compared against the things that must close the distance, not against the
    artillery -- the Fen Spitter sees 520 because it can hit you from 440, which
    is its whole job and a different mechanic entirely.
    """
    chargers = {eid: e.aggro_range for eid, e in ARCHETYPES.items()
                if eid != "tiger" and e.damage > 0 and e.attack_range < 120
                and not e.boss and not eid.startswith("elite_")}
    assert TIGER.aggro_range > max(chargers.values()), chargers
    assert TIGER.attack_range < 120, "the tiger stopped being something that closes"


def test_the_wild_animals_cost_no_new_art():
    """§35. Every one of them is the Gloom Hound's sheet in a different colour at
    a different size -- which is also the only reason five of them was affordable."""
    for beast_id in ("cow", "sheep", "tiger", "leopard", "winter_wolf"):
        beast = ARCHETYPES[beast_id]
        assert beast.sprite == "hound", beast_id
        assert beast.tint, f"{beast_id} is drawn as a Gloom Hound and looks like one"


# --- the new ground ------------------------------------------------------------

def test_the_two_new_regions_are_optional_and_reachable():
    """Optional is the point: an overworld where every region is on the critical
    path is a corridor. Nothing gates them, and nothing gates behind them."""
    for area_id in ("windward_downs", "rimefell"):
        area = AREAS[area_id]
        assert area.kind == "region"
        ways = crossings_of(area_id)
        assert ways, f"{area_id} cannot be walked into"
        assert all(not crossing.requires for _side, _along, _other, crossing in ways), \
            f"{area_id} is gated, so it is not optional country"
        # And nothing else is reached only through them, so the campaign is
        # unchanged by never going.
        assert all(other in AREAS for _s, _a, other, _c in ways)


def test_both_new_terrains_build_and_are_populated():
    campaign = CampaignState()
    for area_id, terrain in (("windward_downs", "grassfield"), ("rimefell", "tundra")):
        room = build_region(area_id, DeterministicRNG(7), campaign.is_open, set())
        assert AREAS[area_id].terrain == terrain
        assert room.enemy_spawns, f"{area_id} is empty"
        assert room.decor, f"{area_id} is undressed"
        assert room.veins, f"{area_id} has nothing in the ground"
        assert not room.is_blocked(room.player_spawn, 14.0)


def test_the_downs_are_where_the_herds_are_and_the_fell_is_where_the_wolves_are():
    downs = [e for e, _fx, _fy in ENCOUNTERS["grassfield"]]
    fell = [e for e, _fx, _fy in ENCOUNTERS["tundra"]]
    assert sum(1 for e in downs if e in LIVESTOCK) > sum(1 for e in downs if e not in LIVESTOCK)
    assert downs.count("tiger") >= 1
    assert fell.count("winter_wolf") >= 3, "the pack is the encounter"


def test_the_rimefell_is_the_only_mithril_above_ground():
    from mirrorbound.game.progression.materials import VEIN_TABLE

    above = {area.terrain for area in AREAS.values() if area.kind == "region"}
    sources = {terrain for terrain in above
               if "mithril" in {m for m, _w in VEIN_TABLE.get(terrain, ())}}
    assert "tundra" in sources
    assert sources <= {"tundra", "pass"}, "mithril is common above ground now"


def test_every_crossing_still_leads_both_ways():
    """The v1.1 invariant, re-asserted because v1.2 added two crossings and a
    one-way crossing is the worst kind of world bug."""
    for crossing in CROSSINGS:
        out = {other for _s, _a, other, _c in crossings_of(crossing.a)}
        back = {other for _s, _a, other, _c in crossings_of(crossing.b)}
        assert crossing.b in out and crossing.a in back, crossing.name


# --- hunger --------------------------------------------------------------------

def test_hunger_is_spent_on_walking_and_fighting_and_never_on_waiting():
    """The decision this mechanic lives or dies on. A bar on a wall clock punishes
    reading the journal and haggling with a smith, neither of which is what the
    mechanic is about."""
    s = GameSession("wait", seed=5, record=False, start_area="the_proving")
    p = s.state.player
    p.velocity = Vec2()
    for _ in range(60 * 30):        # thirty seconds of standing perfectly still
        s.step(DT)
    assert p.hunger.value == MAX_HUNGER, "standing still made the player hungry"


def test_walking_a_long_way_makes_you_hungry():
    hunger = Hunger()
    hunger.walked(5000.0)
    assert hunger.value == MAX_HUNGER - 5 * survival.PER_1000_UNITS


def test_short_steps_are_not_lost_to_rounding():
    """Sixty ticks a second of four-unit steps has to add up to the same thing as
    one long walk, or hunger would quietly never move at all."""
    banked, straight = Hunger(), Hunger()
    for _ in range(500):
        banked.walked(4.0)
    straight.walked(2000.0)
    assert banked.value == pytest.approx(straight.value)


def test_fighting_costs_more_per_event_than_walking_does_per_unit():
    swinging, walking = Hunger(), Hunger()
    for _ in range(20):
        swinging.acted()
    walking.walked(1000.0)
    assert swinging.value < walking.value


def test_the_three_bands_and_what_each_one_is_worth():
    full, middling, empty = Hunger(), Hunger(value=50.0), Hunger(value=5.0)
    assert (full.band, middling.band, empty.band) == ("fed", "fine", "hungry")
    assert full.damage_mult > 0 and middling.damage_mult == 0 and empty.damage_mult < 0
    assert empty.damage_taken_mult > 0 and middling.damage_taken_mult == 0
    assert full.speed_mult > 0 > empty.speed_mult


def test_being_fed_does_not_heal_you():
    """Food answers hunger; potions answer damage. Out-of-combat regeneration was
    the first version of the Fed bonus and it undercut the whole potion economy the
    v1.1 bench is priced against -- six existing tests caught it by asserting exact
    health values."""
    s = GameSession("no-regen", seed=5, record=False, start_area="the_proving")
    p = s.state.player
    p.health = 40.0
    assert p.hunger.fed
    for _ in range(60 * 10):
        s.step(DT)
    assert p.health == 40.0


def test_hunger_never_kills_and_the_penalty_has_a_floor():
    hunger = Hunger()
    for _ in range(10_000):
        hunger.acted()
    assert hunger.value == survival.MIN_HUNGER
    assert hunger.damage_mult == survival.HUNGRY_DAMAGE_MULT, "the penalty kept growing"
    assert hunger.damage_taken_mult == survival.HUNGRY_DAMAGE_TAKEN_MULT


def test_hungry_hits_softer_and_bruises_easier():
    plain, starved = Player(id="a"), Player(id="b")
    plain.inventory.add_weapon("iron_sword")
    starved.inventory.add_weapon("iron_sword")
    starved.hunger.value = 1.0
    assert starved.weapon_damage_multiplier() < plain.weapon_damage_multiplier()
    assert starved.damage_taken_multiplier() > plain.damage_taken_multiplier()


def test_no_amount_of_iron_skin_and_hunger_makes_the_player_immune():
    p = Player(id="p")
    p.unlocked_skills = {"vitality", "second_wind", "steady_hand", "iron_skin"}
    p.hunger.value = MAX_HUNGER
    assert p.damage_taken_multiplier() >= 0.25


def test_vigour_slows_the_drain_but_never_stops_it():
    plain, tough = Hunger(), Hunger()
    plain.walked(4000.0)
    tough.walked(4000.0, resist=0.4)
    assert plain.value < tough.value < MAX_HUNGER


def test_hunger_freezes_while_a_boss_is_in_the_room():
    """The measured-difficulty guard. A combat-and-defence debuff multiplies into
    the guardians' clear rates with nothing in the measurement able to see it."""
    s = GameSession("boss-freeze", seed=5, record=False, start_area="the_proving")
    state = s.state
    from mirrorbound.game.entities.enemy import WARDEN

    state.enemies.append(Enemy(id="w", position=state.player.position + Vec2(400, 0),
                               enemy_def=WARDEN))
    s.step(DT)
    assert state.player.hunger.frozen and state.twin.hunger.frozen

    state.player.hunger.value = 60.0
    state.player.hunger.walked(9000.0)
    state.player.hunger.acted()
    assert state.player.hunger.value == 60.0, "hunger moved during a boss fight"

    state.enemies.clear()
    s.step(DT)
    assert not state.player.hunger.frozen


# --- food ----------------------------------------------------------------------

def test_no_food_heals_anything():
    for item in FOODS:
        spec = CONSUMABLES[item]
        assert not spec.get("heal"), f"{item} is a cheap potion"
        assert not spec.get("mana"), f"{item} is a cheap potion"
        assert spec["nourish"] > 0


def test_cooking_is_worth_the_walk():
    for raw, cooked in COOKS_INTO.items():
        assert CONSUMABLES[cooked]["nourish"] > CONSUMABLES[raw]["nourish"] * 2


def test_eating_when_full_is_refused_rather_than_wasted():
    p = Player(id="p")
    p.inventory.add_consumable("bread")
    ok, reason = p.can_drink("bread", CONSUMABLES["bread"])
    assert not ok and reason == "not hungry"
    p.hunger.value = 10.0
    assert p.can_drink("bread", CONSUMABLES["bread"])[0]


def test_overeating_is_wasted_rather_than_banked():
    hunger = Hunger(value=90.0)
    used = hunger.eat(48.0)
    assert hunger.value == MAX_HUNGER
    assert used == 10.0


def test_the_hearth_feeds_you_and_cooks_what_you_are_carrying():
    """The whole cooking system, and it needed no new command, no new NPC and no
    new screen -- the village already had the one thing a cook needs."""
    s = GameSession("hearth", seed=5, record=False)
    state = s.state
    p = state.player
    p.inventory.add_consumable("raw_meat", 4)
    p.hunger.value = 12.0
    state.twin.dormant = False
    state.twin.hunger.value = 20.0

    hearth = next(n for n in state.room.npcs if n.definition.role == "hearth")
    p.position = Vec2(hearth.x, hearth.y + 40)
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": hearth.id})
    s.step(DT)

    assert p.hunger.value == MAX_HUNGER
    assert state.twin.hunger.value == MAX_HUNGER
    assert p.inventory.consumables.get("raw_meat", 0) == 0
    assert p.inventory.consumables.get("cooked_meat", 0) == 4
    assert [e for e in state.pending_events if e.type == "FOOD_COOKED"]


def test_hunger_survives_a_save_and_an_old_save_arrives_fed():
    s = GameSession("hunger-save", seed=5, record=False)
    p = s.state.player
    p.hunger.value = 33.0
    s.state.twin.hunger.value = 44.0
    data = save_system.build_save("hunger-save", s.state.campaign, p, s.state.twin)

    fresh = GameSession("hunger-save-2", seed=5, record=False)
    save_system.apply_save(data, fresh.state.player, fresh.state.twin)
    assert fresh.state.player.hunger.value == 33.0
    assert fresh.state.twin.hunger.value == 44.0

    # And a run from before hunger existed is not punished for a walk it took in
    # a build where walking cost nothing.
    older = save_system.migrate({"version": 3, "player": {"level": 4}})
    again = GameSession("hunger-save-3", seed=5, record=False)
    save_system.apply_save(older, again.state.player, again.state.twin)
    assert again.state.player.hunger.value == MAX_HUNGER
