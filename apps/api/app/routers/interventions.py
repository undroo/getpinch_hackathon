import json
import secrets
from datetime import UTC, datetime
from typing import Any, Literal

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.services.intervention_state import fetch_blocking_intervention
from app.services.pinch_client import PinchAuthError, PinchClient
from app.services.pricing import price_offer
from app.services.regression import (
    churn_probability_pct,
    linear_slope,
    weekly_visit_buckets,
)
from app.services.scorer import compute_risk_tier
from app.services.value_projection import (
    flex_worth_recommending,
    projection_from_breakdown,
)

router = APIRouter(prefix="/members", tags=["interventions"])
offers_router = APIRouter(prefix="/offers", tags=["offers"])


class PreviewInterventionRequest(BaseModel):
    offer_slug: str


class ApplyInterventionRequest(BaseModel):
    offer_slug: str
    confirmed: bool = False


class VaultOfferSourceRequest(BaseModel):
    token: str
    source_type: Literal["credit-card", "bank-account"]


def _coerce_payment_date(value: Any) -> str:
    if value is None:
        return "After you confirm"
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "n/a", "na", "undefined", "—", "-"}:
        return "After you confirm"
    return text


def _first_payment_date_from_preview(preview: Any) -> str | None:
    """First scheduled payment date from Pinch calculated-payments preview."""
    if not isinstance(preview, dict):
        return None
    payments = (
        preview.get("data")
        or preview.get("payments")
        or preview.get("calculatedPayments")
    )
    if not isinstance(payments, list) or not payments:
        return None
    first = payments[0]
    if not isinstance(first, dict):
        return None
    raw = first.get("paymentDate") or first.get("date") or first.get("payment_date")
    if not raw:
        return None
    text = str(raw).strip()
    if "T" in text:
        return text.split("T", 1)[0]
    return text[:10] if len(text) >= 10 else text


