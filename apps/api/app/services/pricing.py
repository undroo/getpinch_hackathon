"""Per-member flex pricing: weekly base + per-entry with a weekly max cap."""

from __future__ import annotations

from typing import Any, Literal

from app.services.regression import (
    HEALTHY_LTV_MONTHS,
    MONTHLY_FULL_CENTS,
    WEEKLY_FULL_CENTS,
)

AmountKind = Literal["base_plus_entry"]

WEEKLY_CENTS = WEEKLY_FULL_CENTS  # $30/week unlimited reference (also min max-cap)
RETENTION_LIFT = 0.45

# Weekly base bounds (casual flex, not flat monthly)
BASE_MIN_CENTS = 1000  # $10/wk
BASE_MAX_CENTS = 2000  # $20/wk
ENTRY_MIN_CENTS = 200  # $2/visit
ENTRY_MAX_CENTS = 800  # $8/visit
CAP_MAX_CENTS = 5000  # $50/wk hard ceiling


def _clamp_int(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


def _clamp_float(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _round_dollars(cents: float) -> int:
    """Round to nearest whole dollar in cents."""
    return int(round(cents / 100.0)) * 100


def _churn_fraction(churn_probability_pct: int) -> float:
    return _clamp_int(churn_probability_pct, 5, 95) / 100.0


def expected_quit_months_float(*, churn_probability_pct: int) -> float:
    """Fractional expected tenure on full price before quit (no integer rounding)."""
    p = _churn_fraction(churn_probability_pct)
    return max(1.0, min(float(HEALTHY_LTV_MONTHS), HEALTHY_LTV_MONTHS * (1.0 - p)))


def expected_flex_months_float(*, churn_probability_pct: int) -> float:
    """Fractional expected tenure on flex path with retention lift, capped at 12 months."""
    quit_months = expected_quit_months_float(churn_probability_pct=churn_probability_pct)
    flex_months = quit_months + (HEALTHY_LTV_MONTHS - quit_months) * RETENTION_LIFT
    return max(quit_months + 1.0, min(12.0, flex_months))


def estimate_quit_and_retention(*, churn_probability_pct: int) -> tuple[int, int]:
    """Return (months_to_quit, flex_retention_months) for UI labels."""
    quit_float = expected_quit_months_float(churn_probability_pct=churn_probability_pct)
    flex_float = expected_flex_months_float(churn_probability_pct=churn_probability_pct)
    months_to_quit = max(1, min(12, round(quit_float)))
    flex_retention_months = max(months_to_quit + 1, min(12, round(flex_float)))
    return months_to_quit, flex_retention_months


def churn_probability_after_flex(*, baseline_churn_pct: int) -> int:
    """Derive post-intervention churn from retention lift used in flex pricing."""
    _, flex_retention_months = estimate_quit_and_retention(
        churn_probability_pct=baseline_churn_pct,
    )
    p_flex = 1.0 - flex_retention_months / HEALTHY_LTV_MONTHS
    return _clamp_int(int(round(p_flex * 100)), 5, 95)


def _weekly_bill(
    *,
    base_weekly_cents: int,
    per_entry_cents: int,
    visits: int,
    max_cap_weekly_cents: int,
) -> int:
    uncapped = base_weekly_cents + max(0, visits) * per_entry_cents
    return min(uncapped, max_cap_weekly_cents)


def price_offer(
    *,
    churn_probability_pct: int,
    membership_plan: str,
    offer_slug: str,
    visits_30d: int = 0,
    risk_tier: str = "critical",
) -> dict[str, Any]:
    """Compute weekly flex base + per-entry + max cap (cap ≥ $30/week)."""
    del membership_plan  # unlimited anchor is $30/week
    p = _clamp_int(churn_probability_pct, 5, 95) / 100.0
    months_to_quit, flex_retention_months = estimate_quit_and_retention(
        churn_probability_pct=churn_probability_pct,
    )

    # Higher churn → lower weekly base, fewer break-even visits (more casual-tilted)
    base_pct = _clamp_float(0.55 - 0.25 * p, 0.35, 0.55)
    break_even_visits = _clamp_int(round(4 - 1.5 * p), 2, 4)

    base_weekly_cents = _clamp_int(
        _round_dollars(WEEKLY_CENTS * base_pct),
        BASE_MIN_CENTS,
        BASE_MAX_CENTS,
    )
    per_entry_cents = _clamp_int(
        int(round((WEEKLY_CENTS - base_weekly_cents) / break_even_visits)),
        ENTRY_MIN_CENTS,
        ENTRY_MAX_CENTS,
    )

    # Max weekly cap: always ≥ unlimited $30/wk so power users never beat standard rate.
    # Slight headroom above $30 so frequent visitors hit the ceiling above unlimited.
    cap_raw = WEEKLY_CENTS * (1.15 + 0.20 * (1.0 - p))
    max_cap_weekly_cents = _clamp_int(
        _round_dollars(cap_raw),
        WEEKLY_CENTS,  # never below standard $30/week
        CAP_MAX_CENTS,
    )

    # Expected visits per week from 30d check-ins (casual cadence)
    default_weekly = 1 if risk_tier == "critical" else 2
    if visits_30d and visits_30d > 0:
        raw_weekly = max(1, round(visits_30d / 4.0))
    else:
        raw_weekly = default_weekly
    # Allow actual visit cadence up to break-even (not capped to break_even - 1)
    expected_visits = _clamp_int(raw_weekly, 1, max(break_even_visits, 6))
    expected_quit_months = expected_quit_months_float(
        churn_probability_pct=churn_probability_pct
    )
    expected_flex_months = expected_flex_months_float(
        churn_probability_pct=churn_probability_pct
    )

    estimated_weekly_cents = _weekly_bill(
        base_weekly_cents=base_weekly_cents,
        per_entry_cents=per_entry_cents,
        visits=expected_visits,
        max_cap_weekly_cents=max_cap_weekly_cents,
    )
    estimated_monthly_cents = round(estimated_weekly_cents * 52 / 12)

    formula = (
        "weekly: min(base + visits × per_entry, max_cap); max_cap ≥ $30/week unlimited"
    )
    explanation = (
        f"Unlimited is ${WEEKLY_CENTS / 100:.0f}/week. "
        f"Flex ${base_weekly_cents / 100:.0f}/week + ${per_entry_cents / 100:.0f}/visit "
        f"(capped at ${max_cap_weekly_cents / 100:.0f}/week). "
        f"At {expected_visits} visit{'s' if expected_visits != 1 else ''}/week ≈ "
        f"${estimated_weekly_cents / 100:.0f}/week — cheaper than unlimited under "
        f"{break_even_visits} visits/week. "
        f"Expected to leave in {months_to_quit} month"
        f"{'s' if months_to_quit != 1 else ''}; flex keeps them ~{flex_retention_months} months."
    )

    return {
        # Primary amount is weekly estimated bill (capped)
        "amount_cents": estimated_weekly_cents,
        "amount_kind": "base_plus_entry",
        "base_cents": base_weekly_cents,  # weekly base (UI: /wk)
        "base_weekly_cents": base_weekly_cents,
        "per_entry_cents": per_entry_cents,
        "max_cap_weekly_cents": max_cap_weekly_cents,
        "expected_visits": expected_visits,  # per week
        "expected_visits_per_week": expected_visits,
        "estimated_weekly_cents": estimated_weekly_cents,
        "estimated_monthly_cents": estimated_monthly_cents,
        "break_even_visits": break_even_visits,  # per week
        "weekly_rate_cents": WEEKLY_CENTS,
        "months_to_quit": months_to_quit,
        "flex_retention_months": flex_retention_months,
        "expected_quit_months": round(expected_quit_months, 4),
        "expected_flex_months": round(expected_flex_months, 4),
        "current_monthly_cents": MONTHLY_FULL_CENTS,
        "formula": formula,
        "explanation": explanation,
        "inputs": {
            "churn_probability_pct": int(churn_probability_pct),
            "visits_30d": int(visits_30d or 0),
            "risk_tier": risk_tier,
            "offer_slug": offer_slug,
        },
    }
