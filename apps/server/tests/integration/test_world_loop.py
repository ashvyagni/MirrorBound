"""The world loop a player actually walks: village, dungeon, twin, vendor, home.

These are the acceptance tests for the campaign rather than for any one
system, so they drive the real GameSession and assert on what the player
would see happen.
"""

from __future__ import annotations

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS, CampaignState, sanitise_name
from tests.conftest import DT, combat_session


def fresh_village(name="world") -> GameSession:
    save_system.delete_save(name)
    return GameSession(name, seed=5, record=False)


def clear_room(session) -> None:
    for enemy in list(session.state.enemies):
        enemy.take_hit(10_000, session.state.player.id)
    session.step(DT)


def walk_to(session, pos: Vec2) -> None:
    session.state.transition_timer = 0
    session.state.player.position = pos
    session.step(DT)


# --- the village -------------------------------------------------------------

def test_the_campaign_opens_in_a_safe_village_with_people_in_it():
    s = fresh_village("open")
    room = s.state.room
    assert room.room_type == "village" and room.area_id == "hollow_reach"
    assert not room.enemy_spawns and not s.state.enemies, "a village is safe"
    roles = {n.definition.role for n in room.npcs}
    assert {"elder", "weaponsmith", "apothecary", "hearth"} <= roles
    assert room.portals, "a village has roads out"
    assert s.state.to_dict()["room"]["safe"] is True


def test_the_twin_is_not_present_until_it_is_found():
    s = fresh_village("dormant")
    assert s.state.twin.dormant
    snap = s.snapshot()
    assert snap["twin"]["dormant"] is True


def test_walking_into_a_portal_travels_to_that_area():
    s = fresh_village("travel")
    portal = next(p for p in s.state.room.portals if p.target_area == "wakewood_crypt")
    walk_to(s, Vec2(portal.x, portal.y))
    assert s.campaign.current_area == "wakewood_crypt"
    assert s.state.room.room_type == "entrance"
    assert s.dungeon is not None


def test_a_locked_area_refuses_travel_and_says_why():
    s = fresh_village("locked")
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "ashen_deep"})
    s.step(DT)
    rejected = [e for e in s.state.pending_events if e.type == "ACTION_REJECTED"]
    assert rejected and "Wakewood Crypt" in rejected[-1].data["reason"]
    assert s.campaign.current_area == "hollow_reach"


