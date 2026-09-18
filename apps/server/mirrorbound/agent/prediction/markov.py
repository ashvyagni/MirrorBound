"""A single fixed-order Markov transition table with exponential temporal decay
(doc sections 16-17): DASH -> FIRE is one order-1 model, DASH,FIRE -> AERIAL_ATTACK
is an order-2 model. SequencePredictor runs several of these side by side and backs
off from high order to low order depending on which has enough evidence.
"""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.agent.prediction.confidence import compute_confidence

MIN_WEIGHT = 1e-3


@dataclass
class _Entry:
    weight: float
    last_tick: int


class MarkovModel:
    def __init__(self, order: int, decay: float = 0.98, min_samples: float = 5.0) -> None:
        assert order >= 1
        self.order = order
        self.decay = decay
        self.min_samples = min_samples
        self._table: dict[tuple[str, ...], dict[str, _Entry]] = {}

    def observe(self, context: tuple[str, ...], next_token: str, tick: int) -> None:
        assert len(context) == self.order
        row = self._table.setdefault(context, {})
        entry = row.get(next_token)
        current_weight = self._decayed_weight(entry, tick) if entry else 0.0
        row[next_token] = _Entry(weight=current_weight + 1.0, last_tick=tick)

    def _decayed_weight(self, entry: _Entry, tick: int) -> float:
        elapsed = max(0, tick - entry.last_tick)
        weight = entry.weight * (self.decay**elapsed)
        return weight if weight >= MIN_WEIGHT else 0.0

    def candidates(self, context: tuple[str, ...], tick: int) -> dict[str, float]:
        """Decay-adjusted weight per next-token, as of `tick`. Read-only — does not
        mutate stored state, so calling this repeatedly at increasing ticks with no
        new observations shows confidence fading, exactly as the doc requires.
        """
        row = self._table.get(context)
        if not row:
            return {}
        weights = {token: self._decayed_weight(entry, tick) for token, entry in row.items()}
        return {token: w for token, w in weights.items() if w > 0.0}

    def predict(self, context: tuple[str, ...], tick: int) -> list[tuple[str, float, float]]:
        """Ranked (token, confidence, weight) for this context, highest confidence first."""
        weights = self.candidates(context, tick)
        if not weights:
            return []
        total = sum(weights.values())
        ranked = [
            (token, compute_confidence(w / total, total, self.min_samples), w)
            for token, w in weights.items()
        ]
        ranked.sort(key=lambda item: item[1], reverse=True)
        return ranked
