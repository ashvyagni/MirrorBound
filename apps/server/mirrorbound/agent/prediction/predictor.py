"""Rolls player actions into semantic tokens and predicts what comes next
(doc section 16), backing off from long context to short when the longer one
doesn't have enough evidence yet — e.g. prefer the DASH,FIRE -> AERIAL_ATTACK
trigram once it's well-observed, otherwise fall back to the DASH -> FIRE bigram.
"""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.agent.prediction.markov import MarkovModel

MAX_HISTORY = 200


@dataclass
class PredictionCandidate:
    token: str
    confidence: float
    order: int
    weight: float


class SequencePredictor:
    def __init__(
        self,
        max_order: int = 3,
        decay: float = 0.98,
        min_samples: float = 5.0,
        min_context_weight: float = 1.0,
    ) -> None:
        self.max_order = max_order
        self.min_context_weight = min_context_weight
        self._models: dict[int, MarkovModel] = {
            order: MarkovModel(order=order, decay=decay, min_samples=min_samples)
            for order in range(1, max_order + 1)
        }
        self.history: list[str] = []
        self.tick: int = 0

    def observe(self, token: str, tick: int | None = None) -> None:
        self.tick = tick if tick is not None else self.tick + 1
        for order, model in self._models.items():
            if len(self.history) >= order:
                context = tuple(self.history[-order:])
                model.observe(context, token, self.tick)
        self.history.append(token)
        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

    def predict(self, top_k: int = 3, tick: int | None = None) -> list[PredictionCandidate]:
        """Highest-order model with enough context evidence wins; ties/gaps back off
        to shorter context rather than guessing confidently off one or two samples.
        """
        query_tick = tick if tick is not None else self.tick
        for order in range(self.max_order, 0, -1):
            if len(self.history) < order:
                continue
            context = tuple(self.history[-order:])
            ranked = self._models[order].predict(context, query_tick)
            if not ranked:
                continue
            total_weight = sum(w for _, _, w in ranked)
            if total_weight < self.min_context_weight:
                continue
            return [
                PredictionCandidate(token=token, confidence=conf, order=order, weight=w)
                for token, conf, w in ranked[:top_k]
            ]
        return []