def test_travel_is_refused_from_inside_a_dungeon():
    s = combat_session("no-teleport")
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "hollow_reach"})
    s.step(DT)
    assert s.campaign.current_area == "wakewood_crypt"
    assert any(e.data.get("reason") == "only from a village"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")


# --- finding the twin ---------------------------------------------------------

def test_the_twin_is_found_partway_into_the_first_dungeon():
    s = GameSession("rescue", seed=5, record=False, start_area="wakewood_crypt")
    assert s.state.twin.dormant
    s._enter_room(s.dungeon.rooms[2], from_side="south")
    assert not s.state.twin.dormant
    assert s.campaign.twin_rescued and "twin_rescued" in s.campaign.flags
    assert any(e.type == "TWIN_REVIVED" and e.data.get("rescued") for e in s.state.pending_events)


def test_finding_the_twin_changes_what_the_elder_says():
    s = fresh_village("dialogue")
    elder = next(n for n in s.state.room.npcs if n.definition.role == "elder")
    before = elder.definition.dialogue_for(s.campaign.flags, "Wren", "Ash")
    s.campaign.rescue_twin()
    after = elder.definition.dialogue_for(s.campaign.flags, "Wren", "Ash")
    assert before != after
    assert any("Ash" in line or "Wren" in line for line in after)


# --- vendors ------------------------------------------------------------------

def stand_by(session, role: str):
    npc = next(n for n in session.state.room.npcs if n.definition.role == role)
    session.state.player.position = Vec2(npc.x, npc.y + 20)
    return npc


def test_buying_a_weapon_spends_gold_and_grants_it_once():
    s = fresh_village("shop")
    smith = stand_by(s, "weaponsmith")
    s.state.player.inventory.add_gold(500)
    s.handle_input({"type": "COMMAND", "action": "BUY_ITEM", "npcId": smith.id, "itemId": "hunter_bow"})
    s.step(DT)
    inv = s.state.player.inventory
    assert "hunter_bow" in inv.weapons and inv.gold == 500 - 140
    # Buying it again is refused, and costs nothing.
    s.handle_input({"type": "COMMAND", "action": "BUY_ITEM", "npcId": smith.id, "itemId": "hunter_bow"})
    s.step(DT)
    assert inv.gold == 500 - 140


def test_buying_without_the_gold_changes_nothing():
    s = fresh_village("broke")
    smith = stand_by(s, "weaponsmith")
    s.handle_input({"type": "COMMAND", "action": "BUY_ITEM", "npcId": smith.id, "itemId": "hunter_bow"})
    s.step(DT)
    assert "hunter_bow" not in s.state.player.inventory.weapons
    assert s.state.player.inventory.gold == 0
    assert any(e.data.get("reason") == "not enough gold"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")


def test_talking_from_across_the_village_is_refused():
    s = fresh_village("far")
    smith = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    s.state.player.position = Vec2(smith.x + 900, smith.y)
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": smith.id})
    s.step(DT)
    assert any(e.data.get("reason") == "too far"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")


def test_the_hearth_restores_and_saves():
    s = fresh_village("rest")
    hearth = stand_by(s, "hearth")
    s.state.player.health = 10
    s.state.player.mana = 1
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": hearth.id})
    s.step(DT)
    assert s.state.player.health == s.state.player.max_health
    assert s.state.player.mana == s.state.player.max_mana
    assert save_system.read_save("rest") is not None


# --- rewards happen once -------------------------------------------------------

def test_completing_an_area_pays_out_exactly_once():
    s = combat_session("payout")
    gold_before = s.state.player.inventory.gold
    s._complete_area()
    after_first = s.state.player.inventory.gold
    assert after_first == gold_before + AREAS["wakewood_crypt"].completion_gold
    assert s.campaign.seals == ["seal_of_waking"]
    s._complete_area()
    assert s.state.player.inventory.gold == after_first, "a second completion pays nothing"
    assert s.campaign.seals == ["seal_of_waking"]


def test_a_treasure_room_cannot_be_farmed_by_re_entering_it():
    s = combat_session("farm")
    treasure = next(r for r in s.dungeon.rooms if r.room_type == "treasure")
    s._enter_room(treasure, from_side="south")
    assert s.state.pickups, "first visit lays out the treasure"
    s._enter_room(s.dungeon.rooms[0], from_side="north")
    s._enter_room(treasure, from_side="south")
    assert not s.state.pickups, "a looted room stays looted"


def test_finishing_a_dungeon_opens_the_way_home():
    s = combat_session("exit")
    last = s.dungeon.rooms[-1]
    s._enter_room(last, from_side="south")
    clear_room(s)
    assert "wakewood_crypt" in s.campaign.completed_areas
    assert any(p.target_area == "hollow_reach" for p in s.state.room.portals)


# --- checkpoints ----------------------------------------------------------------

def test_a_checkpoint_restores_progression_but_not_a_frozen_fight():
    s = fresh_village("save-load")
    player = s.state.player
    player.inventory.add_gold(250)
    player.inventory.add_weapon("hunter_bow")
    player.level = 4
    player.skill_points = 3
    s.campaign.player_name = "Wren"
    s.campaign.complete("wakewood_crypt")
    s._checkpoint()

    loaded = GameSession("save-load", seed=5, record=False, load_save=True)
    assert loaded.state.player.inventory.gold == 250
    assert "hunter_bow" in loaded.state.player.inventory.weapons
    assert loaded.state.player.level == 4 and loaded.state.player.skill_points == 3
    assert loaded.campaign.player_name == "Wren"
    assert "wakewood_crypt" in loaded.campaign.completed_areas
    assert loaded.state.room.room_type == "village"


def test_a_save_naming_things_that_no_longer_exist_still_loads():
    s = fresh_village("save-junk")
    data = save_system.build_save("save-junk", s.campaign, s.state.player, s.state.twin)
    data["player"]["weapons"] = ["iron_sword", "weapon_that_was_cut"]
    data["player"]["unlockedSkills"] = ["skill_that_was_cut"]
    data["campaign"]["currentArea"] = "an_area_that_was_cut"
    save_system.write_save("save-junk", data)

    loaded = GameSession("save-junk", seed=5, record=False, load_save=True)
    assert loaded.state.player.inventory.weapons == ["iron_sword"]
    assert loaded.state.player.unlocked_skills == set()
    assert loaded.campaign.current_area == "hollow_reach"


def test_names_are_sanitised_before_they_reach_dialogue():
    assert sanitise_name("  Wren  ", "x") == "Wren"
    assert sanitise_name("<script>alert(1)</script>", "Fallback") == "scriptalert1script"[:18]
    assert sanitise_name("", "Fallback") == "Fallback"
    assert len(sanitise_name("W" * 200, "x")) == 18


# --- the twin's own kit -----------------------------------------------------------

def test_asking_the_twin_for_a_weapon_moves_it_rather_than_copying_it():
    s = combat_session("handover")
    twin = s.state.twin
    twin.inventory.add_weapon("frost_staff")
    s.handle_input({"type": "COMMAND", "action": "TWIN_REQUEST", "weaponId": "frost_staff"})
    s.step(DT)
    assert "frost_staff" in s.state.player.inventory.weapons
    assert "frost_staff" not in twin.inventory.weapons, "a request is a move, not a copy"


def test_the_second_carried_weapon_swaps_in_and_out():
    s = combat_session("swap")
    inv = s.state.player.inventory
    inv.add_weapon("hunter_bow")
    assert inv.equipped_weapon == "iron_sword" and inv.offhand_weapon == "hunter_bow"
    s.handle_input({"type": "COMMAND", "action": "SWAP_WEAPON"})
    s.step(DT)
    assert inv.equipped_weapon == "hunter_bow" and inv.offhand_weapon == "iron_sword"


def test_campaign_state_round_trips_through_its_save_form():
    state = CampaignState()
    state.complete("wakewood_crypt")
    state.rescue_twin()
    state.player_name, state.twin_name = "Wren", "Ash"
    restored = CampaignState.from_save(state.save_dict())
    assert restored.completed_areas == state.completed_areas
    assert restored.twin_rescued and restored.twin_name == "Ash"
    assert "emberfall" in restored.discovered_areas, "completing an area reveals what it unlocks"
