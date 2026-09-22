"""FastAPI application for Mirrorbound game server."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mirrorbound.api.websocket import router as ws_router, websocket_endpoint
from mirrorbound.api.auth import router as auth_router, ensure_admin_user
from mirrorbound.api.database import init_db, close_db
from mirrorbound.api.session import GameSession

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup
    await init_db()
    await ensure_admin_user()
    yield
    # Teardown
    await close_db()

def create_app() -> FastAPI:
    """Create the FastAPI application."""
    app = FastAPI(
        title="Mirrorbound Game Server",
        description="Authoritative game simulation server",
        version="0.1.0",
        lifespan=lifespan,
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
    
    # Include Auth router
    app.include_router(auth_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
