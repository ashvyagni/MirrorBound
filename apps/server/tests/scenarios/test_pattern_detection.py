"""Pattern detection through the full pipeline: a repeated combo should surface
as a DETECTED pattern in the snapshot, and a strategy change should replace it
with a LOST + a new DETECTED — matching the doc's section 34 HUD example
("NEW PATTERN DETECTED: RETREAT -> SPELL -> DODGE").
"""

from __future__ import annotations

from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.game.core.events import Event


def dash_event(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_DASHED", data={"distance": 5.0})


def fire_event(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ABILITY_CAST", data={"ability": "FIRE", "tags": ["RANGED"]})


def retreat_event(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_RETREATED")


def feed(pipeline: PlayerModelPipeline, tokens_as_events, start_tick: int) -> int:
    tick = start_tick
    for make_event in tokens_as_events:
        pipeline.ingest(make_event(tick))
        tick += 1
    return tick


def test_repeated_combo_surfaces_as_a_detected_pattern_in_the_snapshot():
    pipeline = PlayerModelPipeline(
        max_order=1, half_life_seconds=float("inf"), pattern_detection_threshold=0.7
    )
    feed(pipeline, [dash_event, fire_event] * 20, 1)

    snapshot = pipeline.snapshot()
    detected_sequences = [tuple(p.sequence) for p in pipeline.pattern_detector.snapshot()]
    assert ("DASH", "FIRE") in detected_sequences

    exported = snapshot.to_json_dict()
    assert any(p["sequence"] == ["DASH", "FIRE"] for p in exported["patterns"])
    assert any(
        e["kind"] == "DETECTED" and e["pattern"]["sequence"] == ["DASH", "FIRE"]
        for e in exported["pattern_events"]
    )


def test_strategy_change_emits_lost_then_a_new_detected_pattern():
    pipeline = PlayerModelPipeline(
        max_order=1, half_life_seconds=float("inf"), pattern_detection_threshold=0.7
    )
    tick = feed(pipeline, [dash_event, fire_event] * 15, 1)
    assert ("DASH", "FIRE") in [
        tuple(p.sequence) for p in pipeline.pattern_detector.snapshot()
    ]

    feed(pipeline, [dash_event, retreat_event] * 60, tick)

    active_sequences = [tuple(p.sequence) for p in pipeline.pattern_detector.snapshot()]
    assert ("DASH", "FIRE") not in active_sequences
    assert ("DASH", "RETREAT") in active_sequences

    kinds_for_dash_context = [
        (e.kind, e.pattern.next_token)
        for e in pipeline.pattern_detector.recent_events()
        if e.pattern.context == ("DASH",)
    ]
    assert ("DETECTED", "FIRE") in kinds_for_dash_context
    assert ("LOST", "FIRE") in kinds_for_dash_context
    assert ("DETECTED", "RETREAT") in kinds_for_dash_context


def test_identical_replay_produces_an_identical_pattern_snapshot():
    events = [dash_event, fire_event] * 10 + [dash_event, retreat_event] * 10

    pipeline_a = PlayerModelPipeline(max_order=1, half_life_seconds=float("inf"))
    pipeline_b = PlayerModelPipeline(max_order=1, half_life_seconds=float("inf"))
    feed(pipeline_a, events, 1)
    feed(pipeline_b, events, 1)

    assert pipeline_a.snapshot().to_json_dict() == pipeline_b.snapshot().to_json_dict()
