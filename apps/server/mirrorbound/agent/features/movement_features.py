"""Mobility trait signal from movement events (doc section 15).

Only computed when data["distance"] is present — see
docs/contracts/telemetry-events.md. We don't infer distance from the action
type (e.g. assume every DASH moved "far") because actual movement numbers
belong to the game/movement system, not to a guess made here.
"""

from __future__ import annotations

from mirrorbound.game.core.events import Event

# A rough "one full dash" reference distance in world units. Tune once real
# movement numbers exist; this is a placeholder normalization constant, not a
# measured game balance value.
MOBILITY_DISTANCE_NORM = 5.0


def mobility_signal(event: Event) -> float | None:
    distance = event.data.get("distance")
    if distance is None:
        return None
    return min(1.0, max(0.0, float(distance) / MOBILITY_DISTANCE_NORM))
