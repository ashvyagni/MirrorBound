"""The world loop a player actually walks: village, dungeon, twin, vendor, home.

These are the acceptance tests for the campaign rather than for any one
system, so they drive the real GameSession and assert on what the player
would see happen.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS, CampaignState, sanitise_name
from tests.conftest import DT, combat_session, play_cutscene


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


def test_a_gated_area_is_refused_rather_than_skipped_into():
    """One area at a time, each opened by finishing the one before it.

    This used to work the other way: the map let you jump anywhere and quietly
    completed every area you had jumped over -- gold, seals and all. That made
    the campaign a menu. The Mirror was two clicks from the opening village,
    and finishing a dungeon was something the game did for you.
    """
    s = fresh_village("gated")
    gold_before = s.state.player.inventory.gold
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "ashen_deep"})
    s.step(DT)

    assert s.campaign.current_area != "ashen_deep", "walked straight past the gate"
    assert "wakewood_crypt" not in s.campaign.completed_areas, "it was completed for free"
    assert s.state.player.inventory.gold == gold_before, "it paid out for skipping"
    rejected = [e for e in s.state.pending_events
                if e.type == "ACTION_REJECTED" and e.data.get("action") == "TRAVEL"]
    assert rejected, "refused silently"
    assert "Wakewood Crypt" in rejected[0].data["reason"], rejected[0].data


def test_finishing_an_area_is_what_opens_the_next_one():
    s = fresh_village("chain")
    assert not s.campaign.is_open("ashen_deep")[0]
    s.campaign.complete("wakewood_crypt")
    assert s.campaign.is_open("ashen_deep")[0]
    # And the one after it stays shut until the Deep is done.
    assert not s.campaign.is_open("mirror_sanctum")[0]
    s.campaign.complete("ashen_deep")
    assert s.campaign.is_open("mirror_sanctum")[0]


def test_the_first_dungeon_and_the_sandbox_are_open_from_the_start():
    """A chain you cannot begin is a chain with no first link."""
    s = fresh_village("first")
    assert s.campaign.is_open("wakewood_crypt")[0]
    assert s.campaign.is_open("the_proving")[0]
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "wakewood_crypt"})
    s.step(DT)
    assert s.campaign.current_area == "wakewood_crypt"


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


@pytest.mark.parametrize("role", ["elder", "weaponsmith", "apothecary", "hearth"])
def test_talk_at_the_advertised_boundary_reaches_the_client(role):
    s = fresh_village(f"talk-wire-{role}")
    first = s.snapshot()
    npc = next(n for n in first["npcs"] if n["role"] == role)
    p = s.state.player
    p.position = Vec2(npc["position"]["x"] + npc["radius"] + p.radius, npc["position"]["y"])
    assert "npcs" not in s.snapshot(), "ordinary snapshots omit unchanged NPC details"
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": npc["id"]})
    s.step(DT)
    response = s.snapshot()
    talks = [e for e in response["events"] if e["type"] == "NPC_TALK"]
    assert len(talks) == 1
    assert talks[0]["data"]["npc"] == npc["id"]
    assert talks[0]["data"]["lines"] == npc["lines"]
    assert talks[0]["data"]["stock"] == npc["stock"]


def test_shop_purchase_updates_inventory_while_dialogue_has_paused_the_world():
    s = fresh_village("shop-paused-wire")
    smith = stand_by(s, "weaponsmith")
    s.state.player.inventory.add_gold(500)
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": smith.id})
    s.step(DT)
    assert any(e["type"] == "NPC_TALK" for e in s.snapshot()["events"])
    s.handle_input({"type": "COMMAND", "action": "PAUSE"})
    s.handle_input({"type": "COMMAND", "action": "BUY_ITEM", "npcId": smith.id, "itemId": "iron_sword"})
    s.step(DT)
    response = s.snapshot()
    assert response["paused"]
    assert response["player"]["inventory"]["gold"] == 455
    assert "iron_sword" in {w["id"] for w in response["player"]["inventory"]["weapons"]}
    assert any(e["type"] == "SHOP_PURCHASE" for e in response["events"])
    s.handle_input({"type": "COMMAND", "action": "RESUME"})
    s.step(DT)
    assert not s.snapshot()["paused"]

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
    """And swapping swaps the ability bar with it.

    That is the point of two hands: the pair you carry is the moveset you have,
    so trading which is in front trades which two abilities are on keys one and
    two.
    """
    s = combat_session("swap")
    inv = s.state.player.inventory
    inv.add_weapon("iron_sword")
    inv.add_weapon("hunter_bow")
    assert inv.equipped_weapon == "iron_sword" and inv.offhand_weapon == "hunter_bow"
    assert inv.ability_slots[:2] == ["aegis", "shadow_dash"]

    s.handle_input({"type": "COMMAND", "action": "SWAP_WEAPON"})
    s.step(DT)
    assert inv.equipped_weapon == "hunter_bow" and inv.offhand_weapon == "iron_sword"
    assert inv.ability_slots[:2] == ["arrow_volley", "mending_light"]


def test_campaign_state_round_trips_through_its_save_form():
    state = CampaignState()
    state.complete("wakewood_crypt")
    state.rescue_twin()
    state.player_name, state.twin_name = "Wren", "Ash"
    restored = CampaignState.from_save(state.save_dict())
    assert restored.completed_areas == state.completed_areas
    assert restored.twin_rescued and restored.twin_name == "Ash"
    assert "emberfall" in restored.discovered_areas, "completing an area reveals what it unlocks"


# --- the console -------------------------------------------------------------

def test_spawning_from_the_console_puts_a_real_hostile_enemy_in_the_room():
    """`spawn mirror` is the Mirror, not a prop.

    It goes in through the ordinary spawn path, so it arrives with its real
    definition and its real controller and starts hunting -- which is the whole
    reason the console asks the server instead of drawing something itself.
    """
    s = combat_session("console-spawn")
    before = len(s.state.enemies)
    s.handle_input({"type": "COMMAND", "action": "SPAWN", "enemyType": "mirror"})
    for _ in range(40):
        s.step(DT)

    spawned = [e for e in s.state.enemies if e.enemy_def.id == "mirror"]
    assert len(s.state.enemies) == before + 1
    # Its real definition, not full health: it spawns into a live fight and
    # may already have been hit by the time we look. Asserting 520 *current*
    # health was really asserting that nothing had connected yet, which stopped
    # being true once a swing started landing on the Mirror's drawn body
    # rather than on a circle inside it.
    assert spawned and spawned[0].max_health == 520
    assert spawned[0].health > 0
    assert spawned[0].enemy_def.boss
    # It has noticed the player. A spawn that stood still would be a prop.
    assert spawned[0].state.value in {"chase", "attack", "reposition"}


def test_spawning_is_refused_in_a_village_and_does_not_stop_the_tick():
    """A safe room stays safe, and saying no must not kill the simulation.

    This guarded on a field the Room model does not have, which raised inside
    the tick -- so snapshots stopped and every client froze in place. The
    assertion that matters is the second one: the world still moves.
    """
    s = fresh_village("console-village")
    s.handle_input({"type": "COMMAND", "action": "SPAWN", "enemyType": "mirror"})
    for _ in range(10):
        s.step(DT)

    assert not s.state.enemies
    assert any(e.data.get("reason") == "not in a village"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")
    tick = s.state.tick
    s.step(DT)
    assert s.state.tick > tick, "the tick must survive a refused command"


# --- the Mirror --------------------------------------------------------------

def _walk_to_boss_room(session):
    """Step through a dungeon until the boss room is the current one."""
    for room in session.dungeon.rooms:
        session._enter_room(room, None)
        session.step(DT)
        if room.room_type == "boss":
            return room
    raise AssertionError("no boss room in this dungeon")


def test_the_twin_becomes_the_mirror_on_the_threshold():
    """The boss is your twin, and the boss room is where that lands.

    Up to here it has followed you, learned from you and fought beside you.
    Walking in takes it out of the world and leaves the Mirror standing where
    it was -- which is the reason the Mirror fights the way you do.
    """
    save_system.delete_save("taken")
    s = GameSession("taken", seed=5, record=False, start_area="mirror_sanctum")
    s.state.twin.dormant = False
    _walk_to_boss_room(s)
    # Walking in starts the scene; the twin is taken on its `hatch` beat.
    assert s.cutscene is not None, "the threshold opens the Sanctum's scene"
    play_cutscene(s)

    assert s.state.twin.dormant, "the twin leaves the world"
    assert "twin_taken" in s.campaign.flags
    taken = [e for e in s.state.pending_events if e.type == "TWIN_TAKEN"]
    assert len(taken) == 1, "it happens once"
    assert any(e.enemy_def.boss for e in s.state.enemies), "and the Mirror is there"
    wire = [e for e in s.snapshot()["events"] if e["type"] == "TWIN_TAKEN"]
    assert len(wire) == 1, "the browser must receive the event to play the transformation"


def test_a_twin_that_was_never_found_is_not_taken():
    """No companion, no transformation -- and no event to play a cutscene on."""
    save_system.delete_save("never")
    s = GameSession("never", seed=5, record=False, start_area="mirror_sanctum")
    assert s.state.twin.dormant
    _walk_to_boss_room(s)
    assert s.cutscene is None, "no companion, no scene to play"
    assert not any(e.type == "TWIN_TAKEN" for e in s.state.pending_events)


# --- the first weapon --------------------------------------------------------

def test_a_dungeon_entrance_leaves_a_blade_for_an_unarmed_player():
    """The opening has to hand you the moment the ability bar lights up.

    You begin bare-handed and abilities belong to weapons, so with nothing in
    your hands there is only the dash. Starting gold is zero and weapon drops
    are a chance, so without this a new player could clear the first dungeon
    and never see the rest of the moveset.
    """
    save_system.delete_save("blade")
    s = GameSession("blade", seed=5, record=False)
    assert s.state.player.inventory.ability_slots == ["shadow_dash"]

    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "wakewood_crypt"})
    s.step(DT)
    assert s.state.room.room_type == "entrance"
    blades = [p for p in s.state.pickups if p.item_id == "iron_sword"]
    assert len(blades) == 1

    walk_to(s, Vec2(blades[0].position.x, blades[0].position.y))
    for _ in range(30):
        s.step(DT)
    assert s.state.player.inventory.weapons == ["iron_sword"]
    assert s.state.player.inventory.ability_slots == ["aegis", "shadow_dash"]


def test_an_armed_player_finds_no_blade_at_the_threshold():
    """Owning anything at all means the threshold is bare, so it cannot be
    farmed and never turns up as clutter on a later run."""
    save_system.delete_save("armed")
    s = GameSession("armed", seed=5, record=False)
    s.state.player.inventory.add_weapon("hunter_bow")
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "wakewood_crypt"})
    s.step(DT)
    assert not [p for p in s.state.pickups if p.kind == "weapon"]


def test_the_smith_stocks_something_you_can_afford_first():
    """A shop whose cheapest weapon costs 140 cannot help a player with 0."""
    from mirrorbound.game.world.npc import VILLAGE_NPCS
    smith = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "weaponsmith")
    weapons = [e for e in smith.stock if e.kind == "weapon"]
    assert any(e.item_id == "iron_sword" for e in weapons)
    assert min(e.price for e in weapons) <= 60


def test_the_way_home_opens_at_the_far_end_rather_than_underfoot():
    """Reported from play: "i need to come to the centre instead of the end".

    The exit portal was placed at `room.width / 2, room.height / 2` -- the
    literal middle of the room, which is where the fight just happened and
    where the player is already standing. A dungeon that ends without a step
    does not read as leaving it.
    """
    from mirrorbound.game.world.campaign import HOME_VILLAGE, START_AREA

    s = GameSession("exit_portal", seed=11, record=False, start_area="wakewood_crypt")
    last = s.dungeon.rooms[-1]
    s._enter_room(last, from_side="south")
    s._open_exit_portal(last)

    home = HOME_VILLAGE.get(s.campaign.current_area, START_AREA)
    portal = next(p for p in last.portals if p.target_area == home)
    centre = Vec2(last.width / 2, last.height / 2)
    assert (Vec2(portal.x, portal.y) - centre).length() > 100, "still in the middle"
    # And it is opposite the way in, not just somewhere else.
    entered = last.player_spawn
    assert (Vec2(portal.x, portal.y) - entered).length() > (centre - entered).length()


def test_the_way_home_stays_inside_the_room():
    """Mirroring a spawn that is already near a wall must not put it in one."""
    from mirrorbound.game.world.campaign import HOME_VILLAGE, START_AREA

    s = GameSession("exit_inside", seed=12, record=False, start_area="wakewood_crypt")
    last = s.dungeon.rooms[-1]
    for side in ("south", "north", "east", "west"):
        last.portals.clear()
        s._enter_room(last, from_side=side)
        s._open_exit_portal(last)
        home = HOME_VILLAGE.get(s.campaign.current_area, START_AREA)
        portal = next(p for p in last.portals if p.target_area == home)
        assert 0 < portal.x < last.width, f"{side}: x outside the room"
        assert 0 < portal.y < last.height, f"{side}: y outside the room"
