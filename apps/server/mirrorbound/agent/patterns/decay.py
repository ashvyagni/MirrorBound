"""Staleness bookkeeping for *detected* patterns — distinct from the weight
decay inside agent/prediction/markov.py. A pattern can still have nonzero
Markov weight (hasn't fully decayed out of storage) while no longer being
worth calling "currently active," because the context it was keyed on simply
hasn't recurred in a while. That's what this checks.
"""

from __future__ import annotations


def is_stale(last_confirmed_tick: int, tick: int, staleness_ticks: float) -> bool:
    return (tick - last_confirmed_tick) >= staleness_ticks
