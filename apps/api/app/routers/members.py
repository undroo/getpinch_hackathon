from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.services.flex_performance import compute_flex_performance
from app.services.intervention_state import fetch_active_intervention
from app.services.pricing import price_offer
from app.services.regression import adjust_insights_for_applied_flex, build_member_insights
from app.services.scorer import OFFER_BY_TIER, compute_risk_tier, tier_severity
from app.services.value_projection import (
    flex_worth_recommending,
    projection_for_offer,
    projection_from_breakdown,
)

router = APIRouter(prefix="/members", tags=["members"])

# Shared metrics: distinct calendar days in 30d; never-checked-in uses days since joined_at.
_VISITS_30D_EXPR = """
  COALESCE(
    (
      SELECT COUNT(DISTINCT ci.checked_in_at::date)::int
      FROM check_ins ci
      WHERE ci.member_id = m.id
        AND ci.checked_in_at >= now() - interval '30 days'
    ),
    0
  )
"""

_HAS_ACTIVE_FLEX = """
  EXISTS (
    SELECT 1
    FROM interventions i
    WHERE i.member_id = m.id
      AND i.status = 'applied'
  )
"""

_MEMBER_METRICS_SELECT = f"""
SELECT
  m.id,
  m.name,
  m.email,
  m.phone,
  m.pinch_payer_id,
  CASE
    WHEN {_HAS_ACTIVE_FLEX} THEN 'flex'
    ELSE m.membership_plan
  END AS membership_plan,
  m.status,
  m.joined_at,
  {_VISITS_30D_EXPR} AS visits_30d,
  COALESCE(
    (
      SELECT EXTRACT(day FROM now() - MAX(ci.checked_in_at))::int
      FROM check_ins ci
      WHERE ci.member_id = m.id
    ),
    EXTRACT(day FROM now() - m.joined_at)::int
  ) AS days_since_last_visit
FROM members m
"""

_COHORT_VISITS_SELECT = f"""
SELECT {_VISITS_30D_EXPR} AS visits_30d
FROM members m
"""


