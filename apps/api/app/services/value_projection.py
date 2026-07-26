"""Deterministic customer value projections for flex plan interventions."""

from __future__ import annotations

from typing import Any

from app.services.pricing import MONTHLY_FULL_CENTS, WEEKLY_CENTS

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
    risk_tier: str | None = None,
) -> dict[str, Any]:
    """Compare unlimited (quit) path vs weekly flex base+entry (capped) path."""
    del risk_tier, offer_slug, offer_type
    unlimited_monthly = (
        int(current_monthly_cents) if current_monthly_cents else MONTHLY_FULL_CENTS
    )
    quit_months = max(1, min(HORIZON_MONTHS, int(months_to_quit)))
    flex_months = max(quit_months + 1, min(HORIZON_MONTHS, int(flex_retention_months)))

    if estimated_weekly_cents is not None:
        flex_weekly = int(estimated_weekly_cents)
        base = int(base_cents) if base_cents is not None else flex_weekly
        entry = int(per_entry_cents) if per_entry_cents is not None else 0
        cap = int(max_cap_weekly_cents) if max_cap_weekly_cents is not None else None
        cap_label = f", max ${cap / 100:.0f}/wk" if cap is not None else ""
        flex_label = (
            f"Flex ${base / 100:.0f}/wk + ${entry / 100:.0f}/visit"
            f"{cap_label} (~${flex_weekly / 100:.0f}/wk)"
        )
    elif base_cents is not None and per_entry_cents is not None and expected_visits is not None:
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
    else:
        # amount_cents is treated as weekly estimate when present
        flex_weekly = int(amount_cents) if amount_cents is not None else WEEKLY_CENTS // 2
        flex_label = f"Flex ~${flex_weekly / 100:.0f}/wk"

    flex_monthly = _weekly_to_monthly(flex_weekly)
    flex_monthly_payments = [flex_monthly] * flex_months
    while len(flex_monthly_payments) < HORIZON_MONTHS:
        flex_monthly_payments.append(0)

    series: list[dict[str, int]] = []
    current_cum = 0
    flex_cum = 0

    for month in range(1, HORIZON_MONTHS + 1):
        if month <= quit_months:
            current_cum += unlimited_monthly
        flex_cum += flex_monthly_payments[month - 1]
        series.append(
            {
                "month": month,
                "current_cumulative_cents": current_cum,
                "flex_cumulative_cents": flex_cum,
            }
        )

    return {
        "horizon_months": HORIZON_MONTHS,
        "current_plan_monthly_cents": unlimited_monthly,
        "full_price_months": quit_months,
        "flex_retention_months": flex_months,
        "flex_plan_label": flex_label,
        "current_total_cents": current_cum,
        "flex_total_cents": flex_cum,
        "improvement_cents": flex_cum - current_cum,
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
        risk_tier=risk_tier,
    )
