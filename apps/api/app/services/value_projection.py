"""Deterministic customer value projections for flex plan interventions."""

from __future__ import annotations

from typing import Any

from app.services.pricing import (
    MONTHLY_FULL_CENTS,
    WEEKLY_CENTS,
    expected_flex_months_float,
    expected_quit_months_float,
)

HORIZON_MONTHS = 12


def flex_worth_recommending(projection: dict[str, Any] | None) -> bool:
    """True when flex improves 12-month expected value vs the quit path."""
    if not projection:
        return False
    return int(projection.get("improvement_cents") or 0) > 0


def _weekly_to_monthly(weekly_cents: int) -> int:
    return round(int(weekly_cents) * 52 / 12)


def _flex_weekly_bill(
    *,
    base_weekly_cents: int,
    per_entry_cents: int,
    expected_visits: int,
    max_cap_weekly_cents: int | None,
) -> int:
    uncapped = int(base_weekly_cents) + int(expected_visits) * int(per_entry_cents)
    if max_cap_weekly_cents is None:
        return uncapped
    return min(uncapped, int(max_cap_weekly_cents))


def _resolve_tenure_months(
    *,
    churn_probability_pct: int | None,
    months_to_quit: int,
    flex_retention_months: int,
    expected_quit_months: float | None,
    expected_flex_months: float | None,
) -> tuple[float, float, int, int]:
    """Return (quit_float, flex_float, display_quit, display_flex) capped to horizon."""
    if expected_quit_months is not None and expected_flex_months is not None:
        quit_float = max(1.0, min(float(HORIZON_MONTHS), float(expected_quit_months)))
        flex_float = max(quit_float + 1.0, min(float(HORIZON_MONTHS), float(expected_flex_months)))
    elif churn_probability_pct is not None:
        quit_float = max(
            1.0,
            min(float(HORIZON_MONTHS), expected_quit_months_float(churn_probability_pct=churn_probability_pct)),
        )
        flex_float = max(
            quit_float + 1.0,
            min(
                float(HORIZON_MONTHS),
                expected_flex_months_float(churn_probability_pct=churn_probability_pct),
            ),
        )
    else:
        display_quit = max(1, min(HORIZON_MONTHS, int(months_to_quit)))
        display_flex = max(display_quit + 1, min(HORIZON_MONTHS, int(flex_retention_months)))
        quit_float = float(display_quit)
        flex_float = float(display_flex)

    display_quit = max(1, min(HORIZON_MONTHS, round(quit_float)))
    display_flex = max(display_quit + 1, min(HORIZON_MONTHS, round(flex_float)))
    return quit_float, flex_float, display_quit, display_flex


def _cumulative_for_tenure(*, monthly_cents: int, tenure_months: float) -> int:
    """Sum full monthly payments plus a partial final month when tenure is fractional."""
    if tenure_months <= 0:
        return 0
    full_months = int(tenure_months)
    remainder = tenure_months - full_months
    total = full_months * monthly_cents
    if remainder > 0 and full_months < HORIZON_MONTHS:
        total += round(monthly_cents * remainder)
    return total


def _build_series(
    *,
    unlimited_monthly: int,
    flex_monthly: int,
    quit_months_float: float,
    flex_months_float: float,
) -> tuple[list[dict[str, int]], int, int]:
    """Month-by-month cumulative series aligned with fractional tenure totals."""
    quit_horizon = min(float(HORIZON_MONTHS), quit_months_float)
    flex_horizon = min(float(HORIZON_MONTHS), flex_months_float)
    series: list[dict[str, int]] = []

    for month in range(1, HORIZON_MONTHS + 1):
        current_cum = _cumulative_for_tenure(
            monthly_cents=unlimited_monthly,
            tenure_months=min(float(month), quit_horizon),
        )
        flex_cum = _cumulative_for_tenure(
            monthly_cents=flex_monthly,
            tenure_months=min(float(month), flex_horizon),
        )
        series.append(
            {
                "month": month,
                "current_cumulative_cents": current_cum,
                "flex_cumulative_cents": flex_cum,
            }
        )

    current_total = _cumulative_for_tenure(
        monthly_cents=unlimited_monthly,
        tenure_months=quit_horizon,
    )
    flex_total = _cumulative_for_tenure(
        monthly_cents=flex_monthly,
        tenure_months=flex_horizon,
    )
    return series, current_total, flex_total


