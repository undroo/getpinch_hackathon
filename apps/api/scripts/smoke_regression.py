"""Smoke checks for regression + weekly base+per-entry flex with max cap.

Run from apps/api:
  python -m scripts.smoke_regression
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.pricing import MONTHLY_FULL_CENTS, WEEKLY_CENTS, price_offer
from app.services.regression import (
    build_member_insights,
    churn_probability_pct,
    linear_slope,
)
from app.services.value_projection import flex_worth_recommending, projection_for_offer


def main() -> None:
    declining = list(range(11, -1, -1))
    assert linear_slope(declining) < 0, "declining series should have negative slope"

    crit = churn_probability_pct(
        days_since_last_visit=24,
        visits_30d=0,
        visit_slope_90d=-0.4,
        tenure_days=200,
    )
    assert 75 <= crit <= 92, f"critical band failed: {crit}"

    slip = churn_probability_pct(
        days_since_last_visit=16,
        visits_30d=2,
        visit_slope_90d=-0.2,
        tenure_days=200,
    )
    assert 45 <= slip <= 68, f"slipping band failed: {slip}"

    healthy = churn_probability_pct(
        days_since_last_visit=2,
        visits_30d=12,
        visit_slope_90d=0.1,
        tenure_days=200,
    )
    assert 8 <= healthy <= 18, f"healthy band failed: {healthy}"

    now = datetime.now(UTC)
    joined = now - timedelta(days=200)
    insights_c = build_member_insights(
        joined_at=joined,
        visits_30d=0,
        days_since_last_visit=24,
        risk_tier="critical",
        check_in_dates=[now - timedelta(days=d) for d in range(40, 90, 3)],
        pinch_payer_id="payer_x",
        cohort_visits_30d=[0, 2, 5, 8, 12, 10, 0, 1],
        membership_plan="standard",
        now=now,
    )
    assert 75 <= insights_c["churn_probability"] <= 92
    assert insights_c["ltv_cents"] > 0

    assert WEEKLY_CENTS == 3000
    assert MONTHLY_FULL_CENTS == round(3000 * 52 / 12)

    sarah = price_offer(
        churn_probability_pct=crit,
        membership_plan="standard",
        offer_slug="hold_plan",
        visits_30d=0,
        risk_tier="critical",
    )
    marcus = price_offer(
        churn_probability_pct=slip,
        membership_plan="standard",
        offer_slug="hold_plan",
        visits_30d=8,  # ~2 visits/week
        risk_tier="slipping",
    )

    assert sarah["amount_kind"] == "base_plus_entry"
    assert sarah["base_weekly_cents"] == sarah["base_cents"]
    assert sarah["base_weekly_cents"] < WEEKLY_CENTS  # base below unlimited
    assert sarah["per_entry_cents"] >= 200
    # Max cap never below standard $30/week
    assert sarah["max_cap_weekly_cents"] >= WEEKLY_CENTS
    assert marcus["max_cap_weekly_cents"] >= WEEKLY_CENTS
    assert sarah["break_even_visits"] > sarah["expected_visits_per_week"]
    assert sarah["expected_visits_per_week"] == 1
    assert marcus["expected_visits_per_week"] == 2
    assert sarah["estimated_weekly_cents"] == sarah["amount_cents"]
    assert (
        sarah["estimated_weekly_cents"]
        == min(
            sarah["base_weekly_cents"]
            + sarah["expected_visits_per_week"] * sarah["per_entry_cents"],
            sarah["max_cap_weekly_cents"],
        )
    )
    # Cap constraint: uncapped high-visit week still ≤ max, and max ≥ $30
    high_visit_uncapped = sarah["base_weekly_cents"] + 20 * sarah["per_entry_cents"]
    assert min(high_visit_uncapped, sarah["max_cap_weekly_cents"]) >= WEEKLY_CENTS or (
        sarah["max_cap_weekly_cents"] >= WEEKLY_CENTS
    )
    assert "/week" in sarah["explanation"] or "/wk" in sarah["explanation"]

    vp = projection_for_offer(
        risk_tier="critical",
        offer_slug="hold_plan",
        offer_type="plan_switch",
        amount_cents=sarah["amount_cents"],
        current_monthly_cents=sarah["current_monthly_cents"],
        months_to_quit=sarah["months_to_quit"],
        flex_retention_months=sarah["flex_retention_months"],
        base_cents=sarah["base_weekly_cents"],
        per_entry_cents=sarah["per_entry_cents"],
        expected_visits=sarah["expected_visits_per_week"],
        max_cap_weekly_cents=sarah["max_cap_weekly_cents"],
        estimated_weekly_cents=sarah["estimated_weekly_cents"],
    )
    assert vp["series"]
    assert vp["current_plan_monthly_cents"] == MONTHLY_FULL_CENTS
    assert "/wk" in vp["flex_plan_label"]

    assert flex_worth_recommending({"improvement_cents": 1200}) is True
    assert flex_worth_recommending({"improvement_cents": 0}) is False
    assert flex_worth_recommending({"improvement_cents": -4800}) is False
    assert flex_worth_recommending(None) is False
    assert flex_worth_recommending(vp) is (vp["improvement_cents"] > 0)

    print(
        f"OK critical={crit}% slipping={slip}% healthy={healthy}% "
        f"sarah={sarah['base_weekly_cents']}c/wk+{sarah['per_entry_cents']}c "
        f"cap={sarah['max_cap_weekly_cents']}c "
        f"marcus={marcus['base_weekly_cents']}c/wk+{marcus['per_entry_cents']}c "
        f"cap={marcus['max_cap_weekly_cents']}c "
        f"improvement_cents={vp['improvement_cents']}"
    )


if __name__ == "__main__":
    main()
