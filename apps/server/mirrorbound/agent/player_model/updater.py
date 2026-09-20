"""Applies a single gameplay Event's trait signals to a PlayerTraitModel
(doc section 15). Pure with respect to the event — only ever reads event.data
(which is already immutable, see game/core/events.py), never mutates it.
"""

from __future__ import annotations

from mirrorbound.agent.features.combat_features import (
    aggression_signal,
    combo_signal,
    defensive_signal,
    dependency_signals,
    preferred_range_signal,
    risk_tolerance_signal,
)
from mirrorbound.agent.features.movement_features import mobility_signal
from mirrorbound.agent.player_model.traits import PlayerTraitModel
from mirrorbound.game.core.events import Event


def apply_event(traits: PlayerTraitModel, event: Event) -> None:
    aggression = aggression_signal(event)
    if aggression is not None:
        traits.observe("aggression", aggression)

    for trait_name, signal in dependency_signals(event).items():
        traits.observe(trait_name, signal)

    combo = combo_signal(event)
    if combo is not None:
        traits.observe("combo_dependency", combo)

    mobility = mobility_signal(event)
    if mobility is not None:
        traits.observe("mobility", mobility)

    preferred_range = preferred_range_signal(event)
    if preferred_range is not None:
        traits.observe("preferred_range", preferred_range)

    risk = risk_tolerance_signal(event)
    if risk is not None:
        traits.observe("risk_tolerance", risk)

    defensive = defensive_signal(event)
    if defensive is not None:
        traits.observe("defensive_tendency", defensive)
