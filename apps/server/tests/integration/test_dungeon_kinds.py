"""Three dungeon archetypes that play differently, and the branching in them.

§8 is explicit that the three types must not be "visually identical with
different enemies" -- their gameplay loops should feel different. The loop of a
dungeon is mostly one question: *what opens the far door?*

    combat   the room is clear
    puzzle   you found what opens it
    mirror   both, in the same room

So these tests are mostly about locks: which ones exist, what opens them, and
that clearing a room is not a skeleton key for all of them.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator
from mirrorbound.game.dungeon.templates import DungeonKind, RoomType
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS

DT = 1.0 / 60.0

DUNGEONS = [a for a in AREAS.values() if a.kind == "dungeon"]


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def run_of(area_id: str, seed: int = 5):
    area = AREAS[area_id]
    return DungeonGenerator(DeterministicRNG(seed).spawn(f"area:{area_id}")).generate(
        room_count=len(area.sequence), sequence=area.sequence, biome=area.biome,
        tutorial=area.tutorial, branches=area.branches)


def session(area: str, seed: int = 5) -> GameSession:
    return GameSession(f"dk-{area}", seed=seed, record=False, start_area=area)


# --- the three archetypes exist and differ ------------------------------------

def test_all_three_archetypes_are_actually_built():
    kinds = {a.dungeon_kind for a in DUNGEONS}
    assert kinds == {k.value for k in DungeonKind}, kinds


def test_a_puzzle_dungeon_is_mostly_locks_and_a_combat_one_is_mostly_fights():
    """The loops differ, measured rather than asserted by name."""
    puzzle = run_of("stonecount_barrow")
    combat = run_of("ashen_deep")

    puzzle_locked = sum(1 for r in puzzle.rooms for d in r.doors if d.needs_switch or d.needs_key)
    combat_locked = sum(1 for r in combat.rooms for d in r.doors if d.needs_switch or d.needs_key)
    assert puzzle_locked >= 3, "a puzzle dungeon holds its doors on something"
    assert combat_locked == 0, "a combat dungeon's doors open when the room is clear"

    puzzle_foes = sum(len(r.enemy_spawns) for r in puzzle.rooms)
    combat_foes = sum(len(r.enemy_spawns) for r in combat.rooms)
    assert combat_foes > puzzle_foes, (combat_foes, puzzle_foes)


def test_the_mirror_dungeon_holds_doors_on_a_fight_and_a_lock_at_once():
    glasswork = run_of("glasswork")
    mixed = [r for r in glasswork.rooms
             if r.enemy_spawns and any(d.needs_switch for d in r.doors)]
    assert mixed, "the mirror archetype's room is both at the same time"


# --- what actually opens a door -----------------------------------------------

def test_clearing_a_puzzle_room_does_not_open_its_door():
    """The whole archetype, in one assertion.

    Clearing a room has always unlocked its gates, and if that still applied
    here every lock in the barrow would dissolve the moment the last creature
    died -- which would make the puzzle dungeon a combat dungeon with scenery.
    """
    s = session("stonecount_barrow")
    room = next(r for r in s.dungeon.rooms if r.switches)
    s._enter_room(room, from_side="south")
    for enemy in list(s.state.get_active_enemies()):
        s.combat.damage_enemy(s.state, enemy, 10_000, s.state.player.id, [], Vec2(0, 1), 0.0, "test")
    s.step(DT)

    assert room.cleared, "the fight is over"
    onward = next(d for d in room.doors if d.side == "north" and d.target_index is not None)
    assert onward.locked, "and the way on is still shut"


def test_standing_on_every_plate_is_what_opens_it():
    s = session("stonecount_barrow")
    room = next(r for r in s.dungeon.rooms if len(r.switches) >= 2)
    s._enter_room(room, from_side="south")
    onward = next(d for d in room.doors if d.side == "north" and d.target_index is not None)

    for i, switch in enumerate(room.switches):
        assert onward.locked, f"opened after {i} of {len(room.switches)} plates"
        s.state.player.position = Vec2(switch.x, switch.y)
        s.step(DT)
    assert not onward.locked, "the last plate opens it"
    thrown = [e for e in s.state.pending_events if e.type == "SWITCH_THROWN"]
    assert len(thrown) == len(room.switches)
    assert thrown[-1].data["remaining"] == 0


def test_a_plate_is_thrown_once():
    s = session("stonecount_barrow")
    room = next(r for r in s.dungeon.rooms if r.switches)
    s._enter_room(room, from_side="south")
    switch = room.switches[0]
    s.state.player.position = Vec2(switch.x, switch.y)
    for _ in range(20):
        s.step(DT)
    thrown = [e for e in s.state.pending_events if e.type == "SWITCH_THROWN"
              and e.data["switch"] == switch.id]
    assert len(thrown) == 1, len(thrown)


def test_a_locked_door_wants_the_key_from_the_side_room():
    """§10's locked door and key, and the reason to take the branch."""
    s = session("stonecount_barrow")
    keyed = next((r for r in s.dungeon.rooms
                  for d in r.doors if d.needs_key), None)
    if keyed is None:
        pytest.skip("this seed's barrow rolled no keyed room")
    room = next(r for r in s.dungeon.rooms if any(d.needs_key for d in r.doors))
    onward = next(d for d in room.doors if d.needs_key)
    s._enter_room(room, from_side="south")
    room.unlock_doors(s.state.keys)
    assert onward.locked, "no key, no passage"

    s.state.keys.add(onward.needs_key)
    room.unlock_doors(s.state.keys)
    assert not onward.locked, "the key opens it"


