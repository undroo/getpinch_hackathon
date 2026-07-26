"""Create Pinch sandbox plans/payers and wire demo member IDs in Postgres."""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg
import httpx

from app.config import settings
from app.services.pinch_client import PinchAuthError, PinchClient

SARAH_ID = uuid.UUID("11111111-1111-1111-1111-111111111101")
MARCUS_ID = uuid.UUID("11111111-1111-1111-1111-111111111102")
AVERY_ID = uuid.UUID("25a6d34c-46bc-4a4d-984e-121d47aeb9dd")

STANDARD_PLAN_NAME = "RetainIQ+ Standard v1"
HOLD_PLAN_NAME = "RetainIQ+ Hold v1"

DEMO_MEMBERS: list[tuple[uuid.UUID, str, str, str, str]] = [
    (SARAH_ID, "Sarah", "Chen", "sarah.chen@example.com", "+61400101001"),
    (MARCUS_ID, "Marcus", "Webb", "marcus.webb@example.com", "+61400101002"),
    (AVERY_ID, "Avery", "Davis", "avery.davis@example.com", "+61400000007"),
]


def _connect_kwargs() -> dict:
    kwargs: dict = {}
    if "supabase.co" in settings.database_url or "pooler.supabase.com" in settings.database_url:
        kwargs["ssl"] = "require"
        kwargs["statement_cache_size"] = 0
    return kwargs


def _plan_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("data") or payload.get("items") or payload.get("plans") or []
    if isinstance(items, dict):
        items = items.get("items", [])
    return items if isinstance(items, list) else []


def _payer_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("data") or payload.get("items") or payload.get("payers") or []
    if isinstance(items, dict):
        items = items.get("items", [])
    return items if isinstance(items, list) else []


def _monthly_plan(name: str, amount_cents: int, description: str) -> dict[str, Any]:
    return {
        "name": name,
        "recurringPayment": {
            "amountInCents": amount_cents,
            "description": description,
            "cancelPlanOnFailure": False,
            "startDateInterval": "months",
            "startDateOffset": "1",
            "frequencyInterval": "months",
            "frequencyOffset": 1,
            "endType": "subscription-fully-paid",
        },
    }


def _payer_payload(
    first_name: str,
    last_name: str,
    email: str,
    mobile: str,
) -> dict[str, Any]:
    return {
        "firstName": first_name,
        "lastName": last_name,
        "emailAddress": email,
        "mobileNumber": mobile,
        "streetAddress": "123 Demo St",
        "suburb": "Brisbane",
        "postcode": "4000",
        "state": "QLD",
        "country": "Australia",
        "source": {
            "sourceType": "bank-account",
            "bankAccountName": f"{first_name} {last_name}",
            "bankAccountBsb": "000000",
            "bankAccountNumber": "123456789",
            "ipAddress": "127.0.0.1",
        },
    }


async def _find_plan_by_name(pinch: PinchClient, name: str) -> str | None:
    listing = await pinch.list_plans()
    for plan in _plan_items(listing):
        if (plan.get("name") or "").strip() == name:
            plan_id = plan.get("id")
            if plan_id:
                return str(plan_id)
    return None


async def _ensure_plan(
    pinch: PinchClient,
    *,
    name: str,
    amount_cents: int,
    description: str,
) -> str:
    existing = await _find_plan_by_name(pinch, name)
    if existing:
        print(f"  plan exists: {name} -> {existing}")
        return existing
    created = await pinch.create_plan(_monthly_plan(name, amount_cents, description))
    plan_id = created.get("id")
    if not plan_id:
        raise RuntimeError(f"Pinch did not return plan id for {name}: {created}")
    print(f"  plan created: {name} -> {plan_id}")
    return str(plan_id)


async def _find_payer_by_email(pinch: PinchClient, email: str) -> str | None:
    listing = await pinch.list_payers()
    for payer in _payer_items(listing):
        if (payer.get("emailAddress") or "").lower() == email.lower():
            payer_id = payer.get("id")
            if payer_id:
                return str(payer_id)
    return None


async def _ensure_payer(
    pinch: PinchClient,
    *,
    first_name: str,
    last_name: str,
    email: str,
    mobile: str,
) -> str:
    existing = await _find_payer_by_email(pinch, email)
    if existing:
        print(f"  payer exists: {email} -> {existing}")
        return existing
    created = await pinch.create_payer(
        _payer_payload(first_name, last_name, email, mobile)
    )
    payer_id = created.get("id")
    if not payer_id:
        raise RuntimeError(f"Pinch did not return payer id for {email}: {created}")
    print(f"  payer created: {email} -> {payer_id}")
    return str(payer_id)


async def _ensure_standard_subscription(
    pinch: PinchClient,
    *,
    payer_id: str,
    standard_plan_id: str,
) -> str | None:
    subs = await pinch.list_payer_subscriptions(payer_id)
    items = subs.get("data") or subs.get("subscriptions") or subs.get("items") or []
    if isinstance(items, dict):
        items = items.get("items", [])
    if isinstance(items, list):
        for sub in items:
            status = (sub.get("status") or "").lower()
            sub_id = sub.get("id")
            if sub_id and status in ("active", "current", "in_progress", ""):
                print(f"  subscription exists for {payer_id}: {sub_id}")
                return str(sub_id)
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).strftime("%Y-%m-%d")
    created = await pinch.create_subscription(
        plan_id=standard_plan_id,
        payer_id=payer_id,
    )
    sub_id = created.get("id")
    print(f"  subscription created for {payer_id}: {sub_id} (start {tomorrow})")
    return str(sub_id) if sub_id else None


