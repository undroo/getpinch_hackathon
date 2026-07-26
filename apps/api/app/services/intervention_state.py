"""Shared helpers for active / pending flex-plan intervention state."""

from __future__ import annotations

import json
from typing import Any

import asyncpg

from app.config import settings


def parse_pinch_response(raw: Any) -> dict[str, Any] | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def extract_pinch_subscription_id(pinch_response: dict[str, Any] | None) -> str | None:
    if not pinch_response:
        return None
    subscription = pinch_response.get("subscription")
    if isinstance(subscription, dict) and subscription.get("id"):
        return str(subscription["id"])
    sub_id = pinch_response.get("pinch_subscription_id")
    return str(sub_id) if sub_id else None


def extract_payment_link_url(pinch_response: dict[str, Any] | None) -> str | None:
    if not pinch_response:
        return None
    url = (
        pinch_response.get("payment_link_url")
        or pinch_response.get("url")
        or pinch_response.get("paymentLinkUrl")
    )
    return str(url) if url else None


def serialize_active_intervention(row: asyncpg.Record) -> dict[str, Any]:
    pinch_response = parse_pinch_response(row["pinch_response"])
    pricing_breakdown = None
    value_projection = None
    if pinch_response:
        stored_breakdown = pinch_response.get("pricing_breakdown")
        if isinstance(stored_breakdown, dict):
            pricing_breakdown = stored_breakdown
        stored_projection = pinch_response.get("value_projection")
        if isinstance(stored_projection, dict):
            value_projection = stored_projection

    offer_token = row.get("offer_token")
    offer_url = None
    if offer_token:
        offer_url = settings.offer_url(str(offer_token))
    elif pinch_response and pinch_response.get("offer_url"):
        offer_url = str(pinch_response["offer_url"])

    return {
        "id": str(row["id"]),
        "offer_slug": row["offer_slug"],
        "offer_name": "Flex Plan",
        "offer_type": row["offer_type"],
        "status": row["status"],
        "applied_at": row["created_at"].isoformat(),
        "accepted_at": row["accepted_at"].isoformat() if row.get("accepted_at") else None,
        "offer_token": str(offer_token) if offer_token else None,
        "offer_url": offer_url,
        "payment_link_url": extract_payment_link_url(pinch_response),
        "pinch_subscription_id": extract_pinch_subscription_id(pinch_response),
        "pricing_breakdown": pricing_breakdown,
        "value_projection": value_projection,
    }


_BLOCKING_INTERVENTION_SQL = """
SELECT
  i.id,
  i.status,
  i.created_at,
  i.accepted_at,
  i.offer_token,
  i.pinch_response,
  o.slug AS offer_slug,
  o.name AS offer_name,
  o.offer_type
FROM interventions i
JOIN retention_offers o ON o.id = i.offer_id
WHERE i.member_id = $1
  AND i.status IN ('offered', 'applied')
ORDER BY
  CASE i.status WHEN 'applied' THEN 0 WHEN 'offered' THEN 1 ELSE 2 END,
  i.created_at DESC
LIMIT 1
"""


async def fetch_active_intervention(
    conn: asyncpg.Connection,
    member_id: str,
) -> dict[str, Any] | None:
    """Return the latest offered or applied intervention for a member."""
    row = await conn.fetchrow(_BLOCKING_INTERVENTION_SQL, member_id)
    if not row:
        return None
    return serialize_active_intervention(row)


async def fetch_blocking_intervention(
    conn: asyncpg.Connection,
    member_id: str,
) -> dict[str, Any] | None:
    """Alias for send-guard: offered or applied blocks a new send."""
    return await fetch_active_intervention(conn, member_id)
