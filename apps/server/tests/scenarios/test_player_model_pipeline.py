"""Scripted scenarios exercising the full telemetry -> features -> player model ->
prediction pipeline end to end, through real Event objects rather than calling
SequencePredictor/PlayerTraitModel directly (see tests/unit for those).
"""

from __future__ import annotations

from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.game.core.events import Event


def dash_event(tick: int) -> Event:
    # 190 world units is Shadow Dash's real distance (see game/combat/abilities.py).
    return Event(tick=tick, type="PLAYER_DASHED", data={"tags": ["MOBILITY"], "distance": 190.0})


def fire_event(tick: int) -> Event:
    return Event(
        tick=tick, type="PLAYER_ABILITY_CAST", data={"ability": "FIRE", "tags": ["RANGED", "BURST"]}
    )


def aerial_attack_event(tick: int) -> Event:
    return Event(
        tick=tick,
        type="PLAYER_ATTACKED",
        data={"action_token": "AERIAL_ATTACK", "tags": ["MELEE", "AOE"]},
    )


def melee_strike_event(tick: int) -> Event:
    return Event(
        tick=tick,
        type="PLAYER_ATTACKED",
        data={"action_token": "MELEE_STRIKE", "tags": ["MELEE"]},
    )


def retreat_event(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_RETREATED", data={"tags": ["DEFENSIVE"]})


def ice_bolt_event(tick: int) -> Event:
    return Event(
        tick=tick,
        type="PLAYER_ABILITY_CAST",
        data={"ability": "ICE_BOLT", "tags": ["RANGED", "DEFENSIVE"]},
    )


def feed(pipeline: PlayerModelPipeline, events: list[Event]) -> None:
    for event in events:
        pipeline.ingest(event)


def combo_events(start_tick: int, reps: int) -> tuple[list[Event], int]:
    """`reps` repetitions of DASH -> FIRE -> AERIAL_ATTACK, one tick apart.
    Returns the events and the next free tick.
    """
    events = []
    tick = start_tick
    for _ in range(reps):
        events += [dash_event(tick), fire_event(tick + 1), aerial_attack_event(tick + 2)]
        tick += 3
    return events, tick


def strategy_change_events(start_tick: int, reps_per_phase: int) -> tuple[list[Event], int]:
    """Aggressive melee (DASH -> MELEE_STRIKE) for reps_per_phase reps, then a
    switch to defensive ranged (RETREAT -> ICE_BOLT) for reps_per_phase more.
    Returns the events and the next free tick.
    """
    events = []
    tick = start_tick
    for _ in range(reps_per_phase):
        events += [dash_event(tick), melee_strike_event(tick + 1)]
        tick += 2
    for _ in range(reps_per_phase):
        events += [retreat_event(tick), ice_bolt_event(tick + 1)]
        tick += 2
    return events, tick


def test_repeated_pattern_learning():
    # max_order=2 isolates the DASH,FIRE -> AERIAL_ATTACK bigram-context prediction
    # from order-3 backoff, which would also be internally consistent on a purely
    # periodic 3-step combo and could win instead — see test_predictor.py's own
    # note on this for the underlying reason.
    pipeline = PlayerModelPipeline(max_order=2)
    events, tick = combo_events(start_tick=1, reps=15)
    feed(pipeline, events)

    # Prime the context to (DASH, FIRE) and ask what's next.
    feed(pipeline, [dash_event(tick), fire_event(tick + 1)])

    snapshot = pipeline.snapshot()
    assert snapshot.predictions
    top = snapshot.predictions[0]
    assert top.token == "AERIAL_ATTACK"
    assert top.confidence > 0.6
    assert top.order == 2

    # Traits picked up the combo's combat content too, not just the sequence.
    assert snapshot.traits["mobility"]["value"] > 0.9  # from the repeated full-length DASH
    # The combo alternates a RANGED FIRE with a MELEE AERIAL_ATTACK every cycle, so
    # melee/ranged dependency should land roughly balanced, not near either extreme.
    assert 0.35 < snapshot.traits["melee_dependency"]["value"] < 0.65
    assert 0.35 < snapshot.traits["ranged_dependency"]["value"] < 0.65


def test_adaptation_after_strategy_change():
    pipeline = PlayerModelPipeline()
    events, tick = strategy_change_events(start_tick=1, reps_per_phase=15)
    melee_phase_events = events[:30]
    ranged_phase_events = events[30:]

    feed(pipeline, melee_phase_events)
    feed(pipeline, [dash_event(tick)])  # prime: "what follows DASH?"
    melee_snapshot = pipeline.snapshot()

    assert melee_snapshot.predictions[0].token == "MELEE_STRIKE"
    assert melee_snapshot.traits["aggression"]["value"] > 0.7
    assert melee_snapshot.traits["melee_dependency"]["value"] > 0.7
    assert melee_snapshot.traits["ranged_dependency"]["value"] < 0.3

    tick += 1
    feed(pipeline, ranged_phase_events)
    feed(pipeline, [retreat_event(tick + len(ranged_phase_events))])  # "what follows RETREAT?"
    ranged_snapshot = pipeline.snapshot()

    assert ranged_snapshot.predictions[0].token == "ICE_BOLT"
    # Aggression and melee dependency should have swung down; ranged dependency up.
    assert ranged_snapshot.traits["aggression"]["value"] < melee_snapshot.traits["aggression"]["value"]
    assert ranged_snapshot.traits["aggression"]["value"] < 0.4
    assert ranged_snapshot.traits["melee_dependency"]["value"] < 0.3
    assert ranged_snapshot.traits["ranged_dependency"]["value"] > 0.7


def test_identical_tick_stamped_replay_produces_an_identical_snapshot():
    events, _tick = strategy_change_events(start_tick=1, reps_per_phase=10)

    pipeline_a = PlayerModelPipeline()
    pipeline_b = PlayerModelPipeline()
    feed(pipeline_a, events)
    feed(pipeline_b, events)

    assert pipeline_a.snapshot().to_json_dict() == pipeline_b.snapshot().to_json_dict()


def test_different_tick_stamped_replay_diverges():
    events_a, _ = strategy_change_events(start_tick=1, reps_per_phase=10)
    events_b, _ = combo_events(start_tick=1, reps=10)

    pipeline_a = PlayerModelPipeline()
    pipeline_b = PlayerModelPipeline()
    feed(pipeline_a, events_a)
    feed(pipeline_b, events_b)

    assert pipeline_a.snapshot().to_json_dict() != pipeline_b.snapshot().to_json_dict()
