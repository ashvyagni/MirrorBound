"""Shared fixtures: a session that doesn't write replay files, and helpers to
drive it with scripted, tick-stamped input.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.player import PlayerInput

DT = 1.0 / 60.0

# The campaign opens in a village, which is the right first thing for a player
# and the wrong one for a combat test: villages have no enemies and no doors.
# Tests about fighting, rooms or the twin start in the first dungeon instead.
TEST_DUNGEON = "wakewood_crypt"


def combat_session(session_id: str = "test", seed: int = 1234, **kwargs) -> GameSession:
    """A session that starts inside a dungeon with the twin already awake.

    The twin is normally found partway through the first dungeon; tests that are
    about what the twin *does* should not have to replay the rescue to get there.
    """
    kwargs.setdefault("record", False)
    kwargs.setdefault("start_area", TEST_DUNGEON)
    session = GameSession(session_id, seed=seed, **kwargs)
    wake_twin(session)
    return session


def wake_twin(session: GameSession) -> None:
    twin = session.state.twin
    if twin.dormant:
        twin.awaken(session.state.player.position, session.campaign.twin_name)
        session.campaign.rescue_twin()


@pytest.fixture
def session() -> GameSession:
    return combat_session()


@pytest.fixture
def village_session() -> GameSession:
    """The campaign as a player actually meets it: village first, twin not yet found."""
    return GameSession("village", seed=1234, record=False)


def run_ticks(session: GameSession, ticks: int, inp: PlayerInput | None = None) -> None:
    for _ in range(ticks):
        if inp is not None:
            session.pending_input = PlayerInput(
                move_x=inp.move_x, move_y=inp.move_y, attack=inp.attack, run=inp.run, ability=inp.ability,
            )
        session.step(DT)


def events_of(session: GameSession, event_type: str) -> list:
    return [e for e in session.state.pending_events if e.type == event_type]


def arm(session, *weapon_ids: str):
    """Put these weapons in the player's hands, in slot order.

    Abilities belong to weapons now, so a test about `flame_burst` has to be
    holding the staff that grants it -- the ability bar is the main hand's pair
    followed by the offhand's. Starting bare-handed is the game's opening, not
    something a combat test should have to work around.

    Returns the session so it reads as one line at the top of a test.
    """
    inv = session.state.player.inventory
    inv.weapons = list(weapon_ids)
    inv.equipped_weapon = weapon_ids[0] if weapon_ids else ""
    inv.offhand_weapon = weapon_ids[1] if len(weapon_ids) > 1 else ""
    return session
