"""WebSocket handler for game communication."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mirrorbound.api.session import GameSession

router = APIRouter()
log = logging.getLogger("mirrorbound.ws")

# How long a run is kept alive after its client goes away, so a reload comes
# back to the same world instead of a fresh one. The simulation is frozen for
# the duration -- see GameSession.set_connected.
RECONNECT_GRACE_SECONDS = 30.0


@dataclass
class LiveSession:
    """One running world, and whichever socket is currently driving it.

    A session used to be created per *connection*, which meant a reload built
    a second world and started a second 60Hz loop for the same id -- and since
    the new socket had already replaced the old one in the connection table,
    both loops then pushed snapshots down it. Two worlds interleaving into one
    client, until the old handler noticed its socket was gone. Sessions are
    keyed by id here instead, and a reconnect adopts the one that exists.
    """
    session: GameSession
    task: asyncio.Task
    owner: WebSocket | None
    reaper: asyncio.Task | None = field(default=None)


class ConnectionManager:
    """Manages WebSocket connections, one per session id."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str, websocket: WebSocket | None = None):
        """Forget a connection.

        A client that reloads reconnects with the same session id before the old
        handler has finished tearing down; removing by id alone would then drop the
        *new* socket and every snapshot after it. Only remove the socket we own.
        """
        current = self.active_connections.get(session_id)
        if websocket is None or current is websocket:
            self.active_connections.pop(session_id, None)

    async def send_message(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws is not None:
            await ws.send_text(json.dumps(message, separators=(",", ":")))


manager = ConnectionManager()
live: dict[str, LiveSession] = {}


def _shutdown(session_id: str, entry: LiveSession) -> None:
    entry.session.stop()
    entry.task.cancel()
    if live.get(session_id) is entry:
        del live[session_id]
    log.info("session %s reaped", session_id)


async def _reap_later(session_id: str, entry: LiveSession) -> None:
    try:
        await asyncio.sleep(RECONNECT_GRACE_SECONDS)
    except asyncio.CancelledError:
        return
    if live.get(session_id) is entry and entry.owner is None:
        _shutdown(session_id, entry)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for game communication."""
    await manager.connect(websocket, session_id)
    seed_param = websocket.query_params.get("seed")
    seed = int(seed_param) if seed_param and seed_param.lstrip("-").isdigit() else None

    entry = live.get(session_id)
    if entry is not None and entry.session.running and not entry.task.done():
        # Adopt the run that is already going rather than starting a second one.
        if entry.reaper is not None:
            entry.reaper.cancel()
            entry.reaper = None
        entry.owner = websocket
        session = entry.session
        session.set_connected(True)
        log.info("session %s resumed (seed %s)", session_id, session.seed)
    else:
        session = GameSession(session_id, seed=seed)
        entry = LiveSession(session=session,
                            task=asyncio.create_task(session.run_game_loop(manager)),
                            owner=websocket)
        live[session_id] = entry
        log.info("session %s started (seed %s)", session_id, session.seed)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue
            if isinstance(message, dict):
                session.handle_input(message)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("websocket error for %s", session_id)
    finally:
        manager.disconnect(session_id, websocket)
        current = live.get(session_id)
        if current is entry and entry.owner is websocket:
            # Nobody else has taken it over. Freeze it and give the client a
            # moment to come back before the world is thrown away.
            entry.owner = None
            session.set_connected(False)
            entry.reaper = asyncio.create_task(_reap_later(session_id, entry))
            log.info("session %s idle; reaping in %.0fs", session_id, RECONNECT_GRACE_SECONDS)
        else:
            log.info("session %s handed over", session_id)
