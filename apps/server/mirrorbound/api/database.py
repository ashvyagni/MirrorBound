import asyncpg
import logging
from contextlib import asynccontextmanager
from typing import Optional

logger = logging.getLogger(__name__)

import os

# Note: In a real environment, this should come from config/env variables
DB_DSN = os.environ.get("DATABASE_URL", "postgres://localhost:5432/mirrorbound")

_pool: Optional[asyncpg.Pool] = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);
"""

async def init_db() -> bool:
    """Open the pool and make sure the schema is there. False if unreachable.

    **A missing database is not fatal.** The database holds accounts and nothing
    else: the simulation is in memory, and progression is checkpointed to JSON
    files by `game/world/save.py`. This used to re-raise, which aborts the
    FastAPI lifespan and takes the whole server down -- so a developer following
    the README's two commands got "Application startup failed. Exiting." and no
    game at all, and the one machine that has to work on demo day needs Postgres
    running before the world will load.

    AGENTS.md lists Postgres among the things this project deliberately does not
    build on, so the game must not require it to run. Accounts do; the routes in
    `auth.py` answer 503 while it is down, and everything else works.
    """
    global _pool
    logger.info("Initializing database connection pool...")
    try:
        _pool = await asyncpg.create_pool(DB_DSN)
        if _pool is None:
            raise RuntimeError("Failed to create database pool")

        async with _pool.acquire() as conn:
            await conn.execute(SCHEMA)
        logger.info("Database schema initialized.")
        return True
    except Exception as e:
        _pool = None
        logger.warning(
            "No database at %s (%s). Accounts are unavailable; the game itself "
            "does not need one. Start Postgres with `docker compose up -d db` if "
            "you want sign-in.", DB_DSN, e)
        return False

async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

@asynccontextmanager
async def get_connection():
    # 503 rather than 500: the server is fine, the account store is not running.
    # Every caller is an auth route, and this is what they should tell a client.
    if _pool is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="Accounts are unavailable: the server has no database. "
                   "The game itself does not need one.")
    async with _pool.acquire() as conn:
        yield conn
