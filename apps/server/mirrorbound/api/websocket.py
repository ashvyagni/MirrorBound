"""WebSocket handler for game communication."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mirrorbound.api.session import GameSession
from mirrorbound.game.world import save as save_system

router = APIRouter()
log = logging.getLogger("mirrorbound.ws")


class ConnectionManager:
    """Manages WebSocket connections, one per session id."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        previous = self.active_connections.get(session_id)
        self.active_connections[session_id] = websocket
        if previous is not None and previous is not websocket:
            # Newest connection owns this save. The old browser must not retry
            # forever and take it back; the client recognises this close code.
            try:
                await previous.close(code=4409, reason="Session opened in another tab")
            except (RuntimeError, WebSocketDisconnect):
                pass

    def disconnect(self, session_id: str, websocket: WebSocket | None = None):
        """Forget a connection.

        A client that reloads reconnects with the same session id before the old
        handler has finished tearing down; removing by id alone would then drop the
        *new* socket and every snapshot after it. Only remove the socket we own.
        """
        current = self.active_connections.get(session_id)
        if websocket is None or current is websocket:
            self.active_connections.pop(session_id, None)

    async def send_message(self, session_id: str, message: dict, owner: WebSocket | None = None):
        ws = self.active_connections.get(session_id)
        if ws is not None and (owner is None or owner is ws):
            await ws.send_text(json.dumps(message, separators=(",", ":")))


class ConnectionSender:
    """Bind a simulation's output to its socket, never to a replacement socket."""
    def __init__(self, manager: ConnectionManager, websocket: WebSocket):
        self.manager, self.websocket = manager, websocket

    async def send_message(self, session_id: str, message: dict):
        await self.manager.send_message(session_id, message, owner=self.websocket)


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for game communication."""
    await manager.connect(websocket, session_id)
    seed_param = websocket.query_params.get("seed")
    seed = int(seed_param) if seed_param and seed_param.lstrip("-").isdigit() else None
    # A real connection resumes from its checkpoint. Tests build sessions
    # directly and leave `load_save` off, which is why it is not the default,
    # but without this here every hearth and every village wrote a save that
    # nothing ever read and closing the tab lost the run.
    #
    # `?seed=` means "start this run over from a known seed", so it also means
    # do not resume -- otherwise the seed would be ignored by the save.
    # Resume the slot this profile was last playing, not always the autosave:
    # a player who loaded a named save and closed the tab expects to come back
    # to it.
    slot = save_system.read_active_slot(session_id)
    session = GameSession(session_id, seed=seed, load_save=seed is None, slot=slot)
    game_task = asyncio.create_task(session.run_game_loop(ConnectionSender(manager, websocket)))
    log.info("session %s started (seed %s)", session_id, session.seed)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue
            if manager.active_connections.get(session_id) is not websocket:
                break
            if isinstance(message, dict):
                session.handle_input(message)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("websocket error for %s", session_id)
    finally:
        session.stop()
        game_task.cancel()
        try:
            await game_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        manager.disconnect(session_id, websocket)
        log.info("session %s closed", session_id)