def _normalize_plan_preview(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract display fields from Pinch calculated-payments payloads."""
    amount = (
        raw.get("next_payment_amount_cents")
        or raw.get("nextPaymentAmount")
        or raw.get("amount")
        or raw.get("totalAmount")
    )
    date = (
        raw.get("next_payment_date")
        or raw.get("nextPaymentDate")
        or raw.get("date")
        or raw.get("paymentDate")
    )

    payments = raw.get("payments") or raw.get("calculatedPayments") or raw.get("data")
    if isinstance(payments, list) and payments:
        first = payments[0]
        if isinstance(first, dict):
            amount = amount or first.get("amount") or first.get("totalAmount")
            date = date or first.get("date") or first.get("paymentDate")

    return {
        "next_payment_amount_cents": amount,
        "next_payment_date": _coerce_payment_date(date),
        "raw": raw,
    }


async def _load_member_and_offer(
    conn: asyncpg.Connection, member_id: str, offer_slug: str
) -> tuple[asyncpg.Record, asyncpg.Record]:
    member = await conn.fetchrow(
        """
        SELECT id, name, pinch_payer_id, membership_plan, joined_at
        FROM members WHERE id = $1
        """,
        member_id,
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if not _is_real_pinch_id(member["pinch_payer_id"]):
        raise HTTPException(status_code=400, detail="Pinch payer not linked for this member")

    offer = await conn.fetchrow(
        """
        SELECT id, slug, name, description, offer_type, pinch_plan_id, amount_cents
        FROM retention_offers WHERE slug = $1
        """,
        offer_slug,
    )
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return member, offer


def _is_real_pinch_id(value: str | None) -> bool:
    return bool(value) and not str(value).startswith("REPLACE_")


async def _resolve_hold_plan_id(conn: asyncpg.Connection, offer: asyncpg.Record) -> str:
    if offer["slug"] == "hold_plan":
        config = await conn.fetchrow("SELECT hold_plan_id FROM gym_config LIMIT 1")
        if config and _is_real_pinch_id(config["hold_plan_id"]):
            return config["hold_plan_id"]
    plan_id = offer["pinch_plan_id"]
    if _is_real_pinch_id(plan_id):
        return plan_id
    if settings.pinch_hold_plan_id:
        return settings.pinch_hold_plan_id
    raise HTTPException(status_code=400, detail="Pinch plan ID not configured")


async def _member_metrics_row(
    conn: asyncpg.Connection, member_id: str
) -> asyncpg.Record:
    row = await conn.fetchrow(
        """
        SELECT
          m.joined_at,
          m.membership_plan,
          COALESCE(
            (
              SELECT COUNT(DISTINCT ci.checked_in_at::date)::int
              FROM check_ins ci
              WHERE ci.member_id = m.id
                AND ci.checked_in_at >= now() - interval '30 days'
            ),
            0
          ) AS visits_30d,
          COALESCE(
            (
              SELECT EXTRACT(day FROM now() - MAX(ci.checked_in_at))::int
              FROM check_ins ci
              WHERE ci.member_id = m.id
            ),
            EXTRACT(day FROM now() - m.joined_at)::int
          ) AS days_since_last_visit
        FROM members m
        WHERE m.id = $1
        """,
        member_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return row


async def _churn_pct_for_member(conn: asyncpg.Connection, member_id: str) -> int:
    metrics = await _member_metrics_row(conn, member_id)
    check_ins = await conn.fetch(
        """
        SELECT checked_in_at
        FROM check_ins
        WHERE member_id = $1 AND checked_in_at >= now() - interval '90 days'
        ORDER BY checked_in_at DESC
        """,
        member_id,
    )
    now = datetime.now(UTC)
    joined_at = metrics["joined_at"]
    if joined_at.tzinfo is None:
        joined_at = joined_at.replace(tzinfo=UTC)
    tenure_days = max(0, (now - joined_at.astimezone(UTC)).days)
    weekly = weekly_visit_buckets(
        [ci["checked_in_at"] for ci in check_ins],
        now=now,
    )
    slope = linear_slope(weekly)
    return churn_probability_pct(
        days_since_last_visit=int(metrics["days_since_last_visit"]),
        visits_30d=int(metrics["visits_30d"]),
        visit_slope_90d=slope,
        tenure_days=tenure_days,
    )


async def _pricing_for_member_offer(
    conn: asyncpg.Connection,
    member_id: str,
    offer_slug: str,
    membership_plan: str | None = None,
) -> tuple[str, dict[str, Any]]:
    metrics = await _member_metrics_row(conn, member_id)
    visits_30d = int(metrics["visits_30d"])
    risk_tier = compute_risk_tier(
        joined_at=metrics["joined_at"],
        visits_30d=visits_30d,
        days_since_last_visit=int(metrics["days_since_last_visit"]),
    )
    plan = membership_plan or metrics["membership_plan"] or "standard"
    churn_pct = await _churn_pct_for_member(conn, member_id)
    breakdown = price_offer(
        churn_probability_pct=churn_pct,
        membership_plan=plan,
        offer_slug=offer_slug,
        visits_30d=visits_30d,
        risk_tier=risk_tier,
    )
    return risk_tier, breakdown


def _projection_from_breakdown(
    *,
    risk_tier: str,
    offer_slug: str,
    offer_type: str,
    breakdown: dict[str, Any],
) -> dict[str, Any]:
    return projection_from_breakdown(
        risk_tier=risk_tier,
        offer_slug=offer_slug,
        offer_type=offer_type,
        breakdown=breakdown,
    )


def _base_amount_cents(breakdown: dict[str, Any]) -> int:
    """Pinch subscription amount: weekly base × 4 as monthly approx for sandbox plans."""
    weekly = breakdown.get("base_weekly_cents", breakdown.get("base_cents"))
    if weekly is not None:
        return int(weekly) * 4
    if breakdown.get("estimated_weekly_cents") is not None:
        return int(breakdown["estimated_weekly_cents"]) * 4
    return int(breakdown["amount_cents"]) * 4


def _format_aud_short(cents: int) -> str:
    if cents % 100 == 0:
        return f"${cents // 100}"
    return f"${cents / 100:.2f}"


def _flex_weekly_range_label(breakdown: dict[str, Any]) -> str | None:
    base = breakdown.get("base_weekly_cents") or breakdown.get("base_cents")
    cap = breakdown.get("max_cap_weekly_cents")
    if base is None or cap is None:
        return None
    return f"{_format_aud_short(int(base))}–{_format_aud_short(int(cap))}/wk"


def _flex_payment_link_description(
    *,
    member_name: str,
    breakdown: dict[str, Any],
) -> str:
    """Shown on Pinch hosted checkout (credit card / bank account)."""
    range_label = _flex_weekly_range_label(breakdown)
    base = breakdown.get("base_weekly_cents") or breakdown.get("base_cents")
    per_entry = breakdown.get("per_entry_cents")
    first_name = (member_name or "Member").split()[0]
    if range_label and base is not None and per_entry is not None:
        return (
            f"Flex plan {range_label} "
            f"({_format_aud_short(int(base))}/wk + "
            f"{_format_aud_short(int(per_entry))}/visit). "
            f"Confirm payment method — {first_name}."
        )
    return f"RetainIQ+ Flex Plan — {first_name}"


def _flex_payment_link_metadata(breakdown: dict[str, Any]) -> str:
    payload = {
        "pricing_model": "flex_base_plus_entry",
        "base_weekly_cents": breakdown.get("base_weekly_cents")
        or breakdown.get("base_cents"),
        "per_entry_cents": breakdown.get("per_entry_cents"),
        "max_cap_weekly_cents": breakdown.get("max_cap_weekly_cents"),
        "estimated_weekly_cents": breakdown.get("estimated_weekly_cents"),
        "weekly_range_label": _flex_weekly_range_label(breakdown),
    }
    return json.dumps(payload, default=str)


@router.post("/{member_id}/interventions/preview")
async def preview_intervention(
    member_id: str,
    body: PreviewInterventionRequest,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    member, offer = await _load_member_and_offer(conn, member_id, body.offer_slug)
    risk_tier, pricing_breakdown = await _pricing_for_member_offer(
        conn,
        member_id,
        offer["slug"],
        membership_plan=member["membership_plan"],
    )
    base_cents = _base_amount_cents(pricing_breakdown)
    value_projection = _projection_from_breakdown(
        risk_tier=risk_tier,
        offer_slug=offer["slug"],
        offer_type=offer["offer_type"],
        breakdown=pricing_breakdown,
    )
    if not flex_worth_recommending(value_projection):
        raise HTTPException(
            status_code=400,
            detail="Flex plan does not improve 12-month expected value for this member.",
        )

    # MVP suggested path is flex plan_switch only — no one-off payment links.
    if offer["offer_type"] != "plan_switch":
        raise HTTPException(
            status_code=400,
            detail="MVP flex offers use plan switch only (base + per entry). "
            "One-off payment links are not suggested.",
        )

    if not settings.pinch_configured:
        return {
            "offer_slug": offer["slug"],
            "offer_type": offer["offer_type"],
            "next_payment_amount_cents": base_cents,
            "next_payment_date": "After member confirms",
            "raw": {"status": "demo"},
            "pricing_breakdown": pricing_breakdown,
            "value_projection": value_projection,
        }

    plan_id = await _resolve_hold_plan_id(conn, offer)
    pinch = PinchClient()
    try:
        # Pinch bills the base fee; pass recommended base when supported.
        raw = await pinch.preview_plan_payments(plan_id, total_amount=base_cents)
    except (httpx.HTTPError, PinchAuthError) as exc:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc
    normalized = _normalize_plan_preview(raw)
    pinch_amount = normalized.get("next_payment_amount_cents")
    normalized = {
        **normalized,
        "next_payment_amount_cents": base_cents,
        "recommended_amount_cents": base_cents,
        "recommended_base_cents": base_cents,
        "estimated_monthly_cents": pricing_breakdown["estimated_monthly_cents"],
    }
    if pinch_amount is not None:
        try:
            normalized["pinch_schedule_amount_cents"] = int(pinch_amount)
        except (TypeError, ValueError):
            pass
    return {
        "offer_slug": offer["slug"],
        "offer_type": offer["offer_type"],
        "next_payment_amount_cents": base_cents,
        "next_payment_date": normalized["next_payment_date"],
        "raw": normalized["raw"],
        "pricing_breakdown": pricing_breakdown,
        "value_projection": value_projection,
    }


def _find_active_subscription(subs_payload: dict) -> dict | None:
    items = subs_payload.get("data") or subs_payload.get("subscriptions") or subs_payload
    if isinstance(items, dict):
        items = items.get("items", [])
    if not isinstance(items, list):
        return None
    for sub in items:
        status = (sub.get("status") or "").lower()
        if status in ("active", "current", "in_progress", ""):
            return sub
    return items[0] if items else None


def _payment_link_url_from_payload(payload: dict[str, Any]) -> str | None:
    url = (
        payload.get("url")
        or payload.get("paymentLinkUrl")
        or payload.get("payment_link_url")
        or payload.get("hostedUrl")
    )
    if url:
        return str(url)
    data = payload.get("data")
    if isinstance(data, dict):
        nested = (
            data.get("url")
            or data.get("paymentLinkUrl")
            or data.get("payment_link_url")
        )
        if nested:
            return str(nested)
    return None


async def _switch_to_flex_plan(
    *,
    pinch: PinchClient,
    conn: asyncpg.Connection,
    member: asyncpg.Record,
    offer: asyncpg.Record,
) -> dict[str, Any]:
    """Cancel active subscription and recreate on hold/flex plan."""
    plan_id = await _resolve_hold_plan_id(conn, offer)
    subs = await pinch.list_payer_subscriptions(member["pinch_payer_id"])
    active_sub = _find_active_subscription(subs)
    if active_sub:
        await pinch.cancel_subscription(active_sub["id"])
    new_sub = await pinch.create_subscription(
        plan_id=plan_id,
        payer_id=member["pinch_payer_id"],
    )
    return new_sub if isinstance(new_sub, dict) else {"raw": new_sub}


@router.post("/{member_id}/interventions")
async def send_intervention(
    member_id: str,
    body: ApplyInterventionRequest,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Send a flex offer: status offered + tokenized link. No plan switch yet."""
    if not body.confirmed:
        raise HTTPException(status_code=400, detail="confirmed must be true to send offer")

    member, offer = await _load_member_and_offer(conn, member_id, body.offer_slug)
    risk_tier, pricing_breakdown = await _pricing_for_member_offer(
        conn,
        member_id,
        offer["slug"],
        membership_plan=member["membership_plan"],
    )
    if offer["offer_type"] != "plan_switch":
        raise HTTPException(
            status_code=400,
            detail="MVP flex offers use plan switch only (base + per entry). "
            "One-off payment links are not the product offer.",
        )

    base_cents = _base_amount_cents(pricing_breakdown)
    value_projection = _projection_from_breakdown(
        risk_tier=risk_tier,
        offer_slug=offer["slug"],
        offer_type=offer["offer_type"],
        breakdown=pricing_breakdown,
    )
    if not flex_worth_recommending(value_projection):
        raise HTTPException(
            status_code=400,
            detail="Flex plan does not improve 12-month expected value for this member.",
        )

    existing = await fetch_blocking_intervention(conn, member_id)
    if existing:
        detail = (
            "Flex plan already applied for this member"
            if existing.get("status") == "applied"
            else "Flex offer already sent for this member"
        )
        raise HTTPException(status_code=409, detail=detail)

    offer_token = secrets.token_urlsafe(24)
    offer_url = settings.offer_url(offer_token)
    return_url = settings.offer_return_url(offer_token)

    pinch = PinchClient()
    preview: dict[str, Any] = {}
    payment_link: dict[str, Any] = {}
    payment_link_url: str | None = None
    demo_mode = not settings.pinch_configured

    if demo_mode:
        # Allow UI/demo without Pinch credentials; confirm CTA hits complete directly.
        payment_link_url = return_url
        payment_link = {"url": return_url, "status": "demo"}
        preview = {
            "next_payment_amount_cents": base_cents,
            "next_payment_date": None,
            "status": "demo",
        }
    else:
        try:
            plan_id = await _resolve_hold_plan_id(conn, offer)
            preview = await pinch.preview_plan_payments(plan_id, total_amount=base_cents)
            payment_date = _first_payment_date_from_preview(preview)
            payment_link = await pinch.create_payment_link(
                amount_cents=base_cents,
                description=_flex_payment_link_description(
                    member_name=member["name"],
                    breakdown=pricing_breakdown,
                ),
                return_url=return_url,
                payer_id=member["pinch_payer_id"],
                metadata=_flex_payment_link_metadata(pricing_breakdown),
                payment_date=payment_date,
            )
        except HTTPException:
            raise
        except (httpx.HTTPError, PinchAuthError) as exc:
            await conn.execute(
                """
                INSERT INTO interventions (member_id, offer_id, status, pinch_response, created_by)
                VALUES ($1, $2, 'failed', $3::jsonb, 'demo_owner')
                """,
                member_id,
                offer["id"],
                json.dumps(
                    {
                        "error": str(exc),
                        "pricing_breakdown": pricing_breakdown,
                    },
                    default=str,
                ),
            )
            raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc
        except Exception as exc:
            await conn.execute(
                """
                INSERT INTO interventions (member_id, offer_id, status, pinch_response, created_by)
                VALUES ($1, $2, 'failed', $3::jsonb, 'demo_owner')
                """,
                member_id,
                offer["id"],
                json.dumps(
                    {
                        "error": str(exc),
                        "pricing_breakdown": pricing_breakdown,
                    },
                    default=str,
                ),
            )
            raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc

        payment_link_url = _payment_link_url_from_payload(
            payment_link if isinstance(payment_link, dict) else {}
        )

    normalized_preview = (
        _normalize_plan_preview(preview) if isinstance(preview, dict) else {}
    )
    if isinstance(normalized_preview, dict):
        normalized_preview = {
            **normalized_preview,
            "next_payment_amount_cents": base_cents,
            "recommended_amount_cents": base_cents,
            "recommended_base_cents": base_cents,
            "estimated_monthly_cents": pricing_breakdown["estimated_monthly_cents"],
        }

    pinch_response = {
        "preview": preview,
        "payment_link": payment_link,
        "payment_link_url": payment_link_url,
        "offer_url": offer_url,
        "offer_token": offer_token,
        "recommended_amount_cents": base_cents,
        "recommended_base_cents": base_cents,
        "pricing_breakdown": pricing_breakdown,
        "value_projection": value_projection,
        "demo_mode": demo_mode,
    }

    intervention_id = await conn.fetchval(
        """
        INSERT INTO interventions (
          member_id, offer_id, status, offer_token, pinch_response, created_by
        )
        VALUES ($1, $2, 'offered', $3, $4::jsonb, 'demo_owner')
        RETURNING id
        """,
        member_id,
        offer["id"],
        offer_token,
        json.dumps(pinch_response, default=str),
    )

    return {
        "intervention_id": str(intervention_id),
        "status": "offered",
        "offer_token": offer_token,
        "offer_url": offer_url,
        "payment_link_url": payment_link_url,
        "preview": normalized_preview,
        "amount_cents": pricing_breakdown["amount_cents"],
        "pricing_breakdown": pricing_breakdown,
        "value_projection": value_projection,
    }


@offers_router.get("/{token}")
async def get_offer_by_token(
    token: str,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Public member-safe offer payload for /offer/[token]."""
    row = await conn.fetchrow(
        """
        SELECT
          i.id,
          i.status,
          i.offer_token,
          i.pinch_response,
          i.accepted_at,
          m.id AS member_id,
          m.name AS member_name,
          m.pinch_payer_id,
          m.membership_plan,
          o.slug AS offer_slug,
          o.name AS offer_name,
          o.description AS offer_description
        FROM interventions i
        JOIN members m ON m.id = i.member_id
        JOIN retention_offers o ON o.id = i.offer_id
        WHERE i.offer_token = $1
        """,
        token,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Offer not found")

    pinch_response = _parse_pinch_response(row["pinch_response"])
    pricing_breakdown = _breakdown_from_pinch(pinch_response)
    if pricing_breakdown is None:
        _, pricing_breakdown = await _pricing_for_member_offer(
            conn,
            str(row["member_id"]),
            row["offer_slug"],
            membership_plan=row["membership_plan"],
        )

    demo_mode = not settings.pinch_configured or bool(
        (pinch_response or {}).get("demo_mode")
    )
    display_name = (row["member_name"] or "Member").split()[0]
    flex_range = (
        _flex_weekly_range_label(pricing_breakdown)
        if isinstance(pricing_breakdown, dict)
        else None
    )
    return {
        "offer_token": row["offer_token"],
        "status": row["status"],
        "member_display_name": display_name,
        "gym_name": settings.demo_gym_name,
        "offer_slug": row["offer_slug"],
        "offer_name": "Flex Plan",
        "flex_weekly_range_label": flex_range,
        "description": (
            f"Flex plan {flex_range} — weekly base plus per visit, capped so power "
            "users never beat unlimited."
            if flex_range
            else (
                "A casual flex plan: weekly base plus per-visit charge, with a weekly "
                "max cap so you never beat unlimited for power-user cadence."
            )
        ),
        "pricing_breakdown": pricing_breakdown,
        "capture_publishable_key": settings.pinch_publishable_key or None,
        "demo_mode": demo_mode,
        "accepted_at": row["accepted_at"].isoformat() if row["accepted_at"] else None,
    }


@offers_router.post("/{token}/vault-source")
async def vault_offer_source_by_token(
    token: str,
    body: VaultOfferSourceRequest,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Vault CaptureJS token as payer payment source before completing offer."""
    row = await conn.fetchrow(
        """
        SELECT
          i.id,
          i.status,
          i.pinch_response,
          m.pinch_payer_id
        FROM interventions i
        JOIN members m ON m.id = i.member_id
        WHERE i.offer_token = $1
        """,
        token,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Offer not found")
    if row["status"] != "offered":
        raise HTTPException(
            status_code=400,
            detail=f"Offer cannot vault payment source from status '{row['status']}'",
        )
    if not row["pinch_payer_id"] or not _is_real_pinch_id(row["pinch_payer_id"]):
        raise HTTPException(status_code=400, detail="Pinch payer not linked for this member")
    if not settings.pinch_configured:
        return {"source_id": f"src_demo_{token[:12]}", "demo_mode": True}

    pinch = PinchClient()
    try:
        source = await pinch.create_payer_source(
            row["pinch_payer_id"],
            token=body.token,
            source_type=body.source_type,
        )
    except (httpx.HTTPError, PinchAuthError) as exc:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc

    source_id = source.get("id") if isinstance(source, dict) else None
    existing = _parse_pinch_response(row["pinch_response"]) or {}
    await conn.execute(
        """
        UPDATE interventions
        SET pinch_response = $2::jsonb
        WHERE id = $1
        """,
        row["id"],
        json.dumps(
            {
                **existing,
                "vaulted_source": source,
                "vaulted_source_id": source_id,
            },
            default=str,
        ),
    )
    return {
        "source_id": str(source_id) if source_id else None,
        "demo_mode": False,
    }


@offers_router.post("/{token}/complete")
async def complete_offer_by_token(
    token: str,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """After Pinch return: plan-switch and mark offered → applied (idempotent)."""
    row = await conn.fetchrow(
        """
        SELECT
          i.id,
          i.status,
          i.offer_token,
          i.pinch_response,
          i.member_id,
          i.offer_id,
          m.id AS mid,
          m.name,
          m.pinch_payer_id,
          m.membership_plan,
          o.id AS oid,
          o.slug,
          o.name AS offer_name,
          o.description,
          o.offer_type,
          o.pinch_plan_id,
          o.amount_cents
        FROM interventions i
        JOIN members m ON m.id = i.member_id
        JOIN retention_offers o ON o.id = i.offer_id
        WHERE i.offer_token = $1
        """,
        token,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Offer not found")

    if row["status"] == "applied":
        pinch_response = _parse_pinch_response(row["pinch_response"])
        pinch_fields = _extract_pinch_fields(pinch_response)
        return {
            "intervention_id": str(row["id"]),
            "status": "applied",
            "offer_token": token,
            "pinch_subscription_id": pinch_fields["pinch_subscription_id"],
            "already_applied": True,
        }

    if row["status"] != "offered":
        raise HTTPException(
            status_code=400,
            detail=f"Offer cannot be completed from status '{row['status']}'",
        )

    if not row["pinch_payer_id"]:
        raise HTTPException(status_code=400, detail="Pinch payer not linked for this member")

    member = row  # has pinch_payer_id
    offer = row  # has pinch_plan_id / slug
    pinch = PinchClient()
    existing_response = _parse_pinch_response(row["pinch_response"]) or {}
    demo_mode = not settings.pinch_configured or bool(existing_response.get("demo_mode"))

    if demo_mode:
        new_sub = {
            "id": f"sub_demo_{token[:12]}",
            "status": "demo",
        }
    else:
        try:
            new_sub = await _switch_to_flex_plan(
                pinch=pinch,
                conn=conn,
                member=member,
                offer=offer,
            )
        except HTTPException:
            raise
        except (httpx.HTTPError, PinchAuthError) as exc:
            await conn.execute(
                """
                UPDATE interventions
                SET status = 'failed',
                    pinch_response = $2::jsonb
                WHERE id = $1
                """,
                row["id"],
                json.dumps(
                    {**existing_response, "complete_error": str(exc)},
                    default=str,
                ),
            )
            raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc
        except Exception as exc:
            await conn.execute(
                """
                UPDATE interventions
                SET status = 'failed',
                    pinch_response = $2::jsonb
                WHERE id = $1
                """,
                row["id"],
                json.dumps(
                    {**existing_response, "complete_error": str(exc)},
                    default=str,
                ),
            )
            raise HTTPException(status_code=502, detail=f"Pinch API error: {exc}") from exc

    updated_response = {
        **existing_response,
        "subscription": new_sub,
        "pinch_subscription_id": new_sub.get("id") if isinstance(new_sub, dict) else None,
        "demo_mode": demo_mode,
    }
    await conn.execute(
        """
        UPDATE interventions
        SET status = 'applied',
            accepted_at = now(),
            pinch_response = $2::jsonb
        WHERE id = $1
        """,
        row["id"],
        json.dumps(updated_response, default=str),
    )
    await conn.execute(
        """
        UPDATE members
        SET membership_plan = 'flex'
        WHERE id = $1
        """,
        row["member_id"],
    )

    return {
        "intervention_id": str(row["id"]),
        "status": "applied",
        "offer_token": token,
        "pinch_subscription_id": new_sub.get("id") if isinstance(new_sub, dict) else None,
        "already_applied": False,
    }


interventions_router = APIRouter(prefix="/interventions", tags=["interventions"])


def _parse_pinch_response(raw: Any) -> dict[str, Any] | None:
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


def _extract_pinch_fields(pinch_response: dict[str, Any] | None) -> dict[str, str | None]:
    if not pinch_response:
        return {
            "payment_link_url": None,
            "pinch_subscription_id": None,
            "error_message": None,
        }

    payment_link_url = (
        pinch_response.get("url")
        or pinch_response.get("paymentLinkUrl")
        or pinch_response.get("payment_link_url")
    )
    subscription = pinch_response.get("subscription")
    pinch_subscription_id = None
    if isinstance(subscription, dict):
        pinch_subscription_id = subscription.get("id")
    pinch_subscription_id = pinch_subscription_id or pinch_response.get(
        "pinch_subscription_id"
    )

    error_message = None
    if pinch_response.get("error"):
        error_message = str(pinch_response["error"])
    elif pinch_response.get("message") and pinch_response.get("status") == "demo":
        error_message = None

    return {
        "payment_link_url": str(payment_link_url) if payment_link_url else None,
        "pinch_subscription_id": str(pinch_subscription_id)
        if pinch_subscription_id
        else None,
        "error_message": error_message,
    }


def _breakdown_from_pinch(
    pinch_response: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not pinch_response:
        return None
    stored = pinch_response.get("pricing_breakdown")
    return stored if isinstance(stored, dict) else None


@interventions_router.get("")
async def list_interventions(conn: asyncpg.Connection = Depends(get_db)) -> dict:
    rows = await conn.fetch(
        """
        SELECT
          i.id,
          i.status,
          i.created_at,
          i.offer_token,
          i.accepted_at,
          i.pinch_response,
          m.id AS member_id,
          m.name AS member_name,
          m.joined_at,
          m.membership_plan,
          o.slug AS offer_slug,
          o.name AS offer_name,
          o.offer_type,
          COALESCE(
            (
              SELECT COUNT(DISTINCT ci.checked_in_at::date)::int
              FROM check_ins ci
              WHERE ci.member_id = m.id
                AND ci.checked_in_at >= now() - interval '30 days'
            ),
            0
          ) AS visits_30d,
          COALESCE(
            (
              SELECT EXTRACT(day FROM now() - MAX(ci.checked_in_at))::int
              FROM check_ins ci
              WHERE ci.member_id = m.id
            ),
            EXTRACT(day FROM now() - m.joined_at)::int
          ) AS days_since_last_visit
        FROM interventions i
        JOIN members m ON m.id = i.member_id
        JOIN retention_offers o ON o.id = i.offer_id
        ORDER BY i.created_at DESC
        LIMIT 100
        """
    )

    interventions = []
    for r in rows:
        pinch_response = _parse_pinch_response(r["pinch_response"])
        pinch_fields = _extract_pinch_fields(pinch_response)
        risk_tier = compute_risk_tier(
            joined_at=r["joined_at"],
            visits_30d=int(r["visits_30d"]),
            days_since_last_visit=int(r["days_since_last_visit"]),
        )

        pricing_breakdown = _breakdown_from_pinch(pinch_response)
        if pricing_breakdown is None:
            # Recompute for older interventions that lack a stored breakdown.
            check_ins = await conn.fetch(
                """
                SELECT checked_in_at
                FROM check_ins
                WHERE member_id = $1 AND checked_in_at >= now() - interval '90 days'
                """,
                r["member_id"],
            )
            now = datetime.now(UTC)
            joined_at = r["joined_at"]
            if joined_at.tzinfo is None:
                joined_at = joined_at.replace(tzinfo=UTC)
            tenure_days = max(0, (now - joined_at.astimezone(UTC)).days)
            weekly = weekly_visit_buckets(
                [ci["checked_in_at"] for ci in check_ins],
                now=now,
            )
            slope = linear_slope(weekly)
            churn_pct = churn_probability_pct(
                days_since_last_visit=int(r["days_since_last_visit"]),
                visits_30d=int(r["visits_30d"]),
                visit_slope_90d=slope,
                tenure_days=tenure_days,
            )
            pricing_breakdown = price_offer(
                churn_probability_pct=churn_pct,
                membership_plan=r["membership_plan"] or "standard",
                offer_slug=r["offer_slug"],
                visits_30d=int(r["visits_30d"]),
                risk_tier=risk_tier,
            )

        # Prefer recomputed projection from pricing breakdown (member-specific economics).
        stored_vp = None
        if pinch_response and isinstance(pinch_response.get("value_projection"), dict):
            stored_vp = pinch_response["value_projection"]

        value_projection = _projection_from_breakdown(
            risk_tier=risk_tier,
            offer_slug=r["offer_slug"],
            offer_type=r["offer_type"],
            breakdown=pricing_breakdown,
        ) if pricing_breakdown else stored_vp

        amount_cents = int(pricing_breakdown["amount_cents"])
        if pinch_response and pinch_response.get("recommended_amount_cents") is not None:
            try:
                amount_cents = int(pinch_response["recommended_amount_cents"])
            except (TypeError, ValueError):
                pass

        offer_token = r["offer_token"]
        offer_url = settings.offer_url(offer_token) if offer_token else None
        if not offer_url and pinch_response and pinch_response.get("offer_url"):
            offer_url = str(pinch_response["offer_url"])

        interventions.append(
            {
                "id": str(r["id"]),
                "member_id": str(r["member_id"]),
                "member_name": r["member_name"],
                "offer_slug": r["offer_slug"],
                "offer_name": "Flex Plan",
                "offer_type": r["offer_type"],
                "status": r["status"],
                "created_at": r["created_at"].isoformat(),
                "accepted_at": (
                    r["accepted_at"].isoformat() if r["accepted_at"] else None
                ),
                "risk_tier": risk_tier,
                "amount_cents": amount_cents,
                "offer_token": offer_token,
                "offer_url": offer_url,
                "payment_link_url": pinch_fields["payment_link_url"],
                "pinch_subscription_id": pinch_fields["pinch_subscription_id"],
                "error_message": pinch_fields["error_message"],
                "pricing_breakdown": pricing_breakdown,
                "value_projection": value_projection,
            }
        )

    return {"interventions": interventions}
