"""Mobility trait signal from movement events (doc section 15).

Only computed when data["distance"] is present — see
docs/contracts/telemetry-events.md. We don't infer distance from the action
type (e.g. assume every DASH moved "far") because actual movement numbers
belong to the game/movement system, not to a guess made here.
"""

from __future__ import annotations

from mirrorbound.game.core.events import Event

# Reference distance in world units that reads as "fully mobile" for one
# observation. Calibrated against the real game: PLAYER_MOVED is sampled every
# 20 ticks (a third of a second), so a sprint covers ~96 units and a walk ~58;
# Shadow Dash moves 190. Walking therefore reads ~0.6, sprinting/dashing 1.0.
MOBILITY_DISTANCE_NORM = 95.0

# Events whose `distance` is a distance the *player moved*.
#
# `distance` is not a player-movement field everywhere it appears: on
# PLAYER_RETREATED it is how far away the threatening enemy is, and on
# TWIN_ATTACKED it is the gap between the twin and its target. Feeding either
# into this trait made a stationary player read as maximally mobile whenever
# the twin was shooting. Only the two events that report ground the player
# actually covered are movement evidence.
MOVEMENT_TYPES = {"PLAYER_MOVED", "PLAYER_DASHED"}


def mobility_signal(event: Event) -> float | None:
    if event.type not in MOVEMENT_TYPES:
        return None
    distance = event.data.get("distance")
    if distance is None:
        return None
    return min(1.0, max(0.0, float(distance) / MOBILITY_DISTANCE_NORM))
