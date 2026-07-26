from datetime import date, datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends

from app.db import get_db

router = APIRouter(prefix="/stats", tags=["stats"])

WINDOW_DAYS = 30


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/attendance")
async def attendance_stats(
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Gym-wide check-in trend and peak hours for the last 30 days."""
    since = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)

    day_rows = await conn.fetch(
        """
        SELECT
          (checked_in_at AT TIME ZONE 'UTC')::date AS day,
          COUNT(*)::int AS check_ins,
          COUNT(DISTINCT member_id)::int AS unique_members
        FROM check_ins
        WHERE checked_in_at >= $1
        GROUP BY 1
        ORDER BY 1
        """,
        since,
    )

    hour_rows = await conn.fetch(
        """
        SELECT
          EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'UTC')::int AS hour,
          COUNT(*)::int AS check_ins
        FROM check_ins
        WHERE checked_in_at >= $1
        GROUP BY 1
        ORDER BY 1
        """,
        since,
    )

    totals = await conn.fetchrow(
        """
        SELECT
          COUNT(*)::int AS total_check_ins,
          COUNT(DISTINCT member_id)::int AS unique_members
        FROM check_ins
        WHERE checked_in_at >= $1
        """,
        since,
    )

    day_map = {
        row["day"]: {
            "check_ins": int(row["check_ins"]),
            "unique_members": int(row["unique_members"]),
        }
        for row in day_rows
    }
    today = _utc_today()
    by_day = []
    for offset in range(WINDOW_DAYS - 1, -1, -1):
        d = today - timedelta(days=offset)
        bucket = day_map.get(d, {"check_ins": 0, "unique_members": 0})
        by_day.append(
            {
                "date": d.isoformat(),
                "check_ins": bucket["check_ins"],
                "unique_members": bucket["unique_members"],
            }
        )

    hour_map = {int(row["hour"]): int(row["check_ins"]) for row in hour_rows}
    by_hour = [
        {"hour": hour, "check_ins": hour_map.get(hour, 0)} for hour in range(24)
    ]

    return {
        "window_days": WINDOW_DAYS,
        "total_check_ins": int(totals["total_check_ins"] or 0),
        "unique_members": int(totals["unique_members"] or 0),
        "by_day": by_day,
        "by_hour": by_hour,
    }
