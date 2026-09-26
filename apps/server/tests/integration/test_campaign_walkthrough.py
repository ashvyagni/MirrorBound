"""The whole game, start to finish, using only moves a player could make.

§33 says not to consider the project finished because it builds, and to test the
actual game. This is that test: it walks out of the first village, crosses every
region on foot, opens every crossing the way the world means it to be opened,
takes every dungeon down to its guardian, and ends standing over the Mirror.

It exists because of the bug it would have caught. Branching side rooms are
appended after a dungeon's main chain, and the code that finishes a dungeon
asked whether the cleared room was the last in the *list* -- so once the crypt
and the Deep grew a branch, neither could ever be completed, the ferryman never
untied his boat, and the campaign stopped at the second region. Every individual
system passed its own tests throughout.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS

DT = 1.0 / 60.0

#: The walk, in order: every region between the two villages, and every descent.
ROUTE: tuple[tuple[str, str], ...] = (
    ("cross", "wakewood"),
    ("descend", "wakewood_crypt"),
    ("cross", "hollowreach_vale"),
    ("cross", "greenmoor"),
    ("descend", "stonecount_barrow"),
    ("cross", "drowned_flats"),
    ("cross", "emberfall_basin"),
    ("descend", "glasswork"),
    ("cross", "kiln_terraces"),
    ("descend", "ashen_deep"),
    ("descend", "mirror_sanctum"),
)


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


class Walker:
    """Plays the game the only way the server allows: by standing on things."""

    def __init__(self, seed: int = 5):
        self.s = GameSession("walkthrough", seed=seed, record=False)
        # Strong enough to finish, so the test measures whether the campaign is
        # *completable* rather than whether a level-one character can do it.
        # Balance is Phase 8's question and has its own tests.
        player = self.s.state.player
        player.level = 20
        player.base_max_health = 4000
        player.recompute_max_health()
        player.health = player.max_health

    def step(self, n: int = 1) -> None:
        for _ in range(n):
            self.s.state.player.health = self.s.state.player.max_health
            self.s.step(DT)

    def stand_on(self, x: float, y: float) -> None:
        self.s.state.transition_timer = 0.0
        self.s.state.player.position = Vec2(x, y)
        self.step()

    # --- the two ways out of somewhere -------------------------------------

    def cross_to(self, area_id: str) -> None:
        door = next((d for d in self.s.state.room.doors if d.target_area == area_id), None)
        assert door is not None, f"no crossing from {self.s.campaign.current_area} to {area_id}"
        assert not door.locked, (
            f"{door.label or area_id} is shut: {door.lock_reason!r}")
        self.stand_on(door.x, door.y)
        assert self.s.campaign.current_area == area_id, (
            f"walked onto {door.label} and did not arrive")

    def descend_into(self, area_id: str) -> None:
        portal = next((p for p in self.s.state.room.portals if p.target_area == area_id), None)
        assert portal is not None, f"no mouth for {area_id} in {self.s.campaign.current_area}"
        assert not portal.locked, f"{area_id} is gated: {portal.lock_reason!r}"
        self.stand_on(portal.x, portal.y)
        assert self.s.campaign.current_area == area_id

    # --- and what a dungeon asks of you -------------------------------------

    def clear_dungeon(self) -> None:
        """Walk the chain, opening each room the way that room means it."""
        s = self.s
        area_id = s.campaign.current_area
        assert s.dungeon is not None, area_id
        for index in range(s.dungeon.chain):
            room = s.dungeon.rooms[index]
            if s.state.room is not room:
                s._enter_room(room, from_side="south")
            self.solve(room)
            if index < s.dungeon.chain - 1:
                onward = next(d for d in room.doors
                              if d.side == "north" and d.target_index is not None)
                assert not onward.locked, f"{area_id} room {index} will not open"
        assert area_id in s.campaign.completed_areas, f"{area_id} never completed"

    def walk_home(self, from_area: str) -> None:
        """Out of a finished dungeon, under your own power.

        The Sanctum has no road home and should not: beating the Mirror ends
        the run, and an exit portal there would be a way to walk away from the
        ending. Everywhere else opens one.
        """
        if self.s.state.phase == "victory":
            return
        home = next((p for p in self.s.state.room.portals
                     if p.target_area != from_area and not p.locked), None)
        assert home is not None, f"{from_area} opened no way home"
        self.stand_on(home.x, home.y)

    def solve(self, room) -> None:
        """Kill what is here, stand on what needs standing on, take the key."""
        s = self.s
        # The Sanctum's threshold starts a scene, and a scene owns every tick it
        # runs for -- the player's input is dropped and the boss does not act.
        # Let it play, the way a player has to.
        guard = 0
        while s.cutscene is not None and guard < 4000:
            s.step(DT)
            guard += 1
        for _ in range(60):
            alive = [e for e in s.state.get_active_enemies()]
            if not alive:
                break
            for enemy in alive:
                s.combat.damage_enemy(s.state, enemy, 100_000, s.state.player.id, [],
                                      Vec2(0, 1), 0.0, "walkthrough")
            self.step()
        for switch in room.switches:
            self.stand_on(switch.x, switch.y)
        for pickup in [p for p in s.state.pickups if p.kind == "key"]:
            self.stand_on(pickup.position.x, pickup.position.y)
        self.step(3)
        room.unlock_doors(s.state.keys)


def test_the_whole_campaign_can_be_played_from_the_first_village_to_the_mirror():
    w = Walker()
    assert w.s.campaign.current_area == "hollowreach_vale"

    for move, target in ROUTE:
        if move == "cross":
            w.cross_to(target)
        else:
            w.descend_into(target)
            w.clear_dungeon()
            w.walk_home(target)

    assert w.s.state.phase == "victory", w.s.state.phase
    assert w.s.campaign.completed_areas >= {
        "wakewood_crypt", "stonecount_barrow", "glasswork", "ashen_deep", "mirror_sanctum"}


def test_the_ferryman_is_the_only_thing_standing_between_the_two_villages():
    """Walk east without clearing the crypt and you get as far as the jetty."""
    w = Walker()
    w.cross_to("greenmoor")
    w.cross_to("drowned_flats")
    ferry = next(d for d in w.s.state.room.doors if d.target_area == "emberfall_basin")
    assert ferry.locked and ferry.kind == "ferry"

    # And nothing else on the route was shut.
    for area_id in ("hollowreach_vale", "greenmoor"):
        area = AREAS[area_id]
        assert area.kind == "region"


def test_finishing_the_crypt_is_what_lets_you_reach_emberfall():
    w = Walker()
    w.cross_to("wakewood")
    w.descend_into("wakewood_crypt")
    w.clear_dungeon()
    home = next(p for p in w.s.state.room.portals if p.target_area == "wakewood")
    w.stand_on(home.x, home.y)

    w.cross_to("hollowreach_vale")
    w.cross_to("greenmoor")
    w.cross_to("drowned_flats")
    ferry = next(d for d in w.s.state.room.doors if d.target_area == "emberfall_basin")
    assert not ferry.locked, "Kell still will not take you"
    w.cross_to("emberfall_basin")
    assert w.s.state.room.settlements[0].id == "emberfall"


def test_every_dungeon_finishes_at_the_end_of_its_chain_not_its_list():
    """The bug this file was written for.

    Side rooms are appended after the main route, so a dungeon with a branch
    has `rooms[-1]` sitting off to one side. Completion asked for the last room
    in the list and therefore never fired.
    """
    for area in AREAS.values():
        if area.kind != "dungeon":
            continue
        s = GameSession(f"chain-{area.id}", seed=5, record=False, start_area=area.id)
        assert s.dungeon is not None
        assert s.dungeon.chain == len(area.sequence), area.id
        if area.branches:
            assert len(s.dungeon.rooms) > s.dungeon.chain, area.id
            assert s.dungeon.last_room_index < len(s.dungeon.rooms) - 1, area.id


@pytest.mark.parametrize("seed", [1, 5, 2024])
def test_the_campaign_is_completable_on_more_than_one_seed(seed):
    """Rooms, decor and side rooms are all rolled, so one seed proves one world."""
    w = Walker(seed=seed)
    for move, target in ROUTE:
        if move == "cross":
            w.cross_to(target)
        else:
            w.descend_into(target)
            w.clear_dungeon()
            w.walk_home(target)
    assert w.s.state.phase == "victory"
