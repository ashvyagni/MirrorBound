"""Enemy behavior definitions."""

from __future__ import annotations

from enum import Enum


class EnemyBehavior(Enum):
    """Different enemy behavior patterns."""
    CHARGE = "charge"
    KEEP_DISTANCE = "keep_distance"
    CIRCLE = "circle"
    AMBUSH = "ambush"
