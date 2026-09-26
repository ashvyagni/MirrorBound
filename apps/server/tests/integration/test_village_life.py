"""Villages with people in them: rounds walked, stock that differs, lines that change.

§3, §4, §14 and §19 of the expansion brief, which are really one requirement seen
from four sides -- a settlement should read as a working place rather than as a
row of shops. What that means concretely:

    the people are where their work is        (§3)
    some of them are going somewhere          (§4)
    what they say tracks what you have done   (§14)
    what they sell says where you are         (§19)
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.npc import DIALOGUE_STATES, REGION_NPCS, VILLAGE_NPCS
from mirrorbound.game.world.region import build_region
from mirrorbound.game.world.villagers import ROUTINES, update_all

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def region(area_id: str, seed: int = 5):
    return build_region(area_id, DeterministicRNG(seed).spawn(f"area:{area_id}"),
                        lambda _a: (True, "ok"), set())


# --- people going about their day (§4) ---------------------------------------

def test_a_village_has_people_walking_rounds_in_it():
    room = region("hollowreach_vale")
    assert len(room.villagers) == len(ROUTINES)
    roles = {v.role for v in room.villagers}
    # Each one says something about how the place works.
    assert {"farmer", "carter", "guard", "child"} <= roles


def test_villagers_actually_get_somewhere():
    room = region("hollowreach_vale")
    start = [v.position.copy() for v in room.villagers]
    for _ in range(900):     # fifteen seconds
        update_all(room.villagers, DT)
    moved = [(v.position - was).length() for v, was in zip(room.villagers, start)]
    assert all(d > 20.0 for d in moved), moved


def test_a_round_is_a_round_and_comes_back():
    """They loop. Somebody who walks off the map is not going about their day."""
    room = region("hollowreach_vale")
    farmer = next(v for v in room.villagers if v.role == "farmer")
    home = farmer.position.copy()
    furthest = 0.0
    for _ in range(60 * 200):    # long enough for several circuits
        update_all(room.villagers, DT)
        furthest = max(furthest, (farmer.position - home).length())
    # They went somewhere, and they are back near where they started.
    assert furthest > 100.0, furthest
    assert min((farmer.position - stop).length() for stop in farmer.route) < 40.0


def test_villagers_pause_where_they_arrive():
    """Somebody who never stops is patrolling; somebody who stops is working."""
    room = region("hollowreach_vale")
    paused = 0
    for _ in range(60 * 40):
        update_all(room.villagers, DT)
        paused += sum(1 for v in room.villagers if v.waiting > 0)
    assert paused > 0, "nobody ever stopped"


def test_walking_the_village_is_deterministic():
    """Same seed, same day. No RNG runs in the update at all."""
    def walk(seed):
        room = region("hollowreach_vale", seed)
        for _ in range(600):
            update_all(room.villagers, DT)
        return [(v.id, round(v.position.x, 3), round(v.position.y, 3), v.leg) for v in room.villagers]
    assert walk(7) == walk(7)


def test_villagers_are_not_something_you_walk_into():
    """Scenery that moves. A person who blocks a doorway they wandered into is
    worse than no person at all, and they have no collision for that reason."""
    room = region("hollowreach_vale")
    for villager in room.villagers:
        assert not room.is_blocked(villager.position, 1.0), villager.role


def test_a_region_with_no_village_has_nobody_wandering_it():
    assert region("greenmoor").villagers == []
    assert region("wakewood").villagers == []


def test_the_snapshot_carries_them_every_frame():
    """They move, so once a second would read as a stutter rather than a walk."""
    s = GameSession("life", seed=5, record=False)
    for _ in range(30):
        s.step(DT)
    snap = s.snapshot()
    assert len(snap["villagers"]) == len(ROUTINES)
    who = snap["villagers"][0]
    assert {"id", "role", "sprite", "position", "facing", "moving"} <= set(who)

    # And they are gone the moment you leave the village behind.
    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    s.state.transition_timer = 0.0
    s.state.player.position = Vec2(bridge.x, bridge.y)
    s.step(DT)
    assert s.snapshot()["villagers"] == []


# --- the people you can talk to (§3) -----------------------------------------

def test_everyone_stands_where_their_work_is():
    """A blacksmith should not be in the middle of a field -- the brief says so.

    The vendors are posted against their own building rather than at a
    coordinate, so moving the forge moves Oren with it.
    """
    room = region("hollowreach_vale")
    settlement = room.settlements[0]
    forge = next(d for d in room.decor if d.kind == "forge")
    smith = next(n for n in room.npcs if n.definition.role == "weaponsmith")
    assert (Vec2(smith.x, smith.y) - Vec2(forge.x, forge.y)).length() < 120, "the smith is at the forge"

    # And the watch is out on the road in, not on the green.
    watch = next(n for n in room.npcs if n.id == "watch_wren")
    assert Vec2(watch.x, watch.y).y > settlement.y, "the watch faces the way in"
    assert settlement.contains(Vec2(watch.x, watch.y)), "but still in the village"


def test_both_villages_are_inhabited_and_neither_is_the_other():
    hollow = {n.id for n in region("hollowreach_vale").npcs}
    ember = {n.id for n in region("emberfall_basin").npcs}
    assert len(hollow) >= 5 and len(ember) >= 4
    # The hearth is the one thing both have, because both have a fire.
    assert hollow & ember == {"hearth"}


# --- merchants with an identity (§19) ----------------------------------------

def test_the_two_smiths_do_not_stock_the_same_bench():
    """Oren and Siv used to be the same two objects placed in both villages, so
    the second settlement sold exactly what the first did. The walk east has to
    be worth taking."""
    oren = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "weaponsmith")
    hask = next(n for n in VILLAGE_NPCS["emberfall"] if n.role == "weaponsmith")
    assert oren.id != hask.id
    assert {e.item_id for e in oren.stock} != {e.item_id for e in hask.stock}


def test_the_farming_village_sells_a_starter_blade_and_the_mountain_one_sells_staves():
    """Stock reinforces geography, which is what §19 asks for."""
    oren = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "weaponsmith")
    hask = next(n for n in VILLAGE_NPCS["emberfall"] if n.role == "weaponsmith")
    oren_has = {e.item_id for e in oren.stock}
    hask_has = {e.item_id for e in hask.stock}

    assert "iron_sword" in oren_has, "a shop with nothing under 140 cannot help a new player"
    assert min(e.price for e in oren.stock if e.kind == "weapon") <= 60
    assert {"ember_staff", "frost_staff"} <= hask_has, "the serious bench is east"
    assert not {"ember_staff", "frost_staff"} & oren_has


def test_nobody_sells_a_testing_tool():
    from mirrorbound.game.combat.weapons import ADMIN_WEAPONS

    for people in (*VILLAGE_NPCS.values(), *REGION_NPCS.values()):
        for npc in people:
            assert not {e.item_id for e in npc.stock} & ADMIN_WEAPONS, npc.id


# --- dialogue that tracks the run (§14) --------------------------------------

def test_what_the_elder_says_changes_four_times_over_a_run():
    elder = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "elder")
    said = []
    flags: set[str] = set()
    for state in ("intro", "quest_active", "twin_rescued", "cleared_wakewood_crypt"):
        if state != "intro":
            flags.add(state)
        said.append(elder.dialogue_for(flags, "Wren", "Ash"))
    assert len(set(said)) == len(said), "the elder repeated herself"


def test_a_later_state_wins_over_an_earlier_one():
    """Somebody who has seen the twin never falls back to their opening."""
    elder = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "elder")
    late = elder.dialogue_for({"quest_active", "twin_rescued"}, "Wren", "Ash")
    assert late == elder.dialogue_for({"twin_rescued"}, "Wren", "Ash")
    assert late != elder.dialogue_for({"quest_active"}, "Wren", "Ash")


def test_an_npc_with_nothing_new_to_say_keeps_their_opening():
    bram = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.id == "farmer_bram")
    assert bram.dialogue_for({"cleared_ashen_deep"}, "Wren", "Ash") == bram.lines["intro"]


def test_every_authored_state_is_one_the_run_can_actually_reach():
    """A line set keyed on a flag nothing sets is a line nobody will ever read."""
    for people in (*VILLAGE_NPCS.values(), *REGION_NPCS.values()):
        for npc in people:
            unreachable = set(npc.lines) - set(DIALOGUE_STATES)
            assert not unreachable, f"{npc.id}: {sorted(unreachable)}"


def test_names_reach_the_lines_that_use_them():
    elder = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "elder")
    lines = elder.dialogue_for({"twin_rescued"}, "Rell", "Ash")
    assert any("Rell" in line for line in lines)
    assert not any("{player}" in line or "{twin}" in line for line in lines)


# --- the ferryman (§22, and the gate with a face) ----------------------------

def test_kell_stands_on_his_jetty_rather_than_in_a_village():
    room = region("drowned_flats")
    kell = next(n for n in room.npcs if n.id == "ferryman_kell")
    ferry = next(d for d in room.doors if d.target_area == "emberfall_basin")
    assert (Vec2(kell.x, kell.y) - Vec2(ferry.x, ferry.y)).length() < 400, "beside the boat"
    assert not room.settlements, "the flats have no village"


def test_kell_says_why_the_boat_is_tied_and_changes_his_mind():
    kell = REGION_NPCS["drowned_flats"][0]
    before = " ".join(kell.dialogue_for(set(), "Wren", "Ash"))
    after = " ".join(kell.dialogue_for({"cleared_wakewood_crypt"}, "Wren", "Ash"))
    assert "tied" in before.lower(), before
    assert before != after
    assert "get in" in after.lower(), after


def test_the_elder_names_the_crossing_she_is_sending_you_over():
    """§6 wants directions given by people, so the names have to match the world."""
    from mirrorbound.game.world.campaign import CROSSINGS

    names = {c.name.lower() for c in CROSSINGS}
    elder = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.role == "elder")
    wren = next(n for n in VILLAGE_NPCS["hollow_reach"] if n.id == "watch_wren")
    spoken = " ".join(line for npc in (elder, wren)
                      for lines in npc.lines.values() for line in lines).lower()
    assert "rootbridge" in spoken
    assert any(name.split()[-1] in spoken for name in names), spoken