async def _member_metrics(conn: asyncpg.Connection, member_id: str) -> tuple[int, int]:
    row = await conn.fetchrow(
        _MEMBER_METRICS_SELECT + " WHERE m.id = $1",
        member_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return int(row["visits_30d"]), int(row["days_since_last_visit"])


@router.get("")
async def list_members(
    conn: asyncpg.Connection = Depends(get_db),
    risk_tier: str | None = None,
    sort: str = "severity",
) -> dict:
    rows = await conn.fetch(_MEMBER_METRICS_SELECT + " ORDER BY m.name")

    members = []
    summary = {"healthy": 0, "slipping": 0, "critical": 0, "unknown": 0, "watch": 0}

    for row in rows:
        visits_30d = int(row["visits_30d"])
        days_since = int(row["days_since_last_visit"])
        tier = compute_risk_tier(
            joined_at=row["joined_at"],
            visits_30d=visits_30d,
            days_since_last_visit=days_since,
        )
        if tier in summary:
            summary[tier] += 1

        if risk_tier and tier != risk_tier:
            continue

        members.append(
            {
                "id": str(row["id"]),
                "name": row["name"],
                "email": row["email"],
                "phone": row["phone"],
                "pinch_payer_id": row["pinch_payer_id"],
                "membership_plan": row["membership_plan"],
                "status": row["status"],
                "joined_at": row["joined_at"].isoformat(),
                "risk_tier": tier,
                "visits_30d": visits_30d,
                "days_since_last_visit": days_since,
            }
        )

    if sort == "severity":
        members.sort(key=lambda m: (tier_severity(m["risk_tier"]), m["name"]))
    elif sort == "last_visit":
        members.sort(key=lambda m: (-m["days_since_last_visit"], m["name"]))
    elif sort == "name":
        members.sort(key=lambda m: m["name"])

    return {"summary": summary, "members": members}


@router.get("/{member_id}")
async def get_member(member_id: str, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    row = await conn.fetchrow(
        _MEMBER_METRICS_SELECT + " WHERE m.id = $1",
        member_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    visits_30d = int(row["visits_30d"])
    days_since = int(row["days_since_last_visit"])
    tier = compute_risk_tier(
        joined_at=row["joined_at"],
        visits_30d=visits_30d,
        days_since_last_visit=days_since,
    )

    check_ins = await conn.fetch(
        """
        SELECT checked_in_at, source
        FROM check_ins
        WHERE member_id = $1 AND checked_in_at >= now() - interval '90 days'
        ORDER BY checked_in_at DESC
        """,
        member_id,
    )

    cohort_rows = await conn.fetch(_COHORT_VISITS_SELECT)
    cohort_visits = [int(r["visits_30d"]) for r in cohort_rows]
    check_in_dates = [ci["checked_in_at"] for ci in check_ins]

    insights = build_member_insights(
        joined_at=row["joined_at"],
        visits_30d=visits_30d,
        days_since_last_visit=days_since,
        risk_tier=tier,
        check_in_dates=check_in_dates,
        pinch_payer_id=row["pinch_payer_id"],
        cohort_visits_30d=cohort_visits,
        membership_plan=row["membership_plan"] or "standard",
    )

    active_intervention = await fetch_active_intervention(conn, member_id)

    suggested_offer = None
    value_projection = None
    pricing_breakdown = None
    flex_performance = None
    membership_plan = row["membership_plan"] or "standard"
    if active_intervention:
        pricing_breakdown = active_intervention.get("pricing_breakdown")
        if isinstance(pricing_breakdown, dict):
            offer_slug = active_intervention.get("offer_slug") or "hold_plan"
            offer_type = active_intervention.get("offer_type") or "plan_switch"
            value_projection = projection_from_breakdown(
                risk_tier=tier,
                offer_slug=offer_slug,
                offer_type=offer_type,
                breakdown=pricing_breakdown,
            )
        else:
            value_projection = active_intervention.get("value_projection")
        if active_intervention.get("status") == "applied":
            applied_at_raw = active_intervention.get("accepted_at") or active_intervention[
                "applied_at"
            ]
            applied_at = (
                datetime.fromisoformat(applied_at_raw)
                if isinstance(applied_at_raw, str)
                else applied_at_raw
            )
            visits_since_apply = await conn.fetchval(
                """
                SELECT COUNT(DISTINCT checked_in_at::date)::int
                FROM check_ins
                WHERE member_id = $1
                  AND checked_in_at >= $2
                """,
                member_id,
                applied_at,
            )
            flex_performance = compute_flex_performance(
                applied_at=applied_at,
                visits_since_apply=int(visits_since_apply or 0),
                pricing_breakdown=(
                    pricing_breakdown if isinstance(pricing_breakdown, dict) else None
                ),
            )
            if isinstance(pricing_breakdown, dict):
                inputs = pricing_breakdown.get("inputs") or {}
                baseline_churn = inputs.get("churn_probability_pct")
                if baseline_churn is not None:
                    insights = adjust_insights_for_applied_flex(
                        insights,
                        baseline_churn_pct=int(baseline_churn),
                        membership_plan=membership_plan,
                    )
                else:
                    insights = adjust_insights_for_applied_flex(
                        insights,
                        baseline_churn_pct=int(insights["churn_probability"]),
                        membership_plan=membership_plan,
                    )
    offer_slug = OFFER_BY_TIER.get(tier)
    if offer_slug and not active_intervention:
        offer_row = await conn.fetchrow(
            """
            SELECT slug, name, description, offer_type
            FROM retention_offers WHERE slug = $1
            """,
            offer_slug,
        )
        if offer_row:
            pricing_breakdown = price_offer(
                churn_probability_pct=int(insights["churn_probability"]),
                membership_plan=membership_plan,
                offer_slug=offer_row["slug"],
                visits_30d=visits_30d,
                risk_tier=tier,
            )
            suggested_offer = {
                "slug": offer_row["slug"],
                "name": "Flex Plan",
                "description": (
                    "Casual flex: weekly base plus per-visit charge with a weekly max cap "
                    "(never below $30/week unlimited)."
                ),
                "offer_type": offer_row["offer_type"],
                "amount_cents": pricing_breakdown["amount_cents"],
            }
            value_projection = projection_for_offer(
                risk_tier=tier,
                offer_slug=offer_row["slug"],
                offer_type=offer_row["offer_type"],
                amount_cents=pricing_breakdown["amount_cents"],
                current_monthly_cents=pricing_breakdown["current_monthly_cents"],
                months_to_quit=pricing_breakdown["months_to_quit"],
                flex_retention_months=pricing_breakdown["flex_retention_months"],
                base_cents=pricing_breakdown["base_weekly_cents"],
                per_entry_cents=pricing_breakdown["per_entry_cents"],
                expected_visits=pricing_breakdown["expected_visits_per_week"],
                max_cap_weekly_cents=pricing_breakdown["max_cap_weekly_cents"],
                estimated_weekly_cents=pricing_breakdown["estimated_weekly_cents"],
                churn_probability_pct=int(insights["churn_probability"]),
                expected_quit_months=pricing_breakdown.get("expected_quit_months"),
                expected_flex_months=pricing_breakdown.get("expected_flex_months"),
            )
            if not flex_worth_recommending(value_projection):
                suggested_offer = None

    return {
        "member": {
            "id": str(row["id"]),
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "pinch_payer_id": row["pinch_payer_id"],
            "membership_plan": row["membership_plan"],
            "status": row["status"],
            "joined_at": row["joined_at"].isoformat(),
        },
        "risk": {
            "tier": tier,
            "visits_30d": visits_30d,
            "days_since_last_visit": days_since,
        },
        "check_ins": [
            {"checked_in_at": ci["checked_in_at"].isoformat(), "source": ci["source"]}
            for ci in check_ins
        ],
        "suggested_offer": suggested_offer,
        "active_intervention": active_intervention,
        "pricing_breakdown": pricing_breakdown,
        "insights": insights,
        "value_projection": value_projection,
        "flex_performance": flex_performance,
    }


@router.post("/{member_id}/score")
async def score_member(member_id: str, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    row = await conn.fetchrow("SELECT joined_at FROM members WHERE id = $1", member_id)
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    visits_30d, days_since = await _member_metrics(conn, member_id)
    tier = compute_risk_tier(
        joined_at=row["joined_at"],
        visits_30d=visits_30d,
        days_since_last_visit=days_since,
    )

    await conn.execute(
        """
        INSERT INTO risk_snapshots (member_id, tier, visits_30d, days_since_last_visit)
        VALUES ($1, $2, $3, $4)
        """,
        member_id,
        tier,
        visits_30d,
        days_since,
    )

    return {"tier": tier, "visits_30d": visits_30d, "days_since_last_visit": days_since}
