from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import check_db_connection, close_pool
from app.routers import flex_members, interventions, members, stats, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pool is created lazily on first DB request so the API can start
    # even when Postgres is not yet running.
    yield
    await close_pool()


app = FastAPI(title="RetainIQ+ API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members.router, prefix="/api/v1")
app.include_router(flex_members.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(interventions.router, prefix="/api/v1")
app.include_router(interventions.interventions_router, prefix="/api/v1")
app.include_router(interventions.offers_router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict:
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "gym": settings.demo_gym_name,
        "database": "connected" if db_ok else "unavailable",
    }
