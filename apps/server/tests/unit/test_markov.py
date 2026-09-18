from mirrorbound.agent.prediction.markov import MarkovModel

# Real usage picks half_life_ticks from SequencePredictor's half_life_seconds *
# tick_hz (e.g. 30s * 60Hz = 1800 ticks). Tests use a deliberately short
# half_life_ticks so decay is observable over a handful of ticks.


def test_single_observation_has_low_confidence():
    model = MarkovModel(order=1, min_samples=5.0)
    model.observe(("DASH",), "FIRE", tick=1)
    [(token, confidence, _weight)] = model.predict(("DASH",), tick=1)
    assert token == "FIRE"
    assert confidence < 0.3


def test_confidence_rises_with_repeated_consistent_transitions():
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=float("inf"))
    confidences = []
    for tick in range(1, 21):
        model.observe(("DASH",), "FIRE", tick=tick)
        [(_token, confidence, _weight)] = model.predict(("DASH",), tick=tick)
        confidences.append(confidence)
    assert confidences == sorted(confidences)
    assert confidences[-1] > 0.8


def test_competing_outcomes_split_confidence_by_support_ratio():
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=float("inf"))
    for tick in range(1, 11):
        model.observe(("DASH",), "FIRE", tick=tick)
    for tick in range(11, 21):
        model.observe(("DASH",), "DODGE", tick=tick)

    ranked = model.predict(("DASH",), tick=20)
    tokens = {token: confidence for token, confidence, _ in ranked}
    # Roughly even split -> roughly even, and much lower than the single-outcome case.
    assert abs(tokens["FIRE"] - tokens["DODGE"]) < 0.05
    assert tokens["FIRE"] < 0.6


def test_temporal_decay_fades_confidence_without_new_observations():
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    for tick in range(1, 11):
        model.observe(("DASH",), "FIRE", tick=tick)

    [(_token, confidence_now, _w)] = model.predict(("DASH",), tick=10)
    [(_token, confidence_later, _w)] = model.predict(("DASH",), tick=25)

    assert confidence_later < confidence_now


def test_temporal_decay_eventually_prunes_a_stale_transition():
    # After a long enough silence, decayed-to-nothing evidence is dropped
    # entirely rather than lingering forever at a low weight (keeps the
    # transition table bounded and matches "old behaviour gradually stops
    # mattering", not just "matters slightly less forever").
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    for tick in range(1, 11):
        model.observe(("DASH",), "FIRE", tick=tick)

    assert model.predict(("DASH",), tick=1000) == []


def test_unseen_context_returns_no_candidates():
    model = MarkovModel(order=1)
    assert model.predict(("NEVER_SEEN",), tick=1) == []
