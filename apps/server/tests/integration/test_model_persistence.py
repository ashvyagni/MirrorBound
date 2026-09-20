"""What a save remembers about the player, and what it deliberately forgets.

The twin learns from how you play. If that lived outside the save file, coming
back to a slot would hand you a twin that had never met you, and two slots would
share one twin. These pin that it belongs to the slot it was learned in.
"""

from __future__ import annotations

import pytest

from mirrorbound.agent.persistence import (
    MODEL_VERSION, dump_player_model, dump_twin_style, load_player_model, load_twin_style,
)
from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.api.session import GameSession
from mirrorbound.contracts.messages import CommandMessage
from mirrorbound.game.world import save as save_system
from tests.conftest import DT


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def session(name: str = "learn", **kwargs) -> GameSession:
    kwargs.setdefault("record", False)
    return GameSession(name, seed=5, **kwargs)


def apply(s: GameSession, action: str, **fields) -> None:
    s.pending_commands.append(CommandMessage(action=action, **fields))
    s._apply_commands()


def teach(s: GameSession, token: str = "SWORD_STRIKE", times: int = 80) -> None:
    """Play in one recognisable way, so there is something to have learned."""
    for _ in range(times):
        s.state.emit("PLAYER_ATTACKED", action_token=token, actor=s.state.player.id,
                     tags=["MELEE"], weapon="iron_sword", comboStep=1,
                     position=s.state.player.position.to_dict(), hitCount=1)
        s.step(DT)


# --- the round trip ------------------------------------------------------------

def test_a_slot_remembers_the_twin_that_was_trained_in_it():
    s = session()
    teach(s)
    traits_before = s.pipeline.traits.snapshot()
    dims_before = {k: v["samples"] for k, v in s.style.snapshot()["dims"].items()}
    assert sum(dims_before.values()) > 0, "the twin watched some of that"

    apply(s, "SAVE_AS", saveName="Trained")
    apply(s, "LOAD_SAVE", saveId="slot-1")

    traits_after = s.pipeline.traits.snapshot()
    assert traits_after["melee_dependency"]["samples"] > 0, "it came back knowing something"
    assert traits_after["melee_dependency"]["samples"] == traits_before["melee_dependency"]["samples"]
    assert traits_after["melee_dependency"]["value"] == pytest.approx(
        traits_before["melee_dependency"]["value"], abs=1e-4)

    dims_after = {k: v["samples"] for k, v in s.style.snapshot()["dims"].items()}
    assert dims_after == dims_before, "and the twin came back with it too"


def test_two_slots_do_not_share_a_twin():
    """The whole point of per-slot: a trained save and a fresh one stay apart."""
    s = session("two")
    # Slot 1: taught to death.
    teach(s, times=120)
    apply(s, "SAVE_AS", saveName="Trained")
    trained = s.pipeline.traits.snapshot()["melee_dependency"]["samples"]
    assert trained > 0

    # Slot 2 is written from a world that has learned nothing.
    s.slot = save_system.AUTO_SLOT
    s.load_save = False
    s.restart()
    apply(s, "SAVE_AS", saveName="Blank")

    apply(s, "LOAD_SAVE", saveId="slot-2")
    assert s.pipeline.traits.snapshot()["melee_dependency"]["samples"] == 0

    apply(s, "LOAD_SAVE", saveId="slot-1")
    assert s.pipeline.traits.snapshot()["melee_dependency"]["samples"] == trained


def test_deleting_a_save_deletes_the_twin_trained_in_it():
    s = session("gone")
    teach(s)
    apply(s, "SAVE_AS", saveName="Doomed")
    apply(s, "DELETE_SAVE", saveId="slot-1")
    assert save_system.read_save("gone", "slot-1") is None


def test_resetting_everything_leaves_nothing_learned():
    s = session("wipe")
    teach(s)
    apply(s, "SAVE_AS", saveName="Before")
    apply(s, "RESET_DATA")
    assert s.pipeline.traits.snapshot()["melee_dependency"]["samples"] == 0
    assert save_system.list_saves("wipe") == [
        e for e in save_system.list_saves("wipe") if e["id"] == "auto"
    ]


# --- the format ----------------------------------------------------------------

def test_ticks_are_rebased_so_a_reloaded_model_still_decays():
    """A stored tick from a finished run would sit in the future forever.

    Weights are decayed at save time and written as though they all arrived at
    tick zero, which is where the next session starts counting.
    """
    pipeline = PlayerModelPipeline()
    for i in range(30):
        pipeline.predictor.observe("SWORD_STRIKE", tick=50_000 + i)

    dumped = dump_player_model(pipeline, tick=50_030)
    fresh = PlayerModelPipeline()
    assert load_player_model(fresh, dumped)

    for model in fresh.predictor._models.values():
        for row in model._table.values():
            for entry in row.values():
                assert entry.last_tick == 0
    assert fresh.predictor.tick == 0


def test_a_model_from_another_version_loads_as_a_blank_one():
    """Half-reading a model is worse than an honest blank: it is wrong quietly."""
    pipeline = PlayerModelPipeline()
    pipeline.traits.observe("aggression", 1.0)
    dumped = dump_player_model(pipeline, tick=10)
    dumped["version"] = MODEL_VERSION + 1

    fresh = PlayerModelPipeline()
    assert not load_player_model(fresh, dumped)
    assert fresh.traits.snapshot()["aggression"]["samples"] == 0


def test_a_corrupt_model_does_not_crash_the_session():
    pipeline = PlayerModelPipeline()
    assert not load_player_model(pipeline, None)
    # A field that should be a table and is a string loads as nothing.
    assert load_player_model(pipeline, {"version": MODEL_VERSION, "traits": "nonsense"})
    assert pipeline.traits.snapshot()["aggression"]["samples"] == 0
    # Rows of the wrong shape are skipped rather than raising.
    assert load_player_model(pipeline, {
        "version": MODEL_VERSION,
        "traits": {"aggression": {"value": "x", "samples": -5}},
        "orders": {"1": [{"context": ["A", "B"], "token": "C", "weight": 2}], "9": "junk"},
        "history": ["A"],
    })
    assert pipeline.traits.snapshot()["aggression"]["samples"] == 0
    # The order-1 model must not have taken a two-token context.
    assert pipeline.predictor._models[1]._table == {}


def test_the_twin_style_round_trips():
    style = TwinStyleModel()
    for i in range(40):
        style.get("aggression").update(0.9, 0.1, tick=i)
    style.lessons.append("you swing first")
    dumped = dump_twin_style(style)

    fresh = TwinStyleModel()
    assert load_twin_style(fresh, dumped)
    assert fresh.get("aggression").samples == style.get("aggression").samples
    assert fresh.get("aggression").value == pytest.approx(style.get("aggression").value, abs=1e-4)
    assert list(fresh.lessons) == ["you swing first"]
    assert fresh.get("aggression").last_sample_tick == 0


def test_an_old_save_with_no_agent_block_still_loads():
    """Saves written before the model was carried must not break."""
    s = session("legacy")
    s._checkpoint()
    data = save_system.read_save("legacy")
    data.pop("agent", None)
    save_system.write_save("legacy", data)

    resumed = session("legacy", load_save=True)
    assert resumed.pipeline.traits.snapshot()["melee_dependency"]["samples"] == 0
