import hashlib
import hmac
import json
import logging
import time

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60


def _parse_pinch_signature(header: str) -> tuple[str | None, str | None]:
    """Parse pinch-signature as `t=<ts>,v1=<hex>` or bare hex (no timestamp)."""
    header = header.strip()
    if not header:
        return None, None

    if "=" not in header:
        return None, header

    parts: dict[str, str] = {}
    for piece in header.split(","):
        piece = piece.strip()
        if "=" not in piece:
            continue
        key, value = piece.split("=", 1)
        parts[key.strip()] = value.strip()

    return parts.get("t"), parts.get("v1") or parts.get("v0")


def _verify_pinch_signature(body: bytes, signature_header: str | None) -> None:
    secret = settings.pinch_webhook_secret
    if not secret:
        logger.warning("PINCH_WEBHOOK_SECRET unset — skipping webhook signature verification")
        return

    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing pinch-signature header")

    timestamp, signature = _parse_pinch_signature(signature_header)
    if not signature:
        raise HTTPException(status_code=401, detail="Invalid pinch-signature header")

    if timestamp is None:
        raise HTTPException(status_code=401, detail="Missing timestamp in pinch-signature")

    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid signature timestamp") from exc

    if abs(time.time() - ts) > _MAX_TIMESTAMP_SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="Webhook timestamp too old")

    signed_payload = f"{timestamp}.".encode() + body
    expected = hmac.new(
        secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def _extract_payer_id(payload: dict) -> str | None:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        return None

    payer_id = data.get("payerId") or data.get("payer_id")
    if payer_id:
        return str(payer_id)

    payer = data.get("payer")
    if isinstance(payer, dict) and payer.get("id"):
        return str(payer["id"])

    return None


@router.post("/pinch")
async def pinch_webhook(request: Request) -> dict:
    body = await request.body()
    _verify_pinch_signature(body, request.headers.get("pinch-signature"))

    try:
        payload = json.loads(body.decode() or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = payload.get("type") or payload.get("eventType") or payload.get("event")

    if event_type in ("subscription-cancelled", "subscription_cancelled", "subscription.cancelled"):
        payer_id = _extract_payer_id(payload)
        if payer_id:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE members
                    SET status = 'cancelled'
                    WHERE pinch_payer_id = $1
                    """,
                    payer_id,
                )

    return {"received": True, "event_type": event_type}
