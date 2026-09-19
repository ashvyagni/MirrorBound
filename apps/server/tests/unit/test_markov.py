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


def test_temporal_decay_eventually_makes_a_stale_transition_unpredictable():
    # A read-time property only: candidates()/predict() always filter out anything
    # decayed to zero, regardless of whether storage has actually been cleaned up
    # yet (that's a separate guarantee — see the two tests below).
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    for tick in range(1, 11):
        model.observe(("DASH",), "FIRE", tick=tick)

    assert model.predict(("DASH",), tick=1000) == []


def test_observe_prunes_stale_sibling_entries_from_the_touched_row():
    # observe() sweeps the row it just wrote to, so a sibling entry (a different
    # next-token for the same context) that has decayed away is actually removed
    # from storage, not just skipped at read time.
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    model.observe(("DASH",), "FIRE", tick=1)
    model.observe(("DASH",), "DODGE", tick=1000)  # FIRE's entry has long since decayed away

    row = model._table[("DASH",)]
    assert "FIRE" not in row
    assert "DODGE" in row


def test_prune_removes_a_fully_stale_context_from_storage_entirely():
    # A context that stops being reinforced altogether isn't touched by any future
    # observe() (there's nothing left to observe into it), so it would otherwise sit
    # in storage forever, just filtered out of every read. prune() sweeps the whole
    # table and actually deletes it — this is the real "not just filtered, removed"
    # fix; test_temporal_decay_eventually_makes_a_stale_transition_unpredictable above
    # only proves the read-time symptom, not that storage shrinks.
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    model.observe(("DASH",), "FIRE", tick=1)
    assert len(model) == 1

    removed = model.prune(tick=1000)

    assert removed == 1
    assert len(model) == 0
    assert ("DASH",) not in model._table


def test_prune_keeps_contexts_that_are_still_active():
    model = MarkovModel(order=1, min_samples=5.0, half_life_ticks=10.0)
    model.observe(("DASH",), "FIRE", tick=1)
    model.observe(("FIRE",), "DODGE", tick=1000)  # still fresh — no decay yet

    removed = model.prune(tick=1000)

    assert removed == 1  # only the DASH->FIRE context, which is long stale
    assert len(model) == 1
    assert ("FIRE",) in model._table


def test_unseen_context_returns_no_candidates():
    model = MarkovModel(order=1)
    assert model.predict(("NEVER_SEEN",), tick=1) == []
