"""The shard, the corrupted twin, and the Sanctum's opening scene.

One arc across two areas: the Warden leaves a piece of the mirror, the twin
takes it and carries it red, and walking into the Sanctum plays the scene that
turns it into the Mirror.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.cutscene import BEATS, LINES
from tests.conftest import DT, play_cutscene, run_ticks, wake_twin


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def sanctum(name: str = "scene") -> GameSession:
    s = GameSession(name, seed=5, record=False, start_area="mirror_sanctum")
    wake_twin(s)
    return s


def boss_room(s: GameSession):
    return next(r for r in s.dungeon.rooms if r.room_type == "boss")


def events(s: GameSession, kind: str) -> list:
    return [e for e in s.state.pending_events if e.type == kind]


# --- the shard ---------------------------------------------------------------

def test_the_warden_leaves_a_shard_the_twin_takes_and_the_player_cannot():
    s = GameSession("shard", seed=5, record=False, start_area="ashen_deep")
    wake_twin(s)
    warden = s.state.spawn_enemy("warden", s.state.player.position + Vec2(180, 0))
    s.combat.damage_enemy(s.state, warden, 10_000, s.state.player.id, [], Vec2(), 0, "test")

    shard = next(p for p in s.state.pickups if p.kind == "mirror_shard")
    assert shard.ttl == 0, "it waits however long the twin takes"

    # Standing on it does nothing for the player.
    s.state.player.position = shard.position.copy()
    s.state.twin.position = Vec2(-500, -500)
    s.combat.loot.collect(s.state)
    assert shard.active and not s.state.twin.corrupted

    # The twin touching it is what matters.
    s.state.twin.position = shard.position.copy()
    s.combat.loot.collect(s.state)
    assert not shard.active
    assert s.state.twin.corrupted
    assert events(s, "TWIN_CORRUPTED")


def test_only_one_shard_is_ever_dropped():
    s = GameSession("one-shard", seed=5, record=False, start_area="ashen_deep")
    wake_twin(s)
    for _ in range(2):
        warden = s.state.spawn_enemy("warden", s.state.player.position + Vec2(180, 0))
        s.combat.damage_enemy(s.state, warden, 10_000, s.state.player.id, [], Vec2(), 0, "test")
    assert len([p for p in s.state.pickups if p.kind == "mirror_shard"]) == 1


def test_the_twin_drops_everything_to_go_and_get_it():
    """The rush is scripted, so it must beat whatever the controller wanted."""
    s = GameSession("rush", seed=5, record=False, start_area="ashen_deep")
    wake_twin(s)
    twin = s.state.twin
    twin.position = s.state.player.position.copy()
    where = s.state.room.clamp(s.state.player.position + Vec2(260, 0), 20)
    s.state.spawn_pickup("mirror_shard", where).ttl = 0.0

    before = (twin.position - where).length()
    run_ticks(s, 40)
    assert (twin.position - where).length() < before, "it moved toward the shard"
    assert twin.intent.intent_type == "EXPLORE"

    run_ticks(s, 240)
    assert twin.corrupted, "and reached it"


# --- the scene ---------------------------------------------------------------

def test_walking_in_starts_the_scene_rather_than_taking_the_twin():
    s = sanctum()
    s._enter_room(boss_room(s), from_side="south")
    assert s.cutscene is not None
    assert not s.state.twin.dormant, "the twin is still there while the scene opens"
    assert events(s, "CUTSCENE_BEGIN")
    assert "cutscene" in s.snapshot()


def test_the_scene_plays_its_beats_in_order_and_ends():
    s = sanctum("beats")
    s._enter_room(boss_room(s), from_side="south")
    seen = []
    while s.cutscene is not None:
        beat = s.cutscene.beat.name
        if not seen or seen[-1] != beat:
            seen.append(beat)
        s.step(DT)
    assert seen == [b.name for b in BEATS]
    assert events(s, "CUTSCENE_END")


def test_the_twin_walks_to_the_centre_and_the_red_goes_out_before_it_hatches():
    s = sanctum("walk")
    room = boss_room(s)
    s._enter_room(room, from_side="south")
    s.state.twin.corrupted = True
    s.state.twin.position = Vec2(120, 120)
    centre = Vec2(room.width / 2, room.height / 2)

    # Play up to the moment the red goes out.
    while s.cutscene is not None and s.cutscene.beat.name != "cleanse":
        s.step(DT)
    assert (s.state.twin.position - centre).length() <= s.CENTRE_TOLERANCE, \
        "it arrives under its own power"
    assert not s.state.twin.corrupted, "the shard is finished with it"
    assert events(s, "TWIN_CLEANSED")
    assert not s.state.twin.dormant, "and it is still itself at this point"

    play_cutscene(s)
    assert s.state.twin.dormant
    assert "twin_taken" in s.campaign.flags


def test_the_mirror_speaks_with_the_names_the_player_chose():
    s = sanctum("lines")
    s.campaign.player_name = "Wren"
    s.campaign.twin_name = "Ash"
    s._enter_room(boss_room(s), from_side="south")
    play_cutscene(s)
    spoken = [e.data["text"] for e in events(s, "CUTSCENE_LINE")]
    assert len(spoken) == len(LINES)
    assert any("Wren" in line for line in spoken)
    assert any("Ash" in line for line in spoken)
    assert not any("{" in line for line in spoken), "every placeholder is filled"


def test_nothing_else_moves_while_the_scene_runs():
    """A boss that can hit you during its own entrance is not an entrance."""
    s = sanctum("frozen")
    s._enter_room(boss_room(s), from_side="south")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    boss_at = boss.position.copy()
    health = s.state.player.health

    from mirrorbound.game.entities.player import PlayerInput
    for _ in range(120):
        s.pending_input = PlayerInput(move_x=1.0, attack=True)
        s.step(DT)

    assert (boss.position - boss_at).length() < 1e-6, "the Mirror waits"
    assert s.state.player.health == health
    assert not events(s, "PLAYER_ATTACKED"), "input is dropped, not queued"


def test_the_scene_plays_once_even_if_the_room_is_re_entered():
    s = sanctum("once")
    room = boss_room(s)
    s._enter_room(room, from_side="south")
    play_cutscene(s)
    s._enter_room(room, from_side="south")
    assert s.cutscene is None
    assert len(events(s, "TWIN_TAKEN")) == 1


def test_the_shell_has_time_to_finish_before_the_mirror_speaks():
    """The boss was talking from inside an unopened egg.

    The client plays sixteen drawn frames across two sheets for the hatch --
    `Hatch.HATCH_SECONDS`, 4.83 seconds including the held breath before the
    crack and the beat on the reveal -- and hides the real boss for all of it.
    The beat was 2.6, so the scene moved on to the first line with the shell
    still closed and the Mirror still invisible.
    """
    from mirrorbound.game.world.cutscene import BEATS

    hatch = next(b for b in BEATS if b.name == "hatch")
    assert hatch.seconds >= 4.83, "the shell is still closing when this beat ends"


def test_the_boss_is_moved_to_where_the_shell_opens():
    """One creature becoming another, not two creatures in two places.

    The room's spawn table puts the Mirror at (0.50, 0.34) and the twin walks
    to the centre, so the shell used to crack open about two hundred units away
    from the boss it was revealing.
    """
    s = sanctum("hatch_place")
    s._enter_room(boss_room(s), from_side="south")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    started = boss.position.copy()
    play_cutscene(s)
    assert (boss.position - s.state.twin.position).length() < 1.0
    assert (boss.position - started).length() > 100, "it was already there; the test proves nothing"
