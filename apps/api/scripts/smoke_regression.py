"""Smoke checks for regression + weekly base+per-entry flex with max cap.

Run from apps/api:
  python -m scripts.smoke_regression
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.pricing import (
    MONTHLY_FULL_CENTS,
    WEEKLY_CENTS,
    churn_probability_after_flex,
    expected_flex_months_float,
    expected_quit_months_float,
    price_offer,
)
from app.services.regression import (
    adjust_insights_for_applied_flex,
    build_member_insights,
    churn_probability_pct,
    linear_slope,
)
from app.services.value_projection import (
    flex_worth_recommending,
    projection_from_breakdown,
)


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
    assert sarah["expected_quit_months"] > 0
    assert sarah["expected_flex_months"] > sarah["expected_quit_months"]
    assert sarah["expected_quit_months"] != marcus["expected_quit_months"]
    # Survival tenure: 69% 60-day churn → ~1.7 mo (not the old 24×(1−P) ≈ 7 mo)
    quit_69 = expected_quit_months_float(churn_probability_pct=69)
    flex_69 = expected_flex_months_float(churn_probability_pct=69)
    assert 1.5 <= quit_69 <= 2.5, f"69% quit months expected ~1.7–2, got {quit_69}"
    assert flex_69 > quit_69
    assert expected_quit_months_float(churn_probability_pct=90) <= 1.5
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

    vp = projection_from_breakdown(
        risk_tier="critical",
        offer_slug="hold_plan",
        offer_type="plan_switch",
        breakdown=sarah,
    )
    vp_marcus = projection_from_breakdown(
        risk_tier="slipping",
        offer_slug="hold_plan",
        offer_type="plan_switch",
        breakdown=marcus,
    )
    assert vp["series"]
    assert vp["current_plan_monthly_cents"] == MONTHLY_FULL_CENTS
    assert "/wk" in vp["flex_plan_label"]
    assert vp["improvement_cents"] == vp["flex_total_cents"] - vp["current_total_cents"]
    assert vp_marcus["improvement_cents"] == (
        vp_marcus["flex_total_cents"] - vp_marcus["current_total_cents"]
    )
    assert vp["improvement_cents"] != vp_marcus["improvement_cents"]
    last = vp["series"][-1]
    assert last["current_cumulative_cents"] == vp["current_total_cents"]
    assert last["flex_cumulative_cents"] == vp["flex_total_cents"]
    last_m = vp_marcus["series"][-1]
    assert last_m["current_cumulative_cents"] == vp_marcus["current_total_cents"]
    assert last_m["flex_cumulative_cents"] == vp_marcus["flex_total_cents"]

    assert flex_worth_recommending({"improvement_cents": 1200}) is True
    assert flex_worth_recommending({"improvement_cents": 0}) is False
    assert flex_worth_recommending({"improvement_cents": -4800}) is False
    assert flex_worth_recommending(None) is False
    assert flex_worth_recommending(vp) is (vp["improvement_cents"] > 0)

    # Post-flex churn from survival inverse of flex tenure (80% → ~28%)
    post_flex_80 = churn_probability_after_flex(baseline_churn_pct=80)
    assert post_flex_80 == 28, f"expected 28% post-flex for 80% baseline, got {post_flex_80}"
    assert post_flex_80 < 80
    post_flex_slip = churn_probability_after_flex(baseline_churn_pct=slip)
    assert post_flex_slip < slip

    adjusted = adjust_insights_for_applied_flex(
        insights_c,
        baseline_churn_pct=80,
        membership_plan="flex",
    )
    assert adjusted["churn_probability_baseline"] == 80
    assert adjusted["churn_probability"] == 28
    assert adjusted["churn_trend_label"] == "Stabilized with flex"
    assert adjusted["ltv_cents"] > insights_c["ltv_cents"]
    assert adjusted["risk_exposure_cents"] < insights_c["risk_exposure_cents"]

    print(
        f"OK critical={crit}% slipping={slip}% healthy={healthy}% "
        f"sarah={sarah['base_weekly_cents']}c/wk+{sarah['per_entry_cents']}c "
        f"cap={sarah['max_cap_weekly_cents']}c "
        f"marcus={marcus['base_weekly_cents']}c/wk+{marcus['per_entry_cents']}c "
        f"cap={marcus['max_cap_weekly_cents']}c "
        f"sarah_imp={vp['improvement_cents']} marcus_imp={vp_marcus['improvement_cents']}"
    )


if __name__ == "__main__":
    main()
