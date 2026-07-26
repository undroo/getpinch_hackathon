"""Spike: does passing paymentDate/transactionDate fix N/A on Pinch hosted checkout?

Run from apps/api with Pinch credentials configured:
  python -m scripts.spike_payment_link_date

Expected outcome (verified): Pinch hosted page still shows N/A as the top
heading even when transactionDate/paymentDate/scheduledDate are sent.
Payment Links have no documented due-date field — use CaptureJS confirm flow instead.
"""

from __future__ import annotations

import asyncio
import sys

import httpx

from app.config import settings
from app.services.pinch_client import PinchAuthError, PinchClient

HOLD_PLAN_ID = settings.pinch_hold_plan_id
PAYER_ID = settings.pinch_payer_sarah


async def main() -> None:
    if not settings.pinch_configured:
        print("SKIP: PINCH_MERCHANT_ID and PINCH_API_KEY required")
        sys.exit(0)
    if not HOLD_PLAN_ID or not PAYER_ID:
        print("SKIP: PINCH_HOLD_PLAN_ID and PINCH_PAYER_SARAH required")
        sys.exit(0)

    pinch = PinchClient()
    try:
        preview = await pinch.preview_plan_payments(HOLD_PLAN_ID, total_amount=4400)
        payments = preview.get("data") or []
        payment_date = None
        if payments and isinstance(payments[0], dict):
            raw = payments[0].get("paymentDate") or payments[0].get("date")
            if raw:
                payment_date = str(raw).split("T", 1)[0]

        link = await pinch.create_payment_link(
            amount_cents=4400,
            description="Spike: Flex plan $11–$36/wk with payment date fields",
            return_url=f"{settings.web_app_url.rstrip('/')}/offer/spike-test/complete",
            payer_id=PAYER_ID,
            payment_date=payment_date,
        )
        url = link.get("url") or link.get("paymentLinkUrl")
        print(f"payment_date sent: {payment_date}")
        print(f"payment link url: {url}")
        print(
            "Open the URL and check the top heading — if it still says N/A, "
            "Payment Links cannot set a due date via API."
        )
    except PinchAuthError as exc:
        print(f"FAIL auth: {exc}")
        sys.exit(1)
    except httpx.HTTPError as exc:
        print(f"FAIL api: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
