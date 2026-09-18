from mirrorbound.agent.prediction.predictor import SequencePredictor


def feed(predictor: SequencePredictor, tokens: list[str], start_tick: int) -> int:
    """Observe each token at consecutive ticks starting from start_tick.
    Returns the next free tick.
    """
    tick = start_tick
    for token in tokens:
        predictor.observe(token, tick=tick)
        tick += 1
    return tick


def test_no_prediction_before_any_history():
    predictor = SequencePredictor()
    assert predictor.predict() == []


def test_backs_off_to_low_order_when_higher_orders_have_no_evidence():
    predictor = SequencePredictor(max_order=3, half_life_seconds=float("inf"))
    tick = 1
    # Unique filler before each DASH so the 2- and 3-token contexts are always
    # novel, but the order-1 transition DASH -> FIRE repeats every cycle.
    for i in range(10):
        tick = feed(predictor, [f"FILLER_{i}", "DASH", "FIRE"], tick)

    # One more never-before-seen lead-in, then DASH: order-2/3 contexts ending
    # in this DASH have never been seen; only the order-1 context (DASH,) has.
    tick = feed(predictor, ["BRAND_NEW_TOKEN", "DASH"], tick)

    predictions = predictor.predict(tick=tick)
    assert predictions, "expected a backoff prediction from the order-1 model"
    assert predictions[0].token == "FIRE"
    assert predictions[0].order == 1


def test_learns_a_repeated_combo_and_predicts_the_finisher():
    predictor = SequencePredictor(max_order=2, half_life_seconds=float("inf"), min_samples=5.0)
    combo = ["DASH", "FIRE", "AERIAL_ATTACK"]
    tick = 1
    for _ in range(15):
        tick = feed(predictor, combo, tick)

    # Prime the context to (DASH, FIRE) and ask what's next.
    tick = feed(predictor, ["DASH", "FIRE"], tick)

    predictions = predictor.predict(tick=tick)
    assert predictions[0].token == "AERIAL_ATTACK"
    assert predictions[0].confidence > 0.6
    assert predictions[0].order == 2


def test_predictor_adapts_when_player_changes_strategy():
    # tick_hz=1.0 so each `feed()` step is one half-life unit of "time" here,
    # rather than one real 60Hz simulation tick.
    predictor = SequencePredictor(
        max_order=1, half_life_seconds=15.0, tick_hz=1.0, min_context_weight=0.5
    )

    tick = feed(predictor, ["DASH", "FIRE"] * 15, 1)
    tick = feed(predictor, ["DASH"], tick)
    early_predictions = predictor.predict(tick=tick)
    assert early_predictions[0].token == "FIRE"
    early_confidence = early_predictions[0].confidence

    # Player abandons DASH->FIRE in favour of DASH->RETREAT.
    tick = feed(predictor, ["RETREAT"] + ["DASH", "RETREAT"] * 14, tick)
    tick = feed(predictor, ["DASH"], tick)
    late_predictions = predictor.predict(tick=tick)

    assert late_predictions[0].token == "RETREAT"
    assert late_predictions[0].confidence > early_confidence * 0.5


def test_default_decay_calibration_survives_a_realistic_action_gap():
    # Regression guard: the previous default (a raw per-tick decay fraction) had
    # a ~34-tick (~0.57s at 60Hz) half-life, so evidence queried even a couple of
    # seconds later — a completely ordinary gap between player actions — had
    # already collapsed. With the real defaults (30s half-life @ 60Hz), a
    # repeated pattern should barely be dented by a 3-second gap.
    # max_order=1 to isolate decay calibration from order backoff (a periodic
    # DASH,FIRE,DASH,FIRE... sequence also gives the higher-order models their
    # own consistent — but different — predictions, which isn't what this test
    # is checking).
    predictor = SequencePredictor(max_order=1)  # defaults: half_life_seconds=30, tick_hz=60
    tick = 0
    for _ in range(5):
        predictor.observe("DASH", tick=tick)
        tick += 1
        predictor.observe("FIRE", tick=tick)
        tick += 1
    predictor.observe("DASH", tick=tick)  # prime context so we're asking "what follows DASH?"
    tick += 1

    three_seconds_later = tick + 3 * 60
    predictions = predictor.predict(tick=three_seconds_later)

    assert predictions
    assert predictions[0].token == "FIRE"
    assert predictions[0].confidence > 0.5


def test_predictor_automatically_prunes_stale_contexts_over_time():
    predictor = SequencePredictor(
        max_order=1, half_life_seconds=1.0, tick_hz=1.0, prune_interval_ticks=5.0
    )
    tick = feed(predictor, ["DASH", "FIRE"], 1)
    assert predictor.context_count() > 0

    # Keep observing an unrelated context far in the future so prune_interval_ticks
    # keeps getting crossed; the old (DASH,) context should eventually be swept
    # even though nothing ever observes into it again.
    for t in range(tick, tick + 200, 10):
        predictor.observe("IDLE", tick=t)

    remaining = predictor._models[1]._table
    assert ("DASH",) not in remaining
