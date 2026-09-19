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
