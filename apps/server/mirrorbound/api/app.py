"""FastAPI application for Mirrorbound game server."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mirrorbound.api.websocket import router as ws_router


def create_app() -> FastAPI:
    """Create the FastAPI application."""
    app = FastAPI(
        title="Mirrorbound Game Server",
        description="Authoritative game simulation server",
        version="0.1.0",
    )

    # CORS for local development and production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include WebSocket router
    app.include_router(ws_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