async def _update_db_ids(
    conn: asyncpg.Connection,
    *,
    standard_plan_id: str,
    hold_plan_id: str,
    payer_map: dict[uuid.UUID, str],
) -> None:
    await conn.execute(
        """
        UPDATE gym_config
        SET standard_plan_id = $1,
            hold_plan_id = $2
        """,
        standard_plan_id,
        hold_plan_id,
    )
    await conn.execute(
        """
        UPDATE retention_offers
        SET pinch_plan_id = $1
        WHERE slug = 'hold_plan'
        """,
        hold_plan_id,
    )
    for member_id, payer_id in payer_map.items():
        await conn.execute(
            "UPDATE members SET pinch_payer_id = $1 WHERE id = $2",
            payer_id,
            member_id,
        )


async def _extra_demo_members(conn: asyncpg.Connection) -> list[tuple[uuid.UUID, str, str, str, str]]:
    rows = await conn.fetch(
        """
        SELECT id, name, email, phone
        FROM members
        WHERE pinch_payer_id LIKE 'REPLACE_PAYER_%'
        ORDER BY name
        LIMIT 5
        """
    )
    extras: list[tuple[uuid.UUID, str, str, str, str]] = []
    for row in rows:
        parts = (row["name"] or "Demo Member").split(maxsplit=1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else "Member"
        extras.append(
            (
                row["id"],
                first,
                last,
                row["email"] or f"{first.lower()}@demo.retainplus.app",
                row["phone"] or "+61400000000",
            )
        )
    return extras


async def _clear_demo_interventions(conn: asyncpg.Connection, member_ids: list[uuid.UUID]) -> int:
    result = await conn.execute(
        """
        DELETE FROM interventions
        WHERE member_id = ANY($1::uuid[])
          AND status IN ('offered', 'applied', 'failed')
        """,
        member_ids,
    )
    return int(result.split()[-1]) if result else 0


async def _smoke_checks(
    pinch: PinchClient,
    *,
    hold_plan_id: str,
    sarah_payer_id: str,
    base_cents: int = 4000,
) -> None:
    preview = await pinch.preview_plan_payments(hold_plan_id, total_amount=base_cents)
    print(f"  calculated-payments ok: keys={list(preview.keys())[:5]}")
    subs = await pinch.list_payer_subscriptions(sarah_payer_id)
    items = subs.get("data") or subs.get("items") or []
    count = len(items) if isinstance(items, list) else 0
    print(f"  sarah subscriptions listed: {count}")


async def run(*, clear_interventions: bool) -> None:
    if not settings.pinch_configured:
        raise SystemExit(
            "Set PINCH_MERCHANT_ID (mch_test_...) and PINCH_API_KEY (sk_test_...) in apps/api/.env"
        )

    pinch = PinchClient()
    conn = await asyncpg.connect(settings.database_url, **_connect_kwargs())

    try:
        print("Creating / resolving Pinch plans...")
        standard_plan_id = await _ensure_plan(
            pinch,
            name=STANDARD_PLAN_NAME,
            amount_cents=8900,
            description="Standard unlimited membership",
        )
        hold_plan_id = await _ensure_plan(
            pinch,
            name=HOLD_PLAN_NAME,
            amount_cents=1000,
            description="Flex / hold membership base fee",
        )

        demo_targets = list(DEMO_MEMBERS)
        demo_targets.extend(await _extra_demo_members(conn))

        print(f"Creating / resolving {len(demo_targets)} demo payers...")
        payer_map: dict[uuid.UUID, str] = {}
        for member_id, first, last, email, mobile in demo_targets:
            payer_id = await _ensure_payer(
                pinch,
                first_name=first,
                last_name=last,
                email=email,
                mobile=mobile,
            )
            payer_map[member_id] = payer_id
            await _ensure_standard_subscription(
                pinch,
                payer_id=payer_id,
                standard_plan_id=standard_plan_id,
            )

        print("Updating Postgres IDs...")
        await _update_db_ids(
            conn,
            standard_plan_id=standard_plan_id,
            hold_plan_id=hold_plan_id,
            payer_map=payer_map,
        )

        if clear_interventions:
            deleted = await _clear_demo_interventions(conn, list(payer_map.keys()))
            print(f"Cleared {deleted} stale interventions for demo members")

        print("Running Pinch smoke checks...")
        await _smoke_checks(
            pinch,
            hold_plan_id=hold_plan_id,
            sarah_payer_id=payer_map[SARAH_ID],
        )

        print("\nPinch sandbox setup complete.")
        print(f"  standard_plan_id: {standard_plan_id}")
        print(f"  hold_plan_id:     {hold_plan_id}")
        print(f"  sarah payer:      {payer_map[SARAH_ID]}")
        print(f"  marcus payer:     {payer_map[MARCUS_ID]}")
        print(f"  avery payer:      {payer_map[AVERY_ID]}")
        print("\nAdd to apps/api/.env to preserve across re-seeds:")
        print(f"PINCH_STANDARD_PLAN_ID={standard_plan_id}")
        print(f"PINCH_HOLD_PLAN_ID={hold_plan_id}")
        print(f"PINCH_PAYER_SARAH={payer_map[SARAH_ID]}")
        print(f"PINCH_PAYER_MARCUS={payer_map[MARCUS_ID]}")
        print(f"PINCH_PAYER_AVERY={payer_map[AVERY_ID]}")
    except PinchAuthError as exc:
        raise SystemExit(f"Pinch auth failed: {exc}") from exc
    except httpx.HTTPError as exc:
        raise SystemExit(f"Pinch API error: {exc}") from exc
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap Pinch sandbox for RetainIQ+ demo")
    parser.add_argument(
        "--clear-interventions",
        action="store_true",
        help="Delete offered/applied interventions for wired demo members",
    )
    args = parser.parse_args()
    asyncio.run(run(clear_interventions=args.clear_interventions))


if __name__ == "__main__":
    main()
