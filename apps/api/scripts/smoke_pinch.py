"""Smoke-test Pinch configuration and live API connectivity."""

from __future__ import annotations

import asyncio
import sys

import httpx

from app.config import settings
from app.services.pinch_client import PinchAuthError, PinchClient

SARAH_ID = "11111111-1111-1111-1111-111111111101"


async def main() -> None:
    if not settings.pinch_configured:
        print("SKIP: Set PINCH_MERCHANT_ID and PINCH_API_KEY in apps/api/.env")
        print("  Merchant/Application ID: from Pinch Developer Portal → API Keys")
        print("  Secret Key: sk_test_...")
        sys.exit(0)

    pinch = PinchClient()
    try:
        plans = await pinch.list_plans()
        items = plans.get("data") or plans.get("items") or []
        count = len(items) if isinstance(items, list) else 0
        print(f"OK list_plans: {count} plan(s)")

        hold_plan_id = settings.pinch_hold_plan_id
        if not hold_plan_id:
            print("WARN: PINCH_HOLD_PLAN_ID unset — run setup_pinch_sandbox.py first")
        else:
            preview = await pinch.preview_plan_payments(hold_plan_id, total_amount=4000)
            print(f"OK calculated-payments: keys={list(preview.keys())[:4]}")

        payer_id = settings.pinch_payer_sarah
        if payer_id:
            subs = await pinch.list_payer_subscriptions(payer_id)
            print(f"OK sarah subscriptions payload keys={list(subs.keys())[:4]}")
        else:
            print("WARN: PINCH_PAYER_SARAH unset")

        # Local API preview (requires running uvicorn)
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"http://localhost:8000/api/v1/members/{SARAH_ID}/interventions/preview",
                    json={"offer_slug": "hold_plan"},
                    timeout=15.0,
                )
                body = r.json()
                demo = body.get("raw", {}).get("status") == "demo"
                print(
                    f"{'WARN demo_mode preview' if demo else 'OK live preview'}: HTTP {r.status_code}"
                )
        except httpx.HTTPError as exc:
            print(f"SKIP local API preview (is uvicorn running?): {exc}")

    except PinchAuthError as exc:
        print(f"FAIL auth: {exc}")
        sys.exit(1)
    except httpx.HTTPError as exc:
        print(f"FAIL api: {exc}")
        sys.exit(1)

    print("Pinch smoke checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
