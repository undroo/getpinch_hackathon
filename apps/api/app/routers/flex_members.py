from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends

from app.db import get_db
from app.services.flex_performance import compute_flex_performance
from app.services.intervention_state import serialize_active_intervention
from app.services.scorer import compute_risk_tier

router = APIRouter(prefix="/flex-members", tags=["flex-members"])

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

_FLEX_PIPELINE_SQL = f"""
SELECT DISTINCT ON (m.id)
  m.id,
  m.name,
  m.email,
  m.joined_at,
  {_VISITS_30D_EXPR} AS visits_30d,
  COALESCE(
    (
      SELECT EXTRACT(day FROM now() - MAX(ci.checked_in_at))::int
      FROM check_ins ci
      WHERE ci.member_id = m.id
    ),
    EXTRACT(day FROM now() - m.joined_at)::int
  ) AS days_since_last_visit,
  i.id AS intervention_id,
  i.status,
  i.status AS intervention_status,
  i.created_at,
  i.accepted_at,
  i.offer_token,
  i.pinch_response,
  o.slug AS offer_slug,
  o.name AS offer_name,
  o.offer_type
FROM members m
JOIN interventions i ON i.member_id = m.id AND i.status IN ('offered', 'applied')
JOIN retention_offers o ON o.id = i.offer_id
ORDER BY
  m.id,
  CASE i.status WHEN 'applied' THEN 0 WHEN 'offered' THEN 1 ELSE 2 END,
  i.created_at DESC
"""


def _date_sort_key(iso: str | None) -> str:
    return iso or ""


@router.get("")
async def list_flex_members(conn: asyncpg.Connection = Depends(get_db)) -> dict:
    rows = await conn.fetch(_FLEX_PIPELINE_SQL)

    members: list[dict] = []
    active_count = 0
    pending_count = 0
    retained_value_cents = 0

    for r in rows:
        visits_30d = int(r["visits_30d"])
        days_since = int(r["days_since_last_visit"])
        tier = compute_risk_tier(
            joined_at=r["joined_at"],
            visits_30d=visits_30d,
            days_since_last_visit=days_since,
        )

        intervention = serialize_active_intervention(r)
        status = r["intervention_status"]
        pricing_breakdown = intervention.get("pricing_breakdown")
        value_projection = intervention.get("value_projection")

        flex_performance = None
        if status == "applied":
            active_count += 1
            if value_projection and value_projection.get("improvement_cents"):
                retained_value_cents += int(value_projection["improvement_cents"])

            applied_at_raw = intervention.get("accepted_at") or intervention.get(
                "applied_at"
            )
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
                str(r["id"]),
                applied_at,
            )
            flex_performance = compute_flex_performance(
                applied_at=applied_at,
                visits_since_apply=int(visits_since_apply or 0),
                pricing_breakdown=(
                    pricing_breakdown if isinstance(pricing_breakdown, dict) else None
                ),
            )
        else:
            pending_count += 1

        members.append(
            {
                "id": str(r["id"]),
                "name": r["name"],
                "email": r["email"],
                "risk_tier": tier,
                "visits_30d": visits_30d,
                "days_since_last_visit": days_since,
                "intervention_status": status,
                "intervention_id": str(r["intervention_id"]),
                "offer_url": intervention.get("offer_url"),
                "accepted_at": intervention.get("accepted_at"),
                "created_at": r["created_at"].isoformat(),
                "pricing_breakdown": pricing_breakdown,
                "value_projection": value_projection,
                "flex_performance": flex_performance,
            }
        )

    applied = [m for m in members if m["intervention_status"] == "applied"]
    pending = [m for m in members if m["intervention_status"] == "offered"]
    applied.sort(
        key=lambda m: _date_sort_key(m.get("accepted_at") or m["created_at"]),
        reverse=True,
    )
    pending.sort(key=lambda m: _date_sort_key(m["created_at"]), reverse=True)
    members = applied + pending

    return {
        "summary": {
            "total": len(members),
            "active": active_count,
            "pending": pending_count,
            "retained_value_cents": retained_value_cents if active_count > 0 else None,
        },
        "members": members,
    }
