"""Whole-simulation tests: scripted inputs through the real GameSession.

These are the replay contract for the full game (not the toy in
test_determinism.py): same seed + same tick-stamped inputs -> same event log
and same final state.
"""

from __future__ import annotations

import json

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from tests.conftest import combat_session, DT

# A scripted "player": walk north to the gate, into the combat room, fight.
def scripted_input(tick: int) -> PlayerInput:
    if tick < 200:
        return PlayerInput(move_y=-1, run=True)
    if tick < 260:
        return PlayerInput(move_y=-1)
    phase = tick % 90
    attack = phase in (5, 35, 65)
    ability = 1 if phase == 20 else 2 if phase == 50 else 3 if phase == 80 else None
    move_x = 1 if (tick // 60) % 2 == 0 else -1
    return PlayerInput(move_x=move_x, move_y=-1 if phase < 45 else 0, attack=attack, ability=ability)


def run_session(seed: int, ticks: int) -> tuple[GameSession, list[dict]]:
    s = combat_session("sim", seed=seed)
    log: list[dict] = []
    for t in range(ticks):
        s.pending_input = scripted_input(t)
        s.step(DT)
        log.extend(e.to_json_dict() for e in s.state.drain_events())
    return s, log


def test_full_simulation_is_deterministic():
    a, log_a = run_session(2024, 900)
    b, log_b = run_session(2024, 900)
    assert log_a == log_b
    assert a.state.to_dict() == b.state.to_dict()
    assert a.pipeline.snapshot().to_json_dict() == b.pipeline.snapshot().to_json_dict()
    assert a.style.snapshot() == b.style.snapshot()


def test_different_seeds_diverge():
    _, log_a = run_session(1, 400)
    _, log_b = run_session(2, 400)
    assert log_a != log_b


def test_scripted_run_reaches_combat_fights_and_the_twin_acts():
    s, log = run_session(77, 1500)
    types = {e["type"] for e in log}
    # The walk north crosses into room 1 through the unlocked entrance gate.
    assert "ROOM_ENTER" in types and s.state.room.index >= 1
    assert "PLAYER_ATTACKED" in types and "PLAYER_ABILITY_CAST" in types
    assert "DAMAGE_DEALT" in types
    assert "TWIN_ACTION" in types, "the twin must make decisions"
    twin_intents = {e["data"]["intent"] for e in log if e["type"] == "TWIN_ACTION"}
    assert len(twin_intents) >= 2, f"twin only ever chose {twin_intents}"
    assert "TWIN_ATTACKED" in types, "the twin must fight independently"
    assert s.last_error is None
    # The player model saw real player actions.
    model = s.pipeline.snapshot().to_json_dict()
    assert model["traits"]["aggression"]["samples"] > 0
    assert model["spatial"]["combat"], "combat heatmap should have cells from real positions"
    # Everything in the snapshot is JSON serialisable.
    json.dumps(s.snapshot())


def test_snapshot_shape_has_every_hud_field():
    s = combat_session("snap", seed=9, record=False)
    s.step(DT)
    snap = s.snapshot()
    assert snap["type"] == "SNAPSHOT" and snap["roomFull"] is True
    player = snap["player"]
    for key in ("health", "maxHealth", "mana", "maxMana", "xp", "xpToNext", "level", "abilities", "inventory",
                "weapon", "facing", "state", "skillTree", "skillPoints"):
        assert key in player, key
    # Abilities come from the weapons carried, so the bar is as long as the
    # hands are full -- the session fixture starts inside a dungeon unarmed.
    assert len(player["abilities"]) == len(s.state.player.inventory.ability_slots)
    twin = snap["twin"]
    assert "intent" in twin and "utilities" in twin["intent"]
    assert "twinModel" in snap and "dims" in snap["twinModel"]
    assert "playerModel" in snap and "traits" in snap["playerModel"]
    room = snap["room"]
    assert room["tiles"] and room["decor"] and room["doors"]
    # A second snapshot is lite unless the room changed.
    snap2 = s.snapshot()
    assert snap2["roomFull"] is False and "tiles" not in snap2["room"]


def test_room_transition_through_an_unlocked_door():
    s = combat_session("doors", seed=5, record=False)
    room0 = s.state.room
    door = room0.door_to(1)
    assert door is not None and not door.locked
    s.state.transition_timer = 0
    s.state.player.position = Vec2(door.x, door.y + 10)
    s.step(DT)
    assert s.state.room.index == 1
    assert s.state.enemies, "combat room spawns enemies on first visit"
    assert s.state.room.door_to(0) is not None and s.state.room.door_to(0).locked


def test_clearing_a_room_unlocks_it_and_pause_freezes_the_sim():
    s = combat_session("clear", seed=5, record=False)
    s._enter_room(s.dungeon.rooms[1], from_side="south")
    for e in s.state.enemies:
        e.take_hit(10_000, s.state.player.id)
    s.step(DT)
    assert s.state.room.cleared and all(not d.locked for d in s.state.room.doors)
    assert s.state.stats.rooms_cleared == 1
    tick = s.state.tick
    s.handle_input({"type": "COMMAND", "action": "PAUSE"})
    s.step(DT)
    s.step(DT)
    assert s.state.tick == tick and s.state.paused
    s.handle_input({"type": "COMMAND", "action": "RESUME"})
    s.step(DT)
    assert s.state.tick == tick + 1


def test_commands_equip_unlock_and_use_items():
    s = combat_session("cmds", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("hunter_bow")
    s.handle_input({"type": "COMMAND", "action": "EQUIP_WEAPON", "weaponId": "hunter_bow"})
    s.step(DT)
    assert p.current_weapon == "hunter_bow"
    p.skill_points = 2
    s.handle_input({"type": "COMMAND", "action": "UNLOCK_SKILL", "skillId": "vitality"})
    s.step(DT)
    assert "vitality" in p.unlocked_skills and p.max_health == 130
    p.health = 50
    p.inventory.add_consumable("health_potion")
    s.handle_input({"type": "COMMAND", "action": "USE_ITEM", "itemId": "health_potion"})
    s.step(DT)
    # Drinking takes 0.4s: nothing is restored and nothing is consumed yet.
    assert p.state == "drink" and p.health == 50 and p.inventory.consumables["health_potion"] == 1
    for _ in range(int(0.4 / DT) + 2):
        s.step(DT)
    assert p.health == 90 and not p.inventory.consumables
    s.handle_input({"type": "COMMAND", "action": "TWIN_EQUIP", "weaponId": "hunter_bow"})
    s.step(DT)
    assert s.state.twin.weapon.id == "hunter_bow"
    s.handle_input({"type": "COMMAND", "action": "RESTART", "seed": 77})
    s.step(DT)
    # A restart puts you back where the game starts you: empty-handed.
    assert s.seed == 77 and s.state.tick <= 1 and s.state.player.current_weapon == "bare_hands"


def test_seed_from_session_id_is_stable():
    from mirrorbound.api.session import seed_from_session
    assert seed_from_session("default") == seed_from_session("default")
    assert seed_from_session("a") != seed_from_session("b")


def test_legacy_ability_selection_is_rejected_without_stopping_the_session():
    s = GameSession("legacy-slots", seed=5, record=False)
    before = s.state.player.inventory.ability_slots
    s.handle_input({"type": "COMMAND", "action": "SET_ABILITY_SLOT", "slot": 1, "abilityId": "mending_light"})
    s.step(DT)
    assert s.state.player.inventory.ability_slots == before
    assert any(e["type"] == "ACTION_REJECTED" and e["data"].get("action") == "SET_ABILITY_SLOT"
               for e in s.snapshot()["events"])
    tick = s.state.tick
    s.step(DT)
    assert s.state.tick == tick + 1


# --- the connection actually resumes -------------------------------------------


def test_a_websocket_connection_resumes_from_its_checkpoint():
    """The checkpoint system was write-only from the browser's point of view.

    Every hearth and every village wrote a save, and the WebSocket built its
    session without `load_save`, so nothing ever read one back: closing the tab
    lost the run. This asserts the wiring rather than the save format, which
    `test_world_loop` already covers.
    """
    import inspect

    from mirrorbound.api import websocket as ws_module
    from mirrorbound.game.world import save as save_system

    source = inspect.getsource(ws_module.websocket_endpoint)
    assert "load_save=" in source, "the endpoint must decide about resuming, explicitly"

    # And the round trip itself: a session that saved progress, reconnecting.
    save_system.delete_save("resume")
    first = GameSession("resume", seed=5, record=False)
    first.campaign.player_name = "Wren"
    first.campaign.discovered_areas.add("wakewood_crypt")
    first.campaign.complete("wakewood_crypt")
    first._checkpoint()

    again = GameSession("resume", seed=5, record=False, load_save=True)
    assert again.campaign.player_name == "Wren"
    assert "wakewood_crypt" in again.campaign.completed_areas
    save_system.delete_save("resume")


def test_a_seeded_connection_starts_over_rather_than_resuming():
    """`?seed=` means "run this seed", which a resumed save would silently
    ignore. The two must not both apply."""
    import inspect

    from mirrorbound.api import websocket as ws_module

    source = inspect.getsource(ws_module.websocket_endpoint)
    assert "load_save=seed is None" in source
