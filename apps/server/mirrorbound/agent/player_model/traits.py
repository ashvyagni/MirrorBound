"""Player behaviour traits (architecture doc section 15).

A trait is never a naked float — it carries confidence, sample count, and a recent
trend, so early gameplay doesn't pretend to know the player. Each observation is a
signal in [0.0, 1.0] (e.g. 1.0 = "this action was aggressive", 0.0 = "was cautious").
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

DEFAULT_TRAIT_NAMES = (
    "aggression",
    "mobility",
    "risk_tolerance",
    "preferred_range",
    "melee_dependency",
    "ranged_dependency",
    "spell_dependency",
    "defensive_tendency",
    "combo_dependency",
)


@dataclass
class Trait:
    value: float = 0.5
    confidence: float = 0.0
    samples: int = 0
    recent_trend: float = 0.0

    # How fast the running value chases new observations (recency weighting —
    # this *is* the trait's temporal decay: older evidence is geometrically
    # discounted every time a newer observation arrives).
    learning_rate: float = 0.15
    # Samples needed for confidence to reach ~63% of its ceiling; confidence
    # approaches but never reaches 1.0, since a trait is never fully "known".
    confidence_saturation: float = 20.0

    def update(self, signal: float) -> None:
        signal = min(1.0, max(0.0, signal))
        previous = self.value
        self.value = (1 - self.learning_rate) * self.value + self.learning_rate * signal
        self.recent_trend = self.value - previous
        self.samples += 1
        # Capped short of 1.0: at large sample counts 1 - exp(-x) underflows to
        # exactly 1.0 in float64, which would violate "a trait is never fully known".
        self.confidence = min(0.999999, 1 - math.exp(-self.samples / self.confidence_saturation))


class PlayerTraitModel:
    """A player's full set of behavioural traits, keyed by name."""

    def __init__(self, trait_names: tuple[str, ...] = DEFAULT_TRAIT_NAMES) -> None:
        self.traits: dict[str, Trait] = {name: Trait() for name in trait_names}

    def observe(self, trait_name: str, signal: float) -> Trait:
        trait = self.traits.setdefault(trait_name, Trait())
        trait.update(signal)
        return trait

    def get(self, trait_name: str) -> Trait:
        return self.traits.setdefault(trait_name, Trait())

    def snapshot(self) -> dict[str, dict[str, float]]:
        """A plain-dict view suitable for the AI debug HUD / telemetry export."""
        return {
            name: {
                "value": trait.value,
                "confidence": trait.confidence,
                "samples": trait.samples,
                "recent_trend": trait.recent_trend,
            }
            for name, trait in self.traits.items()
        }
