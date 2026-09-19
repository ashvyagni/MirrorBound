"""What the player has done across the whole run, as opposed to lately.

`traits.py` is an exponentially-weighted moving average, deliberately tuned so
the twin reacts to what you are doing *now*: learning rate 0.15 and confidence
saturating at 20 samples means roughly twenty actions fully re-characterise
you. That is right for a companion fighting beside you.

It is wrong for the Mirror. The directive's pitch is that the final boss
"uses accumulated behavioural information about the player to anticipate
recurring habits" -- the habits of the run, not of the last few seconds.
Measured on the EWMA: about twenty actions inside the boss room were enough to
overwrite the read entirely, so playing melee for a whole run and then opening
the boss door with a bow made the Mirror treat you as a ranged player.

So this counts instead of averaging, and never decays. Same categories the
boss already reads, in the same shape, so `MirrorController` is unchanged.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from mirrorbound.agent.features.combat_features import aggression_signal, dependency_signals
from mirrorbound.game.core.events import Event

# Actions before the profile is fully trusted. Higher than the EWMA's 20: this
# is a claim about a whole run, and it should not be confident three rooms in.
PROFILE_SATURATION = 60.0

CATEGORIES = ("melee_dependency", "ranged_dependency", "spell_dependency")


@dataclass
class RunProfile:
    """Cumulative, undecayed tallies of how the player has fought."""

    category_counts: dict[str, float] = field(
        default_factory=lambda: dict.fromkeys(CATEGORIES, 0.0))
    category_total: int = 0
    aggression_sum: float = 0.0
    aggression_total: int = 0

    def observe(self, event: Event) -> None:
        # Reuses the same extractors the EWMA does, so "what counts as a melee
        # action" is defined in exactly one place -- including their gate on
        # the event actually being one of the player's own.
        signals = dependency_signals(event)
        if signals:
            for name, value in signals.items():
                if name in self.category_counts:
                    self.category_counts[name] += value
            self.category_total += 1

        aggression = aggression_signal(event)
        if aggression is not None:
            self.aggression_sum += aggression
            self.aggression_total += 1

    @staticmethod
    def _trait(total_value: float, samples: int) -> dict[str, float]:
        return {
            "value": (total_value / samples) if samples else 0.5,
            "confidence": 1.0 - math.exp(-samples / PROFILE_SATURATION) if samples else 0.0,
            "samples": samples,
            "recent_trend": 0.0,
        }

    def snapshot(self) -> dict[str, dict[str, float]]:
        """The same `{name: {value, confidence, ...}}` shape as PlayerTraitModel."""
        traits = {
            name: self._trait(count, self.category_total)
            for name, count in self.category_counts.items()
        }
        traits["aggression"] = self._trait(self.aggression_sum, self.aggression_total)
        return traits
