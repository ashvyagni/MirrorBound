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

async def init_db():
    global _pool
    logger.info("Initializing database connection pool...")
    try:
        _pool = await asyncpg.create_pool(DB_DSN)
        if _pool is None:
            raise RuntimeError("Failed to create database pool")
            
        async with _pool.acquire() as conn:
            await conn.execute(SCHEMA)
        logger.info("Database schema initialized.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

@asynccontextmanager
async def get_connection():
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    async with _pool.acquire() as conn:
        yield conn
