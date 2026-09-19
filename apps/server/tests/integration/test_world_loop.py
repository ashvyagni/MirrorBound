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


def test_the_elder_opens_on_her_intro_and_only_then_starts_the_quest():
    """The intro lines are the only place the player's chosen name is spoken.

    They are reachable only while no quest flag is set, so a campaign that
    started with `quest_active` already on made every `intro` in the game dead
    content and swallowed the naming payoff.
    """
    s = fresh_village("intro")
    s.campaign.player_name = sanitise_name("Wren", "Wanderer")
    assert s.campaign.flags == set(), "a fresh campaign has been told nothing yet"

    elder = stand_by(s, "elder")
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": elder.id})
    s.step(DT)
    talk = next(e for e in s.state.pending_events if e.type == "NPC_TALK")
    assert any("Wren" in line for line in talk.data["lines"]), "the intro says your name"
    assert "quest_active" in s.campaign.flags, "being told is what starts it"

    # Told twice is not told twice: the second talk is the reminder, and it
    # does not re-emit the quest as newly started.
    s.state.pending_events.clear()
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": elder.id})
    s.step(DT)
    again = next(e for e in s.state.pending_events if e.type == "NPC_TALK")
    assert again.data["lines"] != talk.data["lines"]
    assert not [e for e in s.state.pending_events
                if e.type == "QUEST_UPDATED" and e.data.get("started")]


def test_a_save_with_no_flags_restores_with_no_flags():
    """Restoring must not invent `quest_active` for a run that never earned it."""
    restored = CampaignState.from_save({"flags": []})
    assert restored.flags == set()


def test_a_village_puts_the_roads_out_of_it_on_the_map():
    """The opening is otherwise a dead end: the elder names the crypt and the
    map has never heard of it, so there is nothing to travel to."""
    s = fresh_village("reveal")
    discovered = set(s.campaign.discovered_areas)
    assert "wakewood_crypt" in discovered, "the one open road out is on the map"
    assert "emberfall" not in discovered, "still behind the crypt, so still unknown"
    assert "mirror_sanctum" not in discovered


def test_revealing_is_idempotent_and_reveals_nothing_twice():
    s = fresh_village("reveal2")
    assert s.campaign.reveal_open() == [], "already revealed on arrival"
    before = set(s.campaign.discovered_areas)
    s.campaign.reveal_open()
    assert s.campaign.discovered_areas == before


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


# --- respec ---------------------------------------------------------------------


def learn_two(session):
    p = session.state.player
    p.skill_points = 4
    p.unlock_skill("keen_edge")
    p.unlock_skill("heavy_hands")
    return p


def test_respec_in_a_village_refunds_everything_and_is_deterministic():
    s = fresh_village("respec")
    p = learn_two(s)
    spent_down_to = p.skill_points
    max_health_with = p.max_health

    s.handle_input({"type": "COMMAND", "action": "RESPEC"})
    s.step(DT)

    assert p.unlocked_skills == set(), "the whole tree, so no node outlives its prerequisite"
    assert p.skill_points == spent_down_to + 2
    # Relearning the same nodes must land back exactly where it started.
    p.unlock_skill("keen_edge")
    p.unlock_skill("heavy_hands")
    assert p.max_health == max_health_with
    assert p.skill_points == spent_down_to


def test_respec_never_heals_and_never_leaves_you_over_your_maximum():
    """Resilience raises max health, so refunding it lowers the ceiling."""
    s = fresh_village("respec-hp")
    p = s.state.player
    p.skill_points = 4
    p.unlock_skill("vitality")
    p.health = p.max_health
    raised = p.max_health

    s.handle_input({"type": "COMMAND", "action": "RESPEC"})
    s.step(DT)
    assert p.max_health < raised, "the bonus is gone"
    assert p.health == p.max_health, "clamped down, not refilled and not left over the cap"


def test_respec_is_refused_outside_a_village():
    s = combat_session("respec-fight")
    learn_two(s)
    s.handle_input({"type": "COMMAND", "action": "RESPEC"})
    s.step(DT)
    assert s.state.player.unlocked_skills, "nothing was unlearned"
    assert any(e.data.get("action") == "RESPEC" for e in s.state.pending_events
               if e.type == "ACTION_REJECTED")


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
