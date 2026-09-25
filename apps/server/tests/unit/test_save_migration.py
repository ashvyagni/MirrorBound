"""Old saves are upgraded, not thrown away.

`read_save` used to compare the stored version against `SAVE_VERSION` and
return None on any mismatch. The session reads None as "no save" and answers by
starting a fresh campaign, so bumping the version would have silently deleted
every run on disk -- and v1.1 adds fields to the save shape, so the version has
to move.

What these tests hold onto is the distinction that makes the difference: an
*older* save is readable, and an unreadable one is only ever a save with no
version, a version from the future, or a version with no route forward.
"""

from __future__ import annotations

import json

import pytest

from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.save import SAVE_VERSION, migrate


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def v1_save() -> dict:
    """A checkpoint in the shape the 0.1.0 build wrote."""
    return {
        "version": 1,
        "sessionId": "old-run",
        "name": "Halfway",
        "savedAt": 1_700_000_000.0,
        "summary": {"area": "emberfall", "level": 6, "gold": 410},
        "campaign": {
            "playerName": "Rell",
            "twinName": "Ash",
            "currentArea": "emberfall",
            "completedAreas": ["wakewood_crypt"],
            "discoveredAreas": ["hollow_reach", "wakewood_crypt", "emberfall"],
            "lootedRooms": ["wakewood_crypt_room_3"],
            "flags": ["quest_active", "twin_rescued"],
            "seals": ["seal_of_waking"],
            "twinRescued": True,
            "twinNamed": True,
        },
        "player": {
            "level": 6, "xp": 120, "skillPoints": 2,
            "unlockedSkills": ["keen_edge", "heavy_hands"],
            "weapons": ["iron_sword", "hunter_bow"],
            "equippedWeapon": "iron_sword", "offhandWeapon": "hunter_bow",
            "consumables": {"health_potion": 3}, "resources": {"essence": 40, "shards": 5},
            "relics": ["wolf_fang"], "gold": 410,
        },
        "twin": {"weapons": ["frost_staff"], "equippedWeapon": "frost_staff", "offhandWeapon": ""},
        "agent": {"playerModel": {"traits": {}}, "twinStyle": {}},
    }


# --- the upgrade path --------------------------------------------------------

def test_a_v1_save_is_upgraded_rather_than_discarded():
    upgraded = migrate(v1_save())
    assert upgraded is not None, "an older save is readable; that is the whole point"
    assert upgraded["version"] == SAVE_VERSION


def test_upgrading_keeps_every_bit_of_progression():
    """Migration adds defaults. It must never drop what the player earned."""
    upgraded = migrate(v1_save())
    assert upgraded is not None
    assert upgraded["player"]["level"] == 6
    assert upgraded["player"]["gold"] == 410
    assert upgraded["player"]["unlockedSkills"] == ["keen_edge", "heavy_hands"]
    assert upgraded["player"]["weapons"] == ["iron_sword", "hunter_bow"]
    assert upgraded["campaign"]["completedAreas"] == ["wakewood_crypt"]
    # The villages became settlements inside regions, so a v1 save's area names
    # are remapped rather than filtered out as unknown.
    assert upgraded["campaign"]["currentArea"] == "emberfall_basin"
    assert upgraded["campaign"]["discoveredAreas"] == [
        "emberfall_basin", "hollowreach_vale", "wakewood_crypt"]
    assert upgraded["campaign"]["seals"] == ["seal_of_waking"]
    assert upgraded["campaign"]["twinRescued"] is True
    # What the twin learned rides along untouched -- `save.py` never reads into it.
    assert upgraded["agent"]["playerModel"] == {"traits": {}}


def test_a_current_save_passes_through_unchanged():
    current = v1_save() | {"version": SAVE_VERSION}
    assert migrate(dict(current)) == current


def test_migration_is_idempotent():
    once = migrate(v1_save())
    assert once is not None
    assert migrate(dict(once)) == once


def test_a_v1_save_with_no_campaign_block_gains_one():
    """v1 wrote the block, but a hand-edited or truncated file might not.

    `CampaignState.from_save` fills absent keys, so the guarantee migration owes
    it is that the block exists and is a dict -- not that it is populated.
    """
    broken = v1_save()
    broken.pop("campaign")
    upgraded = migrate(broken)
    assert upgraded is not None
    assert upgraded["campaign"] == {}

    wrong_type = v1_save() | {"campaign": ["not", "a", "dict"]}
    upgraded = migrate(wrong_type)
    assert upgraded is not None
    assert upgraded["campaign"] == {}


# --- what genuinely cannot be read ------------------------------------------

@pytest.mark.parametrize("version", [None, "1", 0, -3, 1.5])
def test_a_save_with_no_usable_version_is_refused(version):
    assert migrate(v1_save() | {"version": version}) is None


def test_a_save_from_a_newer_build_is_refused_rather_than_guessed_at():
    """Forward compatibility is a promise this build cannot keep.

    Loading fields it has never heard of would corrupt the run more thoroughly
    than refusing to open it, and the player still has the file.
    """
    assert migrate(v1_save() | {"version": SAVE_VERSION + 1}) is None


def test_a_version_with_no_route_forward_is_refused(monkeypatch):
    """A gap in the chain is a bug, and it must fail closed.

    With `_MIGRATIONS` emptied there is no way from v1 to the current version,
    so the save is refused instead of being handed over half-upgraded.
    """
    monkeypatch.setattr(save_system, "_MIGRATIONS", {})
    assert save_system.migrate(v1_save()) is None


# --- through the real read path ---------------------------------------------

def test_read_save_upgrades_a_v1_file_on_disk():
    path = save_system.save_path("old-run", save_system.AUTO_SLOT)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(v1_save()), encoding="utf-8")

    loaded = save_system.read_save("old-run")
    assert loaded is not None, "a v1 file on disk still opens"
    assert loaded["version"] == SAVE_VERSION
    assert loaded["player"]["level"] == 6


def test_read_save_still_refuses_a_file_that_is_not_a_save():
    path = save_system.save_path("junk", save_system.AUTO_SLOT)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('["this is a list"]', encoding="utf-8")
    assert save_system.read_save("junk") is None


def test_a_v1_save_still_loads_a_playable_run(monkeypatch):
    """The end-to-end promise: an old checkpoint resumes where it left off.

    Written as v1 and opened by a session, which is what a player upgrading
    their build actually does.
    """
    from mirrorbound.api.session import GameSession

    path = save_system.save_path("resume", save_system.AUTO_SLOT)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(v1_save()), encoding="utf-8")

    session = GameSession("resume", seed=5, record=False, load_save=True)
    assert session.campaign.current_area == "emberfall_basin", (
        "a v1 save said 'emberfall'; the run resumes in the region that village is in")
    assert session.campaign.player_name == "Rell"
    assert session.state.player.level == 6
    assert session.state.player.inventory.gold == 410
    assert "wakewood_crypt" in session.campaign.completed_areas
    assert not session.state.twin.dormant, "the twin was already found in that run"
