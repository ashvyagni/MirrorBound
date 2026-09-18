"""WebSocket handler for game communication."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mirrorbound.api.session import GameSession

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for game communication."""
    await manager.connect(websocket, session_id)
    session = GameSession(session_id)

    try:
        # Start game loop in background
        game_task = asyncio.create_task(session.run_game_loop(manager))

        # Handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            session.handle_input(message)

    except WebSocketDisconnect:
        manager.disconnect(session_id)
        session.stop()
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(session_id)
        session.stop()
