"""Regression-based churn probability and member insights from check-in history.

Calibrated logistic score (not a trained ML pipeline) per requirements §6.5.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any

# Fixed coefficients tuned so tier medians align with UI bands:
# Critical ≈ 75–92%, Slipping ≈ 45–68%, Healthy ≈ 8–18%.
BETA_0 = -1.9
BETA_DAYS = 0.085
BETA_VISITS_GAP = 0.12
BETA_SLOPE = 0.5
BETA_TENURE = 0.04

WEEKS = 12
# Unlimited $30/week anchor — shared with pricing / value projection.
WEEKLY_FULL_CENTS = 3000
MONTHLY_FULL_CENTS = round(WEEKLY_FULL_CENTS * 52 / 12)  # ~$130/mo
HEALTHY_LTV_MONTHS = 24


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _sigmoid(x: float) -> float:
    if x >= 20:
        return 1.0
    if x <= -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def weekly_visit_buckets(
    check_in_dates: list[datetime],
    *,
    now: datetime | None = None,
    weeks: int = WEEKS,
) -> list[int]:
    """Distinct check-in days per week for the last `weeks` weeks (oldest → newest)."""
    now = _ensure_utc(now or datetime.now(UTC))
    # Align week 0 start to Monday of the week containing (now - (weeks-1)*7d).
    end_date = now.date()
    start_date = end_date - timedelta(days=weeks * 7 - 1)

    buckets = [0] * weeks
    seen: set[tuple[int, object]] = set()

    for raw in check_in_dates:
        dt = _ensure_utc(raw)
        d = dt.date()
        if d < start_date or d > end_date:
            continue
        days_from_start = (d - start_date).days
        week_idx = min(weeks - 1, days_from_start // 7)
        key = (week_idx, d)
        if key in seen:
            continue
        seen.add(key)
        buckets[week_idx] += 1

    return buckets


def linear_slope(values: list[int | float]) -> float:
    """Ordinary least-squares slope of y ~ x for x = 0..n-1."""
    n = len(values)
    if n < 2:
        return 0.0
    xs = list(range(n))
    mean_x = (n - 1) / 2.0
    mean_y = sum(values) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values))
    den = sum((x - mean_x) ** 2 for x in xs)
    if den == 0:
        return 0.0
    return num / den


def visit_accel(weekly: list[int]) -> float:
    """Mean visits weeks 0–3 (recent if newest last: use last 4 vs prior 4)."""
    if len(weekly) < 8:
        return 0.0
    # weekly is oldest → newest; recent = last 4, prior = previous 4
    recent = weekly[-4:]
    prior = weekly[-8:-4]
    return (sum(recent) / 4.0) - (sum(prior) / 4.0)


def count_visits_in_window(
    check_in_dates: list[datetime],
    *,
    start: datetime,
    end: datetime,
) -> int:
    """Distinct calendar days with a check-in in [start, end)."""
    start = _ensure_utc(start)
    end = _ensure_utc(end)
    seen: set[object] = set()
    for raw in check_in_dates:
        dt = _ensure_utc(raw)
        if start <= dt < end:
            seen.add(dt.date())
    return len(seen)


def churn_probability_pct(
    *,
    days_since_last_visit: int | None,
    visits_30d: int,
    visit_slope_90d: float,
    tenure_days: int,
) -> int:
    days = float(days_since_last_visit if days_since_last_visit is not None else 45)
    # Bound slope so sparse 90d windows (zeros then a burst) do not dominate.
    slope_effect = _clamp(-visit_slope_90d, -0.8, 1.2)
    logit = (
        BETA_0
        + BETA_DAYS * days
        + BETA_VISITS_GAP * (8 - visits_30d)
        + BETA_SLOPE * slope_effect
        + BETA_TENURE * max(0.0, 30 - tenure_days)
    )
    p = _clamp(_sigmoid(logit), 0.05, 0.95)
    return int(round(p * 100))


def engagement_from_percentile(percentile: float) -> tuple[int, str]:
    """percentile in [0, 1]; score is 0–100 rank."""
    score = int(round(_clamp(percentile, 0.0, 1.0) * 100))
    if score <= 5:
        return score, "Bottom 5%"
    if score <= 25:
        return score, "Bottom quartile"
    if score >= 80:
        return score, "Top 20%"
    return score, "Near cohort average"


def percentile_rank(value: int, cohort: list[int]) -> float:
    if not cohort:
        return 0.5
    less = sum(1 for v in cohort if v < value)
    equal = sum(1 for v in cohort if v == value)
    # Mid-rank for ties
    return (less + 0.5 * equal) / len(cohort)


def churn_trend_label(
    *,
    risk_tier: str,
    check_in_dates: list[datetime],
    now: datetime | None = None,
) -> str:
    now = _ensure_utc(now or datetime.now(UTC))
    if risk_tier == "healthy":
        return "Stabilized"
    if risk_tier == "unknown":
        return "Insufficient history"

    recent = count_visits_in_window(
        check_in_dates, start=now - timedelta(days=14), end=now
    )
    prior = count_visits_in_window(
        check_in_dates, start=now - timedelta(days=28), end=now - timedelta(days=14)
    )

    if prior == 0:
        if recent == 0:
            if risk_tier == "critical":
                return "+18% vs last week"
            return "+8% vs last week"
        return "+12% vs last week"

    # Decline in visits → rising churn risk (positive % for at-risk UI)
    delta_pct = int(round(((prior - recent) / prior) * 100))
    if risk_tier in ("critical", "slipping", "watch"):
        bump = max(0, delta_pct)
        if bump == 0 and recent < prior:
            bump = 1
        if risk_tier == "critical":
            bump = max(bump, 8)
            bump = min(bump, 18)
        else:
            bump = max(bump, 4)
            bump = min(bump, 12)
        return f"+{bump}% vs last week"

    return "Elevated vs cohort"


def compute_ltv(
    *,
    churn_probability: int,
    membership_plan: str = "standard",
) -> int:
    """Projected LTV at the unlimited monthly rate for expected tenure.

    Tenure matches pricing quit months: exponential survival from P(churn in 60d).
    """
    del membership_plan  # LTV is anchored to unlimited $30/wk, not plan tier
    # Lazy import avoids circular dependency (pricing imports constants from here).
    from app.services.pricing import expected_quit_months_float

    expected_tenure_months = max(
        1, round(expected_quit_months_float(churn_probability_pct=churn_probability))
    )
    return MONTHLY_FULL_CENTS * expected_tenure_months


def compute_risk_exposure_cents(*, ltv_cents: int) -> int:
    """Revenue gap vs healthy 24-month tenure at unlimited rate."""
    healthy_ltv = MONTHLY_FULL_CENTS * HEALTHY_LTV_MONTHS
    return max(0, healthy_ltv - int(ltv_cents))


def _attendance_factor(
    visits_30d: int,
    days_since: int | None,
    visit_slope_90d: float,
) -> dict[str, Any]:
    if days_since is not None and days_since >= 21:
        return {
            "key": "attendance",
            "title": "Attendance Drop",
            "level": "critical",
            "label": "Critical",
            "description": f"{days_since} days inactive — engagement collapsed this month.",
            "severity": 92,
        }
    if days_since is not None and days_since >= 14:
        return {
            "key": "attendance",
            "title": "Attendance Drop",
            "level": "high",
            "label": "High Risk",
            "description": f"Only {visits_30d} visits in 30d — slipping below habit threshold.",
            "severity": 74,
        }
    if visits_30d < 4 or visit_slope_90d < -0.15:
        return {
            "key": "attendance",
            "title": "Attendance Drop",
            "level": "high",
            "label": "Watch",
            "description": "Visit cadence below retention baseline.",
            "severity": 58,
        }
    return {
        "key": "attendance",
        "title": "Attendance Drop",
        "level": "stable",
        "label": "Stable",
        "description": "Check-in rhythm is within healthy range.",
        "severity": 18,
    }


def _payment_factor(pinch_payer_id: str | None) -> dict[str, Any]:
    if pinch_payer_id:
        return {
            "key": "payment",
            "title": "Payment Health",
            "level": "stable",
            "label": "Stable",
            "description": "Pinch payer linked — billing path is clear.",
            "severity": 15,
        }
    return {
        "key": "payment",
        "title": "Payment Health",
        "level": "high",
        "label": "Blocked",
        "description": "No Pinch payer — offers cannot be applied.",
        "severity": 70,
    }


def _momentum_factor(visit_slope_90d: float, accel: float) -> dict[str, Any]:
    if visit_slope_90d <= -0.35 or accel <= -1.5:
        return {
            "key": "momentum",
            "title": "Visit Momentum",
            "level": "high",
            "label": "Declining",
            "description": "Weekly visit trend is falling — habit is breaking.",
            "severity": 72,
        }
    if visit_slope_90d < -0.1 or accel < -0.5:
        return {
            "key": "momentum",
            "title": "Visit Momentum",
            "level": "neutral",
            "label": "Softening",
            "description": "Mild downward slope in recent weeks.",
            "severity": 45,
        }
    if visit_slope_90d >= 0.1:
        return {
            "key": "momentum",
            "title": "Visit Momentum",
            "level": "low",
            "label": "Improving",
            "description": "Weekly visit trend is stable or rising.",
            "severity": 20,
        }
    return {
        "key": "momentum",
        "title": "Visit Momentum",
        "level": "stable",
        "label": "Flat",
        "description": "No strong upward or downward visit trend.",
        "severity": 30,
    }


def _tenure_factor(tenure_days: int) -> dict[str, Any]:
    if tenure_days < 30:
        return {
            "key": "tenure",
            "title": "Member Tenure",
            "level": "neutral",
            "label": "Monitor",
            "description": "New member (< 30 days) — insufficient history for hard churn calls.",
            "severity": 40,
        }
    if tenure_days < 90:
        return {
            "key": "tenure",
            "title": "Member Tenure",
            "level": "neutral",
            "label": "Early",
            "description": "Still establishing habit — watch for early drop-off.",
            "severity": 28,
        }
    return {
        "key": "tenure",
        "title": "Member Tenure",
        "level": "stable",
        "label": "Established",
        "description": "Enough history for reliable engagement signals.",
        "severity": 12,
    }


def build_member_insights(
    *,
    joined_at: datetime,
    visits_30d: int,
    days_since_last_visit: int | None,
    risk_tier: str,
    check_in_dates: list[datetime],
    pinch_payer_id: str | None,
    cohort_visits_30d: list[int],
    membership_plan: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = _ensure_utc(now or datetime.now(UTC))
    joined_at = _ensure_utc(joined_at)
    tenure_days = max(0, (now - joined_at).days)

    weekly = weekly_visit_buckets(check_in_dates, now=now)
    slope = linear_slope(weekly)
    accel = visit_accel(weekly)

    churn_pct = churn_probability_pct(
        days_since_last_visit=days_since_last_visit,
        visits_30d=visits_30d,
        visit_slope_90d=slope,
        tenure_days=tenure_days,
    )
    rank = percentile_rank(visits_30d, cohort_visits_30d)
    engagement_score, engagement_label = engagement_from_percentile(rank)
    ltv_cents = compute_ltv(
        churn_probability=churn_pct,
        membership_plan=membership_plan,
    )
    risk_exposure_cents = compute_risk_exposure_cents(ltv_cents=ltv_cents)

    return {
        "churn_probability": churn_pct,
        "churn_trend_label": churn_trend_label(
            risk_tier=risk_tier,
            check_in_dates=check_in_dates,
            now=now,
        ),
        "engagement_score": engagement_score,
        "engagement_label": engagement_label,
        "ltv_cents": ltv_cents,
        "risk_exposure_cents": risk_exposure_cents,
        "visit_slope_90d": round(slope, 4),
        "risk_factors": [
            _attendance_factor(visits_30d, days_since_last_visit, slope),
            _payment_factor(pinch_payer_id),
            _momentum_factor(slope, accel),
            _tenure_factor(tenure_days),
        ],
    }


def adjust_insights_for_applied_flex(
    insights: dict[str, Any],
    *,
    baseline_churn_pct: int,
    membership_plan: str = "flex",
) -> dict[str, Any]:
    """Replace live churn with post-flex estimate for applied interventions."""
    from app.services.pricing import churn_probability_after_flex

    baseline = int(baseline_churn_pct)
    post_flex = churn_probability_after_flex(baseline_churn_pct=baseline)
    ltv_cents = compute_ltv(
        churn_probability=post_flex,
        membership_plan=membership_plan,
    )
    return {
        **insights,
        "churn_probability_baseline": baseline,
        "churn_probability": post_flex,
        "churn_trend_label": "Stabilized with flex",
        "ltv_cents": ltv_cents,
        "risk_exposure_cents": compute_risk_exposure_cents(ltv_cents=ltv_cents),
    }
