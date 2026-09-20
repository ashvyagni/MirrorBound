"""Turns raw SequencePredictor output into discrete pattern-detection events
(doc sections 33-34): a "PATTERN_DETECTED" moment when a sequence crosses a
confidence threshold, and a "LOST" moment when a previously-reliable pattern
stops being reconfirmed — not a continuous per-tick prediction feed, which is
what agent/prediction/predictor.py already gives you.

This is a thin state-transition layer on top of prediction/, not a
reimplementation of it: all the n-gram counting and weight decay stays in
agent/prediction/markov.py. PatternDetector only decides when the predictor's
own top prediction is noteworthy enough to surface as a discrete event.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, replace

from mirrorbound.agent.patterns.decay import is_stale
from mirrorbound.agent.patterns.pattern import Pattern
from mirrorbound.agent.prediction.predictor import SequencePredictor

DEFAULT_DETECTION_THRESHOLD = 0.7
# How long an active pattern can go without its context recurring before it's
# dropped, even if its underlying Markov weight hasn't fully decayed yet.
DEFAULT_STALENESS_TICKS = 600.0
DEFAULT_HISTORY_CAPACITY = 50


@dataclass(frozen=True)
class PatternEvent:
    kind: str  # "DETECTED" or "LOST"
    pattern: Pattern

    def to_json_dict(self) -> dict:
        return {"kind": self.kind, "pattern": self.pattern.to_json_dict()}


class PatternDetector:
    def __init__(
        self,
        predictor: SequencePredictor,
        detection_threshold: float = DEFAULT_DETECTION_THRESHOLD,
        staleness_ticks: float = DEFAULT_STALENESS_TICKS,
        history_capacity: int = DEFAULT_HISTORY_CAPACITY,
    ) -> None:
        self.predictor = predictor
        self.detection_threshold = detection_threshold
        self.staleness_ticks = staleness_ticks
        # Keyed by context (the tuple of preceding tokens), not by the full
        # sequence -- a context can only have one *currently* dominant pattern.
        self.active: dict[tuple[str, ...], Pattern] = {}
        self.history: deque[PatternEvent] = deque(maxlen=history_capacity)

    def check(self, tick: int, top_k: int = 1) -> list[PatternEvent]:
        events = self._drop_stale_patterns(tick)

        candidates = self.predictor.predict(top_k=top_k, tick=tick)
        if not candidates or candidates[0].confidence < self.detection_threshold:
            return events

        top = candidates[0]
        context = tuple(self.predictor.history[-top.order:])
        existing = self.active.get(context)

        if existing is not None and existing.next_token == top.token:
            # Same pattern still holding -- reconfirm, don't re-announce it.
            self.active[context] = replace(
                existing, confidence=top.confidence, last_confirmed_tick=tick
            )
            return events

        if existing is not None:
            # A different token now dominates this context: the old pattern is
            # replaced, not just updated -- announce it as lost before the new one.
            events.append(self._emit("LOST", existing))

        pattern = Pattern(
            context=context,
            next_token=top.token,
            order=top.order,
            confidence=top.confidence,
            first_detected_tick=tick,
            last_confirmed_tick=tick,
        )
        self.active[context] = pattern
        events.append(self._emit("DETECTED", pattern))
        return events

    def _drop_stale_patterns(self, tick: int) -> list[PatternEvent]:
        stale_contexts = [
            context
            for context, pattern in self.active.items()
            if is_stale(pattern.last_confirmed_tick, tick, self.staleness_ticks)
        ]
        events = []
        for context in stale_contexts:
            events.append(self._emit("LOST", self.active.pop(context)))
        return events

    def _emit(self, kind: str, pattern: Pattern) -> PatternEvent:
        event = PatternEvent(kind=kind, pattern=pattern)
        self.history.append(event)
        return event

    def snapshot(self) -> list[Pattern]:
        return list(self.active.values())

    def recent_events(self, count: int | None = None) -> list[PatternEvent]:
        items = list(self.history)
        return items if count is None else items[-count:]
