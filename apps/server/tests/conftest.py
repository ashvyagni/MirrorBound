"""Shared fixtures: a session that doesn't write replay files, and helpers to
drive it with scripted, tick-stamped input.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.player import PlayerInput

DT = 1.0 / 60.0


@pytest.fixture
def session() -> GameSession:
    return GameSession("test", seed=1234, record=False)


def run_ticks(session: GameSession, ticks: int, inp: PlayerInput | None = None) -> None:
    for _ in range(ticks):
        if inp is not None:
            session.pending_input = PlayerInput(
                move_x=inp.move_x, move_y=inp.move_y, attack=inp.attack, run=inp.run, ability=inp.ability,
            )
        session.step(DT)


def events_of(session: GameSession, event_type: str) -> list:
    return [e for e in session.state.pending_events if e.type == event_type]
