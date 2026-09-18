"""The doc's own section-18 example, through the full pipeline: the room has a
spot where the player keeps fighting and a different spot where they keep
retreating to, and the heatmap should say so.
"""

from __future__ import annotations

import pytest

from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.game.core.events import Event

FIGHT_SPOT = (10.0, 10.0)
RETREAT_SPOT = (40.0, 40.0)


def attack_at(tick: int, pos: tuple[float, float]) -> Event:
    return Event(
        tick=tick,
        type="PLAYER_ATTACKED",
        data={"tags": ["MELEE"], "position": list(pos)},
    )


def retreat_at(tick: int, pos: tuple[float, float]) -> Event:
    return Event(tick=tick, type="PLAYER_RETREATED", data={"position": list(pos)})


def test_combat_and_retreat_hotspots_emerge_at_different_locations():
    pipeline = PlayerModelPipeline()
    tick = 1
    for _ in range(8):
        pipeline.ingest(attack_at(tick, FIGHT_SPOT))
        tick += 1
        pipeline.ingest(retreat_at(tick, RETREAT_SPOT))
        tick += 1

    snapshot = pipeline.snapshot()

    combat_top_cell = snapshot.spatial["combat"][0]["cell"]
    retreat_top_cell = snapshot.spatial["retreat"][0]["cell"]
    expected_fight_cell = list(pipeline.spatial.layers["combat"].cell_of(*FIGHT_SPOT))
    expected_retreat_cell = list(pipeline.spatial.layers["retreat"].cell_of(*RETREAT_SPOT))

    # 8 reps each, with the pipeline's real (non-infinite) default decay applied
    # over the ~16 elapsed ticks between the first and last observation — expect
    # very close to 8.0, not exactly, since a little decay has already happened.
    assert combat_top_cell == expected_fight_cell
    assert snapshot.spatial["combat"][0]["weight"] == pytest.approx(8.0, rel=0.01)
    assert retreat_top_cell == expected_retreat_cell
    assert snapshot.spatial["retreat"][0]["weight"] == pytest.approx(8.0, rel=0.01)
    # melee is a sub-layer of combat here (every attack was MELEE-tagged).
    assert snapshot.spatial["melee"][0]["cell"] == expected_fight_cell


def test_identical_spatial_replay_produces_an_identical_snapshot():
    events = []
    tick = 1
    for _ in range(5):
        events.append(attack_at(tick, FIGHT_SPOT))
        tick += 1
        events.append(retreat_at(tick, RETREAT_SPOT))
        tick += 1

    pipeline_a = PlayerModelPipeline()
    pipeline_b = PlayerModelPipeline()
    for event in events:
        pipeline_a.ingest(event)
    for event in events:
        pipeline_b.ingest(event)

    assert pipeline_a.snapshot().to_json_dict() == pipeline_b.snapshot().to_json_dict()
