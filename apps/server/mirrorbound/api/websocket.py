"""WebSocket handler for game communication."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mirrorbound.api.session import GameSession

router = APIRouter()
log = logging.getLogger("mirrorbound.ws")


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_message(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws is not None:
            await ws.send_text(json.dumps(message, separators=(",", ":")))


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for game communication."""
    await manager.connect(websocket, session_id)
    seed_param = websocket.query_params.get("seed")
    seed = int(seed_param) if seed_param and seed_param.lstrip("-").isdigit() else None
    session = GameSession(session_id, seed=seed)
    game_task = asyncio.create_task(session.run_game_loop(manager))

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
        manager.disconnect(session_id)
        session.stop()
        game_task.cancel()
        try:
            await game_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
