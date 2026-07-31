from datetime import date, datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends

from app.db import get_db

router = APIRouter(prefix="/stats", tags=["stats"])

WINDOW_DAYS = 30
AVG_SHORT_DAYS = 30
AVG_LONG_DAYS = 180


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _mean_daily_uniques(
    day_map: dict[date, dict[str, int]],
    end_exclusive: date,
    days: int,
) -> float:
    """Mean unique members/day over `days` complete days ending before end_exclusive."""
    total = 0
    for offset in range(1, days + 1):
        d = end_exclusive - timedelta(days=offset)
        total += day_map.get(d, {}).get("unique_members", 0)
    return round(total / days, 1)


@router.get("/attendance")
async def attendance_stats(
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Gym-wide daily users, 30-day trend, and peak hours."""
    today = _utc_today()
    # Start of the earliest complete day included in the 180d average.
    since = datetime.combine(
        today - timedelta(days=AVG_LONG_DAYS),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )
    chart_since = datetime.combine(
        today - timedelta(days=WINDOW_DAYS - 1),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )

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
        chart_since,
    )

    totals = await conn.fetchrow(
        """
        SELECT
          COUNT(*)::int AS total_check_ins,
          COUNT(DISTINCT member_id)::int AS unique_members
        FROM check_ins
        WHERE checked_in_at >= $1
        """,
        chart_since,
    )

    day_map = {
        row["day"]: {
            "check_ins": int(row["check_ins"]),
            "unique_members": int(row["unique_members"]),
        }
        for row in day_rows
    }

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

    yesterday = today - timedelta(days=1)
    yesterday_unique = day_map.get(yesterday, {}).get("unique_members", 0)

    return {
        "window_days": WINDOW_DAYS,
        "total_check_ins": int(totals["total_check_ins"] or 0),
        "unique_members": int(totals["unique_members"] or 0),
        "yesterday_unique_members": yesterday_unique,
        "avg_daily_users_30d": _mean_daily_uniques(day_map, today, AVG_SHORT_DAYS),
        "avg_daily_users_180d": _mean_daily_uniques(day_map, today, AVG_LONG_DAYS),
        "by_day": by_day,
        "by_hour": by_hour,
    }
