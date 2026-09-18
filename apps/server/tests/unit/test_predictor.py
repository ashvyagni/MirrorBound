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
    predictor = SequencePredictor(max_order=3, decay=1.0)
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
    predictor = SequencePredictor(max_order=2, decay=1.0, min_samples=5.0)
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
    predictor = SequencePredictor(max_order=1, decay=0.9, min_context_weight=0.5)

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
