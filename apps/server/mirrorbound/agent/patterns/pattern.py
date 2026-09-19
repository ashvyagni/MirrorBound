"""A detected pattern (doc sections 33-34): a specific context -> next-token
transition that PatternDetector has flagged as currently reliable, not just a
raw prediction candidate. Immutable value object — PatternDetector replaces
its tracked entries rather than mutating them.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Pattern:
    context: tuple[str, ...]
    next_token: str
    order: int
    confidence: float
    first_detected_tick: int
    last_confirmed_tick: int

    @property
    def sequence(self) -> tuple[str, ...]:
        """The full sequence this pattern represents, e.g. (DASH, FIRE, AERIAL_ATTACK)."""
        return (*self.context, self.next_token)

    def to_json_dict(self) -> dict:
        return {
            "sequence": list(self.sequence),
            "order": self.order,
            "confidence": self.confidence,
            "first_detected_tick": self.first_detected_tick,
            "last_confirmed_tick": self.last_confirmed_tick,
        }
