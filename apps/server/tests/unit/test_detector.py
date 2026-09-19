from mirrorbound.agent.patterns.detector import PatternDetector
from mirrorbound.agent.prediction.predictor import SequencePredictor


def feed_and_check(predictor, detector, tokens, start_tick):
    """Observe each token, then run detection, exactly as TelemetryCollector does
    on every ingested event. Returns (all events seen, next free tick).
    """
    tick = start_tick
    events = []
    for token in tokens:
        predictor.observe(token, tick=tick)
        events.extend(detector.check(tick))
        tick += 1
    return events, tick


def test_no_detection_below_threshold():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    detector = PatternDetector(predictor, detection_threshold=0.7)

    events, _tick = feed_and_check(predictor, detector, ["DASH", "FIRE"], 1)

    assert events == []
    assert detector.snapshot() == []


def test_detection_fires_exactly_once_as_confidence_crosses_and_stays_above_threshold():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    detector = PatternDetector(predictor, detection_threshold=0.7)

    events, _tick = feed_and_check(predictor, detector, ["DASH", "FIRE"] * 20, 1)

    fire_detections = [
        e for e in events if e.kind == "DETECTED" and e.pattern.next_token == "FIRE"
    ]
    assert len(fire_detections) == 1
    assert fire_detections[0].pattern.context == ("DASH",)
    assert detector.active[("DASH",)].next_token == "FIRE"


def test_pattern_replaced_by_a_new_dominant_token_emits_lost_then_detected():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    detector = PatternDetector(predictor, detection_threshold=0.7)

    phase1_events, tick = feed_and_check(predictor, detector, ["DASH", "FIRE"] * 15, 1)
    assert len([e for e in phase1_events if e.kind == "DETECTED"]) >= 1

    # Player abandons DASH->FIRE for DASH->RETREAT; enough reps that RETREAT's
    # weight overtakes FIRE's frozen (no-decay) weight and dominates the context.
    phase2_events, _tick = feed_and_check(predictor, detector, ["DASH", "RETREAT"] * 60, tick)

    fire_lost = [e for e in phase2_events if e.kind == "LOST" and e.pattern.next_token == "FIRE"]
    retreat_detected = [
        e for e in phase2_events if e.kind == "DETECTED" and e.pattern.next_token == "RETREAT"
    ]
    assert len(fire_lost) == 1
    assert len(retreat_detected) == 1
    assert phase2_events.index(fire_lost[0]) < phase2_events.index(retreat_detected[0])
    assert detector.active[("DASH",)].next_token == "RETREAT"


def test_staleness_drops_an_unconfirmed_pattern():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    detector = PatternDetector(predictor, detection_threshold=0.7, staleness_ticks=50.0)

    _events, tick = feed_and_check(predictor, detector, ["DASH", "FIRE"] * 15, 1)
    assert ("DASH",) in detector.active

    # No further observations touch the (DASH,) context; just let time pass, as
    # the collector's per-event check() call would on unrelated events.
    later_events = detector.check(tick=tick + 100)

    lost = [e for e in later_events if e.kind == "LOST" and e.pattern.context == ("DASH",)]
    assert len(lost) == 1
    assert ("DASH",) not in detector.active


def test_history_capacity_bounds_the_event_log():
    predictor = SequencePredictor(max_order=1, half_life_seconds=float("inf"))
    detector = PatternDetector(predictor, detection_threshold=0.7, history_capacity=2)

    tick = 1
    for i in range(4):
        for _ in range(10):
            predictor.observe(f"CTX_{i}", tick=tick)
            tick += 1
            predictor.observe(f"NEXT_{i}", tick=tick)
            detector.check(tick)
            tick += 1

    assert len(detector.history) == 2
    assert len(detector.recent_events()) == 2
    assert len(detector.recent_events(count=1)) == 1
