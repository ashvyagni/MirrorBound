"""Named save slots: listing, loading, deleting and resetting.

Every test points `SAVE_DIR` at a tmp directory. Without that these would
write into the repository's own `saves/` and a test run would quietly stand on
the developer's checkpoints.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.world import save as save_system


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")
    return tmp_path


def session(session_id: str = "profile", **kwargs) -> GameSession:
    kwargs.setdefault("record", False)
    return GameSession(session_id, seed=7, **kwargs)


def apply(s: GameSession, action: str, **fields) -> None:
    from mirrorbound.contracts.messages import CommandMessage
    s.pending_commands.append(CommandMessage(action=action, **fields))
    s._apply_commands()


def test_save_as_makes_a_named_slot_without_touching_the_autosave():
    # Opening in a village already wrote `auto`: the village *is* the
    # checkpoint, so a session in one has an autosave before anything else.
    s = session()
    apply(s, "SAVE_AS", saveName="Before the crypt")

    slots = {entry["id"]: entry for entry in save_system.list_saves("profile")}
    assert set(slots) == {"auto", "slot-1"}
    assert slots["slot-1"]["name"] == "Before the crypt"
    assert slots["auto"]["auto"] is True and slots["slot-1"]["auto"] is False
    # The run continues in the slot it just made.
    assert s.slot == "slot-1"


def test_autosave_into_a_named_slot_keeps_its_name():
    """A village checkpoint must not rename the save the player made."""
    s = session()
    apply(s, "SAVE_AS", saveName="Deep run")
    s._checkpoint()
    named = [e for e in save_system.list_saves("profile") if e["id"] == "slot-1"]
    assert named and named[0]["name"] == "Deep run"


def test_loading_a_slot_restores_its_progress():
    s = session()
    s.state.player.level = 9
    s.state.player.inventory.gold = 250
    apply(s, "SAVE_AS", saveName="Rich")

    # Play on, and autosave the poorer state into a different slot.
    s.slot = save_system.AUTO_SLOT
    s.state.player.level = 2
    s.state.player.inventory.gold = 5
    s._checkpoint()

    apply(s, "LOAD_SAVE", saveId="slot-1")
    assert s.state.player.level == 9
    assert s.state.player.inventory.gold == 250


def test_deleting_the_played_slot_falls_back_to_the_autosave():
    s = session()
    apply(s, "SAVE_AS", saveName="Temporary")
    assert s.slot == "slot-1"
    apply(s, "DELETE_SAVE", saveId="slot-1")
    assert [e["id"] for e in save_system.list_saves("profile")] == ["auto"]
    assert s.slot == save_system.AUTO_SLOT


def test_reset_clears_every_slot_and_starts_the_campaign_over():
    s = session()
    s.state.player.level = 12
    apply(s, "SAVE_AS", saveName="One")
    s.slot = save_system.AUTO_SLOT
    apply(s, "SAVE_AS", saveName="Two")
    assert {e["id"] for e in save_system.list_saves("profile")} == {"auto", "slot-1", "slot-2"}

    apply(s, "RESET_DATA")
    # Every named slot is gone. `auto` is back because the reset run opens in a
    # village, and a village is a checkpoint -- but it is a level-1 one.
    remaining = save_system.list_saves("profile")
    assert [e["id"] for e in remaining] == ["auto"]
    assert remaining[0]["level"] == 1
    assert s.state.player.level == 1
    assert s.slot == save_system.AUTO_SLOT
    # And nothing is left behind to resume from.
    assert save_system.read_active_slot("profile") == save_system.AUTO_SLOT


def test_slot_count_is_capped():
    s = session()
    for _ in range(save_system.MAX_SLOTS):
        s.slot = save_system.AUTO_SLOT
        apply(s, "SAVE_AS", saveName="x")
    assert save_system.new_slot_id("profile") is None
    s.state.pending_events.clear()
    s.slot = save_system.AUTO_SLOT
    apply(s, "SAVE_AS", saveName="one too many")
    rejected = [e for e in s.state.pending_events if e.type == "ACTION_REJECTED"]
    assert rejected and rejected[0].data["action"] == "SAVE_AS"


def test_the_last_played_slot_is_what_a_reconnect_resumes():
    s = session()
    s.state.player.level = 6
    apply(s, "SAVE_AS", saveName="Continue me")
    assert save_system.read_active_slot("profile") == "slot-1"

    # A reconnect builds a fresh session the way the endpoint does.
    resumed = session(load_save=True, slot=save_system.read_active_slot("profile"))
    assert resumed.state.player.level == 6


def test_a_pointer_at_a_deleted_slot_falls_back_rather_than_failing():
    s = session()
    apply(s, "SAVE_AS", saveName="Gone")
    save_system.delete_save("profile", "slot-1")
    assert save_system.read_active_slot("profile") == save_system.AUTO_SLOT


def test_a_pre_slot_save_is_still_readable_as_the_autosave():
    """Saves written before slots existed sat at `saves/<profile>.json`.

    Written for a profile that has never had a session, because opening one
    writes `auto` in the new layout and would mask the file under test.
    """
    import json
    source = session("scratch")
    source.state.player.level = 4
    legacy = save_system.legacy_path("old")
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text(json.dumps(save_system.build_save(
        "old", source.campaign, source.state.player, source.state.twin)), encoding="utf-8")

    assert [e["id"] for e in save_system.list_saves("old")] == ["auto"]
    resumed = session("old", load_save=True)
    assert resumed.state.player.level == 4
