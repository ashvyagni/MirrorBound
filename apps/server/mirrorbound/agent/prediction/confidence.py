"""Confidence scoring shared by prediction and pattern detection (doc section 16).

Confidence must depend on frequency, support (how dominant this outcome is among
the alternatives seen in this context), and recency — never on raw count alone.
3 occurrences of a transition should not mean "I know what you're doing."
"""

from __future__ import annotations

import math


def compute_confidence(
    support_ratio: float,
    context_weight: float,
    min_samples: float = 5.0,
) -> float:
    """support_ratio: this candidate's weight / total weight observed in the context.
    context_weight: total (decay-adjusted) evidence seen in the context so far.
    min_samples: weight at which the evidence-strength term reaches ~63%.
    """
    support_ratio = min(1.0, max(0.0, support_ratio))
    evidence_strength = 1 - math.exp(-context_weight / min_samples)
    return support_ratio * evidence_strength