def test_walking_over_a_key_picks_it_up_and_opens_what_it_opens():
    s = session("stonecount_barrow")
    room = next((r for r in s.dungeon.rooms if r.keys), None)
    if room is None:
        pytest.skip("this seed's barrow rolled no key")
    s._enter_room(room, from_side="south")
    key_pickup = next(p for p in s.state.pickups if p.kind == "key")
    s.state.player.position = key_pickup.position.copy()
    s.step(DT)
    assert key_pickup.item_id in s.state.keys
    assert [e for e in s.state.pending_events if e.type == "KEY_FOUND"]


def test_keys_do_not_leave_the_dungeon_they_were_found_in():
    """A key opens one door in one place. Carrying it out would leave every
    later run of that dungeon already open."""
    s = session("stonecount_barrow")
    s.state.keys.add("barrow_key")
    s._enter_area("greenmoor", announce=False)
    assert s.state.keys == set()


# --- branching (§10) -----------------------------------------------------------

def test_a_branch_is_a_room_off_the_side_that_leads_back():
    run = run_of("stonecount_barrow")
    chain = len(AREAS["stonecount_barrow"].sequence)
    assert len(run.rooms) == chain + len(AREAS["stonecount_barrow"].branches)

    for host_index in AREAS["stonecount_barrow"].branches:
        host = run.rooms[host_index]
        east = next(d for d in host.doors if d.side == "east")
        side = run.rooms[east.target_index]
        assert side.room_type == "side"
        back = next(d for d in side.doors if d.side == "west")
        assert back.target_index == host_index, "a branch you cannot walk out of"


def test_a_side_room_is_never_on_the_way_to_anywhere():
    """Optional by construction: the main route never passes through one."""
    for area in DUNGEONS:
        run = run_of(area.id)
        chain = len(area.sequence)
        for room in run.rooms[chain:]:
            onward = [d for d in room.doors if d.side == "north" and d.target_index is not None]
            assert not onward, f"{area.id}: a side room leads deeper"


def test_a_side_room_is_worth_the_detour():
    for area in DUNGEONS:
        run = run_of(area.id)
        for room in run.rooms[len(area.sequence):]:
            assert room.treasure or room.keys, f"{area.id}: an empty side room"


# --- still a dungeon -----------------------------------------------------------

@pytest.mark.parametrize("area_id", [a.id for a in DUNGEONS])
def test_every_dungeon_is_seeded_and_deterministic(area_id):
    def shape(run):
        return [(r.index, r.room_type, r.name, [d.to_dict() for d in r.doors],
                 [s.to_dict() for s in r.switches]) for r in run.rooms]
    assert shape(run_of(area_id, 13)) == shape(run_of(area_id, 13))


@pytest.mark.parametrize("area_id", [a.id for a in DUNGEONS])
def test_every_dungeon_can_be_finished(area_id):
    """Room by room, opening each door the way the room means it to be opened.

    A dungeon with a lock nothing in it opens is a run that cannot end, and the
    locks are placed by template and linked by the generator -- two separate
    steps that have to agree.
    """
    s = session(area_id)
    for room in s.dungeon.rooms[:len(AREAS[area_id].sequence)]:
        s._enter_room(room, from_side="south")
        for enemy in list(s.state.get_active_enemies()):
            s.combat.damage_enemy(s.state, enemy, 10_000, s.state.player.id, [],
                                  Vec2(0, 1), 0.0, "test")
        for switch in room.switches:
            s.state.player.position = Vec2(switch.x, switch.y)
            s.step(DT)
        for pickup in [p for p in s.state.pickups if p.kind == "key"]:
            s.state.player.position = pickup.position.copy()
            s.step(DT)
        s.step(DT)
        room.unlock_doors(s.state.keys)

        onward = next((d for d in room.doors
                       if d.side == "north" and d.target_index is not None), None)
        if onward is not None:
            assert not onward.locked, f"{area_id} room {room.index} cannot be left"


def test_the_barrow_and_the_glasswork_are_reachable_from_the_world():
    mouths = {t for a in AREAS.values() for t, _fx, _fy in a.descents}
    assert {"stonecount_barrow", "glasswork"} <= mouths
