"""XP curve and level-up rules."""

from __future__ import annotations

from mirrorbound.game.progression.attributes import POINTS_PER_LEVEL

BASE_XP = 80
XP_GROWTH = 1.35
MAX_LEVEL = 20


def xp_to_next(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    return int(BASE_XP * (XP_GROWTH ** (level - 1)))


def level_up_rewards(new_level: int) -> dict:
    """What a level hands over.

    The attribute point is new in v1.2 and deliberately small. Nineteen
    level-ups pay for 19 attribute points; the five tier-3 gates alone want 25
    and a single maxed branch wants 10. So levelling moves the numeric half of
    the character without ever finishing it, and the rest comes out of the
    ground. See `progression/attributes.py`.
    """
    return {
        "maxHealth": 12,
        "maxMana": 8,
        "skillPoints": 1,
        "attributePoints": POINTS_PER_LEVEL,
        "level": new_level,
    }
