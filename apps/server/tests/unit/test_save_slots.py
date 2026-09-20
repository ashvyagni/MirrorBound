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


# --- starting over -----------------------------------------------------------
#
# Reported from play: "i cant make a completely brand new save which i can load
# into and set name and everything." There was no route to one. Every way of
# creating a slot went through SAVE_AS, which *copies* the run you are in -- so
# a new save arrived already carrying your level, your gear, how far through the
# campaign you were, and what the twin had learned about you. The only path to a
# blank campaign was RESET_DATA, which deletes every save you own.


def test_a_new_save_starts_from_nothing_rather_than_copying_the_run():
    s = session("newsave")
    s.campaign.player_name = "Someone"
    s.state.player.level = 7
    s.state.player.inventory.add_weapon("ember_staff")
    s.campaign.complete("hollow_reach")

    apply(s, "NEW_SAVE", saveName="Second")

    assert s.campaign.player_name == "Second", "the name typed for the new run was not taken"
    assert s.state.player.level == 1, "it inherited the old run's level"
    assert "ember_staff" not in s.state.player.inventory.weapons, "it inherited the old gear"
    assert not s.campaign.completed_areas, "it inherited the old progress"


def test_a_new_save_gets_its_own_slot_and_leaves_the_old_one_alone():
    s = session("newslot")
    s.state.player.level = 9
    apply(s, "SAVE_AS", saveName="First")
    first = s.slot
    apply(s, "NEW_SAVE", saveName="Second")

    assert s.slot != first, "it wrote over the save it was started from"
    kept = save_system.read_save(s.session_id, first)
    assert kept is not None and kept["player"]["level"] == 9, "the old run was not preserved"


def test_a_new_save_exists_on_disk_immediately():
    """A save that only appears after the first village reads as a failure."""
    s = session("newdisk")
    apply(s, "NEW_SAVE", saveName="Third")
    assert save_system.read_save(s.session_id, s.slot) is not None
    assert any(row["id"] == s.slot for row in save_system.list_saves(s.session_id))


def test_a_new_save_forgets_what_the_twin_had_learned():
    """The one thing a fresh character must not inherit.

    Run the session long enough that the model has an opinion, then start over
    and check the opinion did not come with it.
    """
    s = session("newmodel")
    for _ in range(240):
        s.step(1 / 60)
    before = s.snapshot()["playerModel"]["traits"]
    assert before, "nothing was learned, so this proves nothing"

    apply(s, "NEW_SAVE", saveName="Fourth")
    after = s.snapshot()["playerModel"]["traits"]
    assert all(t["confidence"] == 0.0 for t in after.values()), after


def test_the_profile_still_has_a_ceiling():
    s = session("newfull")
    for _ in range(save_system.MAX_SLOTS + 2):
        apply(s, "NEW_SAVE", saveName="x")
    rows = [r for r in save_system.list_saves(s.session_id) if r["id"] != save_system.AUTO_SLOT]
    assert len(rows) <= save_system.MAX_SLOTS