def compute_value_projection(
    *,
    offer_slug: str,
    offer_type: str,
    current_monthly_cents: int,
    months_to_quit: int,
    flex_retention_months: int,
    amount_cents: int | None = None,
    base_cents: int | None = None,
    per_entry_cents: int | None = None,
    expected_visits: int | None = None,
    max_cap_weekly_cents: int | None = None,
    estimated_weekly_cents: int | None = None,
    churn_probability_pct: int | None = None,
    expected_quit_months: float | None = None,
    expected_flex_months: float | None = None,
    risk_tier: str | None = None,
) -> dict[str, Any]:
    """Compare unlimited (quit) path vs weekly flex base+entry (capped) path."""
    del risk_tier, offer_slug, offer_type
    unlimited_monthly = (
        int(current_monthly_cents) if current_monthly_cents else MONTHLY_FULL_CENTS
    )
    quit_months_float, flex_months_float, display_quit, display_flex = _resolve_tenure_months(
        churn_probability_pct=churn_probability_pct,
        months_to_quit=months_to_quit,
        flex_retention_months=flex_retention_months,
        expected_quit_months=expected_quit_months,
        expected_flex_months=expected_flex_months,
    )

    if (
        base_cents is not None
        and per_entry_cents is not None
        and expected_visits is not None
    ):
        flex_weekly = _flex_weekly_bill(
            base_weekly_cents=int(base_cents),
            per_entry_cents=int(per_entry_cents),
            expected_visits=int(expected_visits),
            max_cap_weekly_cents=max_cap_weekly_cents,
        )
        cap = int(max_cap_weekly_cents) if max_cap_weekly_cents is not None else None
        cap_label = f", max ${cap / 100:.0f}/wk" if cap is not None else ""
        flex_label = (
            f"Flex ${base_cents / 100:.0f}/wk + ${per_entry_cents / 100:.0f}/visit"
            f"{cap_label} (~${flex_weekly / 100:.0f}/wk)"
        )
    elif estimated_weekly_cents is not None:
        flex_weekly = int(estimated_weekly_cents)
        base = int(base_cents) if base_cents is not None else flex_weekly
        entry = int(per_entry_cents) if per_entry_cents is not None else 0
        cap = int(max_cap_weekly_cents) if max_cap_weekly_cents is not None else None
        cap_label = f", max ${cap / 100:.0f}/wk" if cap is not None else ""
        flex_label = (
            f"Flex ${base / 100:.0f}/wk + ${entry / 100:.0f}/visit"
            f"{cap_label} (~${flex_weekly / 100:.0f}/wk)"
        )
    else:
        flex_weekly = int(amount_cents) if amount_cents is not None else WEEKLY_CENTS // 2
        flex_label = f"Flex ~${flex_weekly / 100:.0f}/wk"

    flex_monthly = _weekly_to_monthly(flex_weekly)
    series, current_total, flex_total = _build_series(
        unlimited_monthly=unlimited_monthly,
        flex_monthly=flex_monthly,
        quit_months_float=quit_months_float,
        flex_months_float=flex_months_float,
    )

    return {
        "horizon_months": HORIZON_MONTHS,
        "current_plan_monthly_cents": unlimited_monthly,
        "full_price_months": display_quit,
        "flex_retention_months": display_flex,
        "flex_plan_label": flex_label,
        "current_total_cents": current_total,
        "flex_total_cents": flex_total,
        "improvement_cents": flex_total - current_total,
        "series": series,
    }


def projection_for_offer(
    *,
    offer_slug: str,
    offer_type: str,
    current_monthly_cents: int,
    months_to_quit: int,
    flex_retention_months: int,
    amount_cents: int | None = None,
    base_cents: int | None = None,
    per_entry_cents: int | None = None,
    expected_visits: int | None = None,
    max_cap_weekly_cents: int | None = None,
    estimated_weekly_cents: int | None = None,
    churn_probability_pct: int | None = None,
    expected_quit_months: float | None = None,
    expected_flex_months: float | None = None,
    risk_tier: str | None = None,
    membership_plan: str | None = None,
) -> dict[str, Any]:
    """12-month value projection for suggest/preview."""
    del membership_plan
    monthly = current_monthly_cents or MONTHLY_FULL_CENTS
    return compute_value_projection(
        offer_slug=offer_slug,
        offer_type=offer_type,
        current_monthly_cents=monthly,
        months_to_quit=months_to_quit,
        flex_retention_months=flex_retention_months,
        amount_cents=amount_cents,
        base_cents=base_cents,
        per_entry_cents=per_entry_cents,
        expected_visits=expected_visits,
        max_cap_weekly_cents=max_cap_weekly_cents,
        estimated_weekly_cents=estimated_weekly_cents,
        churn_probability_pct=churn_probability_pct,
        expected_quit_months=expected_quit_months,
        expected_flex_months=expected_flex_months,
        risk_tier=risk_tier,
    )


def projection_from_breakdown(
    *,
    risk_tier: str,
    offer_slug: str,
    offer_type: str,
    breakdown: dict[str, Any],
) -> dict[str, Any]:
    """Build projection from a pricing_breakdown payload."""
    inputs = breakdown.get("inputs") or {}
    churn = inputs.get("churn_probability_pct")
    return projection_for_offer(
        risk_tier=risk_tier,
        offer_slug=offer_slug,
        offer_type=offer_type,
        amount_cents=breakdown.get("amount_cents"),
        current_monthly_cents=int(breakdown.get("current_monthly_cents") or MONTHLY_FULL_CENTS),
        months_to_quit=int(breakdown.get("months_to_quit") or 1),
        flex_retention_months=int(breakdown.get("flex_retention_months") or 2),
        base_cents=breakdown.get("base_weekly_cents", breakdown.get("base_cents")),
        per_entry_cents=breakdown.get("per_entry_cents"),
        expected_visits=breakdown.get(
            "expected_visits_per_week", breakdown.get("expected_visits")
        ),
        max_cap_weekly_cents=breakdown.get("max_cap_weekly_cents"),
        estimated_weekly_cents=breakdown.get("estimated_weekly_cents"),
        churn_probability_pct=int(churn) if churn is not None else None,
        expected_quit_months=breakdown.get("expected_quit_months"),
        expected_flex_months=breakdown.get("expected_flex_months"),
    )
