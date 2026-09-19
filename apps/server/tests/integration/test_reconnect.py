"""A reload must come back to the run it left, not to a second one.

Sessions used to be created per *connection*. Reloading therefore built a
second world and started a second 60Hz loop under the same id -- and because
the new socket had already replaced the old one in the connection table, both
loops pushed snapshots down it until the old handler noticed its socket was
gone. Two worlds interleaving into one client, and the run lost either way.

Driven through the real endpoint with a stand-in socket: `httpx` is not a
dependency here, so starlette's TestClient is not available.
"""

import asyncio

import pytest
from fastapi import WebSocketDisconnect

from mirrorbound.api import websocket as ws_mod
from mirrorbound.api.websocket import live, websocket_endpoint


class FakeWebSocket:
    """Enough of a WebSocket for the endpoint: accept, receive, send, close."""

    def __init__(self, messages=(), while_connected=None):
        self.query_params: dict[str, str] = {}
        self.sent: list[str] = []
        self._messages = list(messages)
        # Run once while the endpoint still considers us connected. The
        # endpoint freezes the world again the moment we drop, so anything
        # about the connected state has to be observed from in here.
        self._while_connected = while_connected

    async def accept(self):
        return None

    async def send_text(self, text: str):
        self.sent.append(text)

    async def receive_text(self):
        if self._messages:
            return self._messages.pop(0)
        if self._while_connected is not None:
            hook, self._while_connected = self._while_connected, None
            hook()
        raise WebSocketDisconnect(1001)


async def _drain(session_id: str):
    """Stop whatever the test left running."""
    entry = live.get(session_id)
    if entry is not None:
        if entry.reaper is not None:
            entry.reaper.cancel()
        entry.session.stop()
        entry.task.cancel()
        live.pop(session_id, None)
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_reconnecting_adopts_the_same_world():
    sid = "reconnect-test"
    await _drain(sid)
    try:
        await websocket_endpoint(FakeWebSocket(), sid)
        entry = live.get(sid)
        assert entry is not None, "the run must survive the client going away"
        first = entry.session
        first_task = entry.task
        assert entry.owner is None
        assert first.state.paused, "the world is frozen while nobody is watching"
        assert entry.reaper is not None, "and is scheduled to be reaped"

        await websocket_endpoint(FakeWebSocket(), sid)
        again = live.get(sid)
        assert again is not None
        assert again.session is first, "reconnecting must not build a second world"
        assert again.task is first_task, "nor start a second game loop"
    finally:
        await _drain(sid)


@pytest.mark.asyncio
async def test_reconnecting_unfreezes_only_the_pause_it_caused():
    """The disconnect pause must not fight the pause menu."""
    sid = "reconnect-pause"
    await _drain(sid)
    try:
        await websocket_endpoint(FakeWebSocket(), sid)
        session = live[sid].session
        assert session.state.paused

        seen = {}
        await websocket_endpoint(
            FakeWebSocket(while_connected=lambda: seen.update(paused=session.state.paused)), sid)
        assert seen["paused"] is False, "coming back lifts the disconnect pause"

        # Now the player opens the pause menu *while connected*, then drops.
        # set_connected(False) must leave that pause alone, and coming back
        # must not lift someone else's pause.
        await websocket_endpoint(
            FakeWebSocket(while_connected=lambda: setattr(session.state, "paused", True)), sid)
        assert session.state.paused

        seen.clear()
        await websocket_endpoint(
            FakeWebSocket(while_connected=lambda: seen.update(paused=session.state.paused)), sid)
        assert seen["paused"] is True, "a menu pause must survive a reconnect"
    finally:
        await _drain(sid)


@pytest.mark.asyncio
async def test_a_reaped_session_is_replaced_by_a_fresh_one():
    sid = "reconnect-reap"
    await _drain(sid)
    try:
        await websocket_endpoint(FakeWebSocket(), sid)
        first = live[sid].session
        ws_mod._shutdown(sid, live[sid])
        assert sid not in live

        await websocket_endpoint(FakeWebSocket(), sid)
        assert live[sid].session is not first, "once reaped, the next connect starts over"
    finally:
        await _drain(sid)
