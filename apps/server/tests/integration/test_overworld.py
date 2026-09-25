"""The continuous world: regions, crossings, settlements, and walking between them.

v1.1's first requirement is that portals stop being what makes the world feel
connected. What replaces them is a graph of regions joined at named crossings --
a bridge, a causeway, a cut through rock, a boatman -- with the villages standing
on the regions' own ground rather than behind a loading step.

These are the acceptance tests for that, so they walk the real `GameSession` and
assert what a player would see happen.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import TILE
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import (
    AREAS,
    CROSSINGS,
    OPPOSITE,
    OVERWORLD_KINDS,
    crossing_between,
    crossings_of,
    neighbours_of,
)
from mirrorbound.game.world.region import build_region

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def session(name: str = "world", area: str | None = None, seed: int = 5) -> GameSession:
    return GameSession(name, seed=seed, record=False, start_area=area)


def region(area_id: str, seed: int = 5, completed: set[str] | None = None):
    """A region built as the session builds it, with a campaign-shaped gate."""
    done = completed if completed is not None else set()

    def is_open(target: str) -> tuple[bool, str]:
        area = AREAS.get(target)
        if area is None:
            return False, "unknown area"
        if area.requires and area.requires not in done:
            return False, f"{AREAS[area.requires].name} first"
        return True, "ok"

    return build_region(area_id, DeterministicRNG(seed).spawn(f"area:{area_id}"), is_open, done)


def step_onto(s: GameSession, target: Vec2) -> None:
    """Put the player on a spot and let the tick notice."""
    s.state.transition_timer = 0.0
    s.state.player.position = target
    s.step(DT)


# --- the graph ---------------------------------------------------------------

def test_every_crossing_leads_back_where_it_came_from():
    """A one-way crossing strands a run, so both ends come from one record.

    Derived rather than authored twice, which makes the failure mode
    unrepresentable -- but the derivation itself is worth pinning, because it is
    the thing every other test here assumes.
    """
    for crossing in CROSSINGS:
        there = crossing_between(crossing.a, crossing.b)
        back = crossing_between(crossing.b, crossing.a)
        assert there is not None and back is not None, crossing.name
        assert there[0] == OPPOSITE[back[0]], (crossing.name, there[0], back[0])
        assert there[2] is back[2] is crossing, "the same record from both ends"


def test_the_whole_overworld_is_reachable_on_foot_from_the_start():
    """Walking, not travelling: every region has to be connected to the first one.

    A region nothing leads to is content nobody will see, and the graph is
    authored by hand -- so this walks the crossings breadth-first from the
    opening region and insists it touches all of them.
    """
    walkable = {a.id for a in AREAS.values() if a.kind in OVERWORLD_KINDS}
    seen, frontier = {"hollowreach_vale"}, ["hollowreach_vale"]
    while frontier:
        for _side, _along, other, _c in crossings_of(frontier.pop()):
            if other not in seen:
                seen.add(other)
                frontier.append(other)
    assert seen == walkable, f"unreachable on foot: {sorted(walkable - seen)}"


def test_every_dungeon_hangs_off_a_region_you_can_walk_to():
    mouths = {t for a in AREAS.values() for t, _fx, _fy in a.descents}
    dungeons = {a.id for a in AREAS.values() if a.kind == "dungeon"}
    assert dungeons == mouths, f"no way into: {sorted(dungeons - mouths)}"


# --- walking across ----------------------------------------------------------

def test_walking_onto_a_crossing_moves_you_without_anything_being_pressed():
    s = session("cross")
    assert s.campaign.current_area == "hollowreach_vale"
    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    step_onto(s, Vec2(bridge.x, bridge.y))
    assert s.campaign.current_area == "wakewood"


def test_you_arrive_on_the_side_you_came_from():
    """The world holds its shape: north out of one region is south into the next."""
    s = session("shape")
    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    assert bridge.side == "north"
    step_onto(s, Vec2(bridge.x, bridge.y))
    back = next(d for d in s.state.room.doors if d.target_area == "hollowreach_vale")
    assert back.side == "south"


def test_crossing_does_not_bounce_you_straight_back():
    """The arrival spot has to clear the crossing's own band.

    An edge is a band two tiles deep and the room logic hands control back after
    a short transition. Arriving *inside* that band means the crossing fires
    again the moment the timer runs out, and the player ping-pongs between two
    regions with no way to stop it. This is the test that says the inset is
    enough -- it holds the player still for a full second after arriving.
    """
    s = session("bounce")
    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    step_onto(s, Vec2(bridge.x, bridge.y))
    assert s.campaign.current_area == "wakewood"
    for _ in range(60):
        s.step(DT)
    assert s.campaign.current_area == "wakewood", "walked back over the bridge on its own"


def test_where_you_cross_is_where_you_come_out():
    """Cross near one end of a bridge and arrive near the matching end.

    Not the middle of the far side: a world that re-centres you every time you
    move through it does not hold its shape, and a long crossing would teleport
    you sideways by a screen.
    """
    s = session("along")
    bridge = next(d for d in s.state.room.doors if d.target_area == "greenmoor")
    low = Vec2(bridge.x, bridge.y - bridge.width * 0.35)
    step_onto(s, low)
    arrived = s.state.player.position
    back = next(d for d in s.state.room.doors if d.target_area == "hollowreach_vale")
    # Came in on the west side, below its middle, because that is where we left.
    assert arrived.y < back.y, (arrived, back.y)


def test_a_walk_from_the_first_village_to_the_second_crosses_four_regions():
    """The journey the brief asks for, taken end to end.

    Village, open fields, a flood, a ferry, and the basin the second village is
    in -- and the gate is a man with a boat rather than a refusal on a map.
    """
    s = session("journey")
    s.campaign.complete("wakewood_crypt")     # Kell will push off once the wood is quiet
    route = ["greenmoor", "drowned_flats", "emberfall_basin"]
    for target in route:
        door = next(d for d in s.state.room.doors if d.target_area == target)
        assert not door.locked, f"{door.label} was shut on the way to {target}"
        step_onto(s, Vec2(door.x, door.y))
        assert s.campaign.current_area == target, f"did not reach {target}"
    assert s.state.room.settlement_at(s.state.player.position) is None, (
        "arrived at the region's edge, not in the village")
    assert [x.id for x in s.state.room.settlements] == ["emberfall"]


# --- the gate ----------------------------------------------------------------

def test_the_ferryman_will_not_take_you_until_the_crypt_is_quiet():
    """The campaign's one gate, put somewhere a player can stand.

    Emberfall used to be locked behind "Wakewood Crypt first" as a refusal when
    you clicked a map. It is a boatman now, and the refusal says what he says.
    """
    s = session("ferry", area="drowned_flats")
    ferry = next(d for d in s.state.room.doors if d.target_area == "emberfall_basin")
    assert ferry.locked and ferry.kind == "ferry"
    assert "wood" in ferry.lock_reason.lower(), ferry.lock_reason

    step_onto(s, Vec2(ferry.x, ferry.y))
    assert s.campaign.current_area == "drowned_flats", "walked onto a tied-up boat"
    refusals = [e for e in s.state.pending_events
                if e.type == "ACTION_REJECTED" and e.data.get("action") == "CROSS"]
    assert refusals, "refused silently"
    assert refusals[0].data["reason"] == ferry.lock_reason


def test_the_ferryman_stops_repeating_himself():
    """Standing in the mouth of a shut crossing fires the check every tick.

    Saying the same line sixty times a second is how a toast stack becomes a wall
    of text, so the refusal is rate-limited. Asserted over two seconds, which is
    inside one refusal window.
    """
    s = session("ferry-spam", area="drowned_flats")
    ferry = next(d for d in s.state.room.doors if d.target_area == "emberfall_basin")
    s.state.transition_timer = 0.0
    s.state.player.position = Vec2(ferry.x, ferry.y)
    for _ in range(120):
        s.step(DT)
    refusals = [e for e in s.state.pending_events
                if e.type == "ACTION_REJECTED" and e.data.get("action") == "CROSS"]
    assert 1 <= len(refusals) <= 2, len(refusals)


def test_the_gate_opens_once_the_crypt_is_behind_you():
    s = session("ferry-open", area="drowned_flats")
    assert next(d for d in s.state.room.doors if d.target_area == "emberfall_basin").locked
    s.campaign.complete("wakewood_crypt")
    s._enter_area("drowned_flats", announce=False)
    ferry = next(d for d in s.state.room.doors if d.target_area == "emberfall_basin")
    assert not ferry.locked and not ferry.lock_reason


# --- settlements -------------------------------------------------------------

def test_the_village_is_ground_inside_the_region_not_a_room_of_its_own():
    s = session("inside")
    room = s.state.room
    assert room.room_type == "region"
    settlement = room.settlement_at(s.state.player.position)
    assert settlement is not None and settlement.id == "hollow_reach"
    # Walk out of the village without leaving the map.
    away = Vec2(TILE * 3, TILE * 3)
    assert room.settlement_at(away) is None
    assert not room.is_safe_at(away)
    assert room.is_safe_at(s.state.player.position)


def test_walking_into_a_village_writes_a_checkpoint_and_walking_out_says_so():
    """A checkpoint belongs to a settlement, and there is no room change to hang
    it on any more -- so arriving has to be watched for in the tick."""
    s = session("arrive")
    settlement = s.state.room.settlements[0]
    s.state.player.position = Vec2(TILE * 3, TILE * 3)
    s.step(DT)
    s.state.pending_events.clear()

    s.state.player.position = Vec2(settlement.x, settlement.y)
    s.step(DT)
    entered = [e for e in s.state.pending_events if e.type == "SETTLEMENT_ENTER"]
    assert entered and entered[0].data["settlement"] == "hollow_reach"
    assert [e for e in s.state.pending_events if e.type == "CHECKPOINT_SAVED"]

    s.state.pending_events.clear()
    s.state.player.position = Vec2(TILE * 3, TILE * 3)
    s.step(DT)
    assert [e for e in s.state.pending_events if e.type == "SETTLEMENT_EXIT"]


def test_respec_works_in_the_village_and_not_out_in_the_fields():
    """Both halves of the rule changed shape with the open world.

    "In a village" is a position now. "Out of combat" cannot mean "nothing is
    alive on this map", because a region always has wilderness in it -- so it
    means nothing has noticed you and nothing is close enough to.
    """
    s = session("respec-world")
    player = s.state.player
    player.skill_points = 4
    player.unlock_skill("keen_edge")
    assert player.unlocked_skills

    # Out in the fields: refused.
    s.state.player.position = Vec2(TILE * 3, TILE * 3)
    s.step(DT)
    s.handle_input({"type": "COMMAND", "action": "RESPEC"})
    s.step(DT)
    assert player.unlocked_skills, "refunded out in the open"
    assert any(e.data.get("reason") == "only in a village"
               for e in s.state.pending_events if e.type == "ACTION_REJECTED")

    # Back on the green: allowed, even though the vale has creatures in it.
    settlement = s.state.room.settlements[0]
    s.state.player.position = Vec2(settlement.x, settlement.y)
    s.step(DT)
    assert s.state.get_active_enemies(), "the vale is not empty; that is the point"
    s.handle_input({"type": "COMMAND", "action": "RESPEC"})
    s.step(DT)
    assert not player.unlocked_skills, "the tree came back"


def test_nothing_hostile_and_nothing_free_is_placed_inside_a_settlement():
    for area_id in ("hollowreach_vale", "emberfall_basin"):
        for seed in (1, 5, 42):
            room = region(area_id, seed)
            settlement = room.settlements[0]
            for spawn in room.enemy_spawns:
                assert not settlement.contains(spawn.position), (area_id, seed, spawn.enemy_type)
            for _kind, position in room.treasure:
                assert not settlement.contains(position), (area_id, seed)


# --- the shape of a region ---------------------------------------------------

@pytest.mark.parametrize("area_id", [a.id for a in AREAS.values() if a.kind in OVERWORLD_KINDS])
def test_a_region_is_seeded_and_deterministic(area_id):
    """Same seed, same region. The whole world is built this way."""
    def shape(room):
        return (room.tiles, [d.to_dict() for d in room.decor],
                [(s.enemy_type, s.position.x, s.position.y) for s in room.enemy_spawns],
                [d.to_dict() for d in room.doors])
    assert shape(region(area_id, 11)) == shape(region(area_id, 11))
    assert shape(region(area_id, 11)) != shape(region(area_id, 12))


@pytest.mark.parametrize("area_id", [a.id for a in AREAS.values() if a.kind in OVERWORLD_KINDS])
def test_a_region_never_leaves_you_standing_in_something_solid(area_id):
    for seed in (1, 5, 19, 42, 2024):
        room = region(area_id, seed)
        assert not room.is_blocked(room.player_spawn, 14.0), (area_id, seed, room.player_spawn)
        assert not room.is_blocked(room.twin_spawn, 12.0), (area_id, seed, room.twin_spawn)


def test_a_region_is_never_locked_shut_by_its_own_contents():
    """A region is `cleared` from the moment it is built.

    The room logic only opens doors on a room it considers cleared, and a region
    has wilderness in it permanently -- so a region that had to be cleared would
    be one you could walk into and never out of.
    """
    for area_id in (a.id for a in AREAS.values() if a.kind in OVERWORLD_KINDS):
        room = region(area_id)
        assert room.cleared, area_id


def test_the_snapshot_says_which_village_you_are_in():
    s = session("snap")
    assert s.snapshot()["settlement"] == "hollow_reach"
    s.state.player.position = Vec2(TILE * 3, TILE * 3)
    s.step(DT)
    assert s.snapshot()["settlement"] is None


def test_the_map_fills_in_as_you_walk_rather_than_all_at_once():
    s = session("map")
    assert "drowned_flats" not in s.campaign.discovered_areas
    for target in ("greenmoor", "drowned_flats"):
        door = next(d for d in s.state.room.doors if d.target_area == target)
        step_onto(s, Vec2(door.x, door.y))
    found = s.campaign.discovered_areas
    assert {"greenmoor", "drowned_flats", "emberfall_basin"} <= found, (
        "each arrival reveals what that region connects to")
    assert "kiln_terraces" not in found, "two regions on; no route seen yet"


def test_the_crypt_is_found_in_the_wood_rather_than_in_the_village():
    """Reaching the first dungeon is a walk now, and the mouth is where it should be."""
    s = session("mouth")
    assert not any(p.target_area == "wakewood_crypt" for p in s.state.room.portals)
    assert "wakewood_crypt" not in s.campaign.discovered_areas

    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    step_onto(s, Vec2(bridge.x, bridge.y))
    assert "wakewood_crypt" in s.campaign.discovered_areas
    mouth = next(p for p in s.state.room.portals if p.target_area == "wakewood_crypt")
    assert mouth.kind == "descent"
    step_onto(s, Vec2(mouth.x, mouth.y))
    assert s.campaign.current_area == "wakewood_crypt"
    assert s.dungeon is not None


def test_leaving_a_dungeon_puts_you_back_where_its_mouth_is():
    s = session("out", area="wakewood_crypt")
    s.handle_input({"type": "COMMAND", "action": "TRAVEL", "areaId": "wakewood"})
    s.step(DT)
    # Refused: leaving a dungeon means walking out of it.
    assert s.campaign.current_area == "wakewood_crypt"
    # The finished-dungeon road home leads to the wood, not to a village.
    from mirrorbound.game.world.campaign import HOME_VILLAGE
    assert HOME_VILLAGE["wakewood_crypt"] == "wakewood"
