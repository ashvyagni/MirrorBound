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
    def __init__(
        self,
        order: int,
        half_life_ticks: float = 1800.0,
        min_samples: float = 5.0,
    ) -> None:
        """`tick` in observe()/predict() is whatever tick counter the caller feeds
        in — in real usage that's the 60Hz sim clock's tick. half_life_ticks is a
        deliberately chosen real-time half-life expressed in that same unit: default
        1800 ticks = 30s at 60Hz, not "34 ticks" from an arbitrary per-tick fraction.
        Pass float('inf') for no decay.
        """
        assert order >= 1
        assert half_life_ticks > 0
        self.order = order
        self.half_life_ticks = half_life_ticks
        self.decay_per_tick = (
            1.0 if half_life_ticks == float("inf") else 0.5 ** (1.0 / half_life_ticks)
        )
        self.min_samples = min_samples
        self._table: dict[tuple[str, ...], dict[str, _Entry]] = {}

    def observe(self, context: tuple[str, ...], next_token: str, tick: int) -> None:
        assert len(context) == self.order
        row = self._table.setdefault(context, {})
        entry = row.get(next_token)
        current_weight = self._decayed_weight(entry, tick) if entry else 0.0
        row[next_token] = _Entry(weight=current_weight + 1.0, last_tick=tick)
        # Sweep the row we just touched: cheap opportunity to actually drop any
        # sibling entries (other tokens that followed this same context) that have
        # decayed away, rather than letting storage grow forever.
        self._prune_row(row, tick)

    def _decayed_weight(self, entry: _Entry, tick: int) -> float:
        elapsed = max(0, tick - entry.last_tick)
        weight = entry.weight * (self.decay_per_tick**elapsed)
        return weight if weight >= MIN_WEIGHT else 0.0

    def _prune_row(self, row: dict[str, _Entry], tick: int) -> None:
        stale = [token for token, entry in row.items() if self._decayed_weight(entry, tick) <= 0.0]
        for token in stale:
            del row[token]

    def prune(self, tick: int) -> int:
        """Sweep every stored context, actually removing entries whose decayed
        weight has fallen to zero and deleting any context whose row is now empty.

        observe() only sweeps the one row it just touched, so a context that's
        stopped being reinforced entirely (e.g. the player abandoned that whole
        pattern) would otherwise sit in `_table` forever, just filtered out of
        every read. Call this periodically — SequencePredictor does, every
        PRUNE_INTERVAL_TICKS — so memory stays bounded by *active* contexts.
        Returns the number of contexts removed, for tests/telemetry.
        """
        empty_contexts = []
        for context, row in self._table.items():
            self._prune_row(row, tick)
            if not row:
                empty_contexts.append(context)
        for context in empty_contexts:
            del self._table[context]
        return len(empty_contexts)

    def __len__(self) -> int:
        """Number of distinct contexts currently stored — for bounded-memory checks
        and the debug HUD, not used internally.
        """
        return len(self._table)

    def candidates(self, context: tuple[str, ...], tick: int) -> dict[str, float]:
        """Decay-adjusted weight per next-token, as of `tick`. Does not mutate
        storage itself (pruning is observe()/prune()'s job) — calling this
        repeatedly at increasing ticks with no new observations shows confidence
        fading regardless of whether a prune() has run recently, since it always
        filters out anything already decayed to zero.
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
