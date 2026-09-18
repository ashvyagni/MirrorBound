"""XP curve and level-up rules."""

from __future__ import annotations

BASE_XP = 80
XP_GROWTH = 1.35
MAX_LEVEL = 20


def xp_to_next(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    return int(BASE_XP * (XP_GROWTH ** (level - 1)))


def level_up_rewards(new_level: int) -> dict:
    return {
        "maxHealth": 12,
        "maxMana": 8,
        "skillPoints": 1,
        "level": new_level,
    }
