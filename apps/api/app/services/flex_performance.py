"""Post-apply flex plan performance vs expectations at switch."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

VisitPace = Literal["ahead", "on_track", "behind", "unknown"]

_PACE_BAND = 0.15


def _flex_weekly_bill(
    *,
    base_weekly_cents: int,
    per_entry_cents: int,
    visits: int,
    max_cap_weekly_cents: int | None,
) -> int:
    uncapped = int(base_weekly_cents) + max(0, int(visits)) * int(per_entry_cents)
    if max_cap_weekly_cents is None:
        return uncapped
    return min(uncapped, int(max_cap_weekly_cents))


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _expected_visits(breakdown: dict[str, Any] | None) -> int | None:
    if not breakdown:
        return None
    raw = breakdown.get("expected_visits_per_week")
    if raw is None:
        raw = breakdown.get("expected_visits")
    if raw is None:
        return None
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return None


def _pricing_parts(
    breakdown: dict[str, Any] | None,
) -> tuple[int | None, int | None, int | None, int | None]:
    """Return base, per_entry, max_cap, estimated_expected_weekly."""
    if not breakdown:
        return None, None, None, None

    base = breakdown.get("base_weekly_cents")
    if base is None:
        base = breakdown.get("base_cents")
    per_entry = breakdown.get("per_entry_cents")
    max_cap = breakdown.get("max_cap_weekly_cents")
    estimated = breakdown.get("estimated_weekly_cents")
    if estimated is None:
        estimated = breakdown.get("amount_cents")

    try:
        base_i = int(base) if base is not None else None
    except (TypeError, ValueError):
        base_i = None
    try:
        entry_i = int(per_entry) if per_entry is not None else None
    except (TypeError, ValueError):
        entry_i = None
    try:
        cap_i = int(max_cap) if max_cap is not None else None
    except (TypeError, ValueError):
        cap_i = None
    try:
        est_i = int(estimated) if estimated is not None else None
    except (TypeError, ValueError):
        est_i = None

    return base_i, entry_i, cap_i, est_i


def _visit_pace(actual: float, expected: int | None) -> VisitPace:
    if expected is None or expected <= 0:
        return "unknown"
    lo = expected * (1.0 - _PACE_BAND)
    hi = expected * (1.0 + _PACE_BAND)
    if actual > hi:
        return "ahead"
    if actual < lo:
        return "behind"
    return "on_track"


def compute_flex_performance(
    *,
    applied_at: datetime,
    visits_since_apply: int,
    pricing_breakdown: dict[str, Any] | None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Build Then/Now performance metrics for an applied flex plan."""
    now_dt = _as_utc(now or datetime.now(timezone.utc))
    applied = _as_utc(applied_at)
    elapsed = now_dt - applied
    days_on_plan = max(0, int(elapsed.total_seconds() // 86400))
    weeks_on_plan = max(days_on_plan / 7.0, 1.0 / 7.0)
    visits = max(0, int(visits_since_apply))
    actual_visits_per_week = round(visits / weeks_on_plan, 2)

    expected = _expected_visits(pricing_breakdown)
    base, per_entry, max_cap, estimated_expected = _pricing_parts(pricing_breakdown)

    estimated_actual: int | None = None
    if base is not None and per_entry is not None:
        # Use rounded visit rate for bill estimate (at least 0)
        visit_rate = max(0, round(actual_visits_per_week))
        estimated_actual = _flex_weekly_bill(
            base_weekly_cents=base,
            per_entry_cents=per_entry,
            visits=visit_rate,
            max_cap_weekly_cents=max_cap,
        )
    elif estimated_expected is not None:
        estimated_actual = estimated_expected

    revenue_to_date: int | None = None
    if estimated_actual is not None:
        revenue_to_date = round(estimated_actual * (days_on_plan / 7.0))

    return {
        "days_on_plan": days_on_plan,
        "visits_since_apply": visits,
        "actual_visits_per_week": actual_visits_per_week,
        "expected_visits_per_week": expected,
        "estimated_actual_weekly_cents": estimated_actual,
        "estimated_expected_weekly_cents": estimated_expected,
        "estimated_revenue_to_date_cents": revenue_to_date,
        "visit_pace": _visit_pace(actual_visits_per_week, expected),
    }
