import logging
from collections.abc import AsyncGenerator

import asyncpg
from fastapi import Depends, HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _pool_connect_kwargs() -> dict:
    kwargs: dict = {"min_size": 1, "max_size": 5}
    if "supabase.co" in settings.database_url or "pooler.supabase.com" in settings.database_url:
        kwargs["ssl"] = "require"
        kwargs["statement_cache_size"] = 0
    return kwargs


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                settings.database_url,
                **_pool_connect_kwargs(),
            )
        except (OSError, asyncpg.PostgresError) as exc:
            logger.error("Database connection failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail=(
                    "Database unavailable. Start Postgres on port 54322 "
                    "(e.g. `docker compose up -d postgres` from repo root) "
                    "and ensure DATABASE_URL in apps/api/.env is correct."
                ),
            ) from exc
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def check_db_connection() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except HTTPException:
        return False


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as connection:
        yield connection


DbConn = Depends(get_db)
