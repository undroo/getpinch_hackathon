"""Reset and seed RetainIQ+ demo data into Postgres (local Docker or Supabase)."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import asyncpg

from app.config import settings
from app.services.pricing import price_offer
from app.services.scorer import compute_risk_tier
from app.services.value_projection import projection_from_breakdown

# Fixed demo personas (same UUIDs as supabase/seed.sql)
SARAH_ID = uuid.UUID("11111111-1111-1111-1111-111111111101")
MARCUS_ID = uuid.UUID("11111111-1111-1111-1111-111111111102")
JAMIE_ID = uuid.UUID("11111111-1111-1111-1111-111111111103")

DEFAULT_MEMBER_COUNT = 407
TARGET_CRITICAL = 7
TARGET_SLIPPING = 43
TARGET_UNKNOWN = 7

FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Quinn", "Avery",
    "Blake", "Cameron", "Drew", "Elliot", "Finley", "Gray", "Harper", "Indigo",
    "Jesse", "Kai", "Logan", "Micah", "Noah", "Oakley", "Parker", "Reese",
    "Sage", "Tatum", "Uma", "Vale", "Winter", "Xander", "Yael", "Zion",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Lee", "Walker", "Hall", "Allen", "Young", "King",
    "Wright", "Scott", "Green", "Baker",
]

MEMBER_METRICS_SELECT = """
SELECT
  m.id,
  m.name,
  m.joined_at,
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
ORDER BY m.name
"""


@dataclass
class MemberRow:
    id: uuid.UUID
    name: str
    email: str
    phone: str
    pinch_payer_id: str | None
    membership_plan: str
    status: str
    joined_at: datetime


def _connect_kwargs() -> dict:
    kwargs: dict = {}
    if "supabase.co" in settings.database_url or "pooler.supabase.com" in settings.database_url:
        kwargs["ssl"] = "require"
        # Supabase transaction pooler (pgbouncer) does not support prepared statements.
        kwargs["statement_cache_size"] = 0
    return kwargs


def _confirm_reset(skip_confirm: bool) -> None:
    if skip_confirm:
        return
    answer = input("This will DELETE all demo data. Continue? [y/N] ").strip().lower()
    if answer not in {"y", "yes"}:
        print("Aborted.")
        sys.exit(0)


async def _truncate(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        TRUNCATE TABLE
          interventions,
          risk_snapshots,
          check_ins,
          members,
          retention_offers,
          gym_config
        RESTART IDENTITY CASCADE
        """
    )


async def _seed_gym_config(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        INSERT INTO gym_config (
          gym_name, standard_plan_id, hold_plan_id, loyalty_plan_id, winback_amount_cents
        ) VALUES ($1, $2, $3, $4, $5)
        """,
        settings.demo_gym_name,
        settings.pinch_standard_plan_id or "REPLACE_STANDARD_PLAN_ID",
        settings.pinch_hold_plan_id or "REPLACE_HOLD_PLAN_ID",
        "REPLACE_LOYALTY_PLAN_ID",
        4900,
    )


async def _seed_retention_offers(conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    hold_plan_id = settings.pinch_hold_plan_id or "REPLACE_HOLD_PLAN_ID"
    rows = await conn.fetch(
        """
        INSERT INTO retention_offers (
          slug, name, description, offer_type, pinch_plan_id, amount_cents, target_tier
        ) VALUES
          (
            'hold_plan',
            'Hold / Pause',
            'Reduce membership to $10/mo while the member pauses — keeps them from cancelling.',
            'plan_switch',
            $1,
            NULL,
            'critical'
          ),
          (
            'winback_link',
            'Win-back',
            'One-click hosted payment link for a discounted comeback month ($49).',
            'payment_link',
            NULL,
            4900,
            'slipping'
          ),
          (
            'loyalty_plan',
            'Loyalty Discount',
            'Switch to a loyalty plan with 40% off for highly engaged members.',
            'plan_switch',
            'REPLACE_LOYALTY_PLAN_ID',
            NULL,
            'healthy'
          )
        RETURNING id, slug
        """,
        hold_plan_id,
    )
    return {row["slug"]: row["id"] for row in rows}


def _persona_members(now: datetime) -> list[MemberRow]:
    return [
        MemberRow(
            id=SARAH_ID,
            name="Sarah Chen",
            email="sarah.chen@example.com",
            phone="+61400101001",
            pinch_payer_id=settings.pinch_payer_sarah or "REPLACE_PAYER_SARAH",
            membership_plan="standard",
            status="active",
            joined_at=now - timedelta(days=180),
        ),
        MemberRow(
            id=MARCUS_ID,
            name="Marcus Webb",
            email="marcus.webb@example.com",
            phone="+61400101002",
            pinch_payer_id=settings.pinch_payer_marcus or "REPLACE_PAYER_MARCUS",
            membership_plan="standard",
            status="active",
            joined_at=now - timedelta(days=120),
        ),
        MemberRow(
            id=JAMIE_ID,
            name="Jamie Torres",
            email="jamie.torres@example.com",
            phone="+61400101003",
            pinch_payer_id="REPLACE_PAYER_JAMIE",
            membership_plan="flex",
            status="active",
            joined_at=now - timedelta(days=200),
        ),
    ]


def _generated_tier_counts(total_count: int) -> dict[str, int]:
    """Tier counts for generated members (excludes 3 fixed personas)."""
    gen_total = total_count - 3
    critical = TARGET_CRITICAL - 1  # Sarah Chen
    slipping = TARGET_SLIPPING - 1  # Marcus Webb
    unknown = TARGET_UNKNOWN if total_count >= DEFAULT_MEMBER_COUNT else max(1, gen_total // 50)
    healthy = gen_total - critical - slipping - unknown
    if healthy < 0:
        raise SystemExit(
            f"--count {total_count} is too low for "
            f"{TARGET_CRITICAL} critical / {TARGET_SLIPPING} slipping targets."
        )
    return {
        "critical": critical,
        "slipping": slipping,
        "healthy": healthy,
        "unknown": unknown,
    }


def _generated_tier_list(total_count: int) -> list[str]:
    counts = _generated_tier_counts(total_count)
    tiers: list[str] = []
    for tier in ("critical", "slipping", "healthy", "unknown"):
        tiers.extend([tier] * counts[tier])
    assert len(tiers) == total_count - 3
    return tiers


def _generated_members(now: datetime, total_count: int) -> list[tuple[MemberRow, str]]:
    members: list[tuple[MemberRow, str]] = []
    tier_list = _generated_tier_list(total_count)

    for i, tier in enumerate(tier_list, start=4):
        if tier == "unknown":
            joined_at = now - timedelta(days=10 + (i % 15))
        else:
            joined_at = now - timedelta(days=60 + (i % 300))

        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[i % len(LAST_NAMES)]
        pinch_payer_id = f"REPLACE_PAYER_{i}" if i <= 14 else None

        members.append(
            (
                MemberRow(
                    id=uuid.uuid4(),
                    name=f"{first} {last}",
                    email=f"member{i}@demo.retainplus.app",
                    phone=f"+61400{i:06d}",
                    pinch_payer_id=pinch_payer_id,
                    membership_plan="standard",
                    status="active",
                    joined_at=joined_at,
                ),
                tier,
            )
        )
    return members


def _persona_check_ins(now: datetime) -> list[tuple[uuid.UUID, datetime]]:
    check_ins: list[tuple[uuid.UUID, datetime]] = []

    # Sarah Chen: Critical — 24 days inactive, was active in May/June
    day = now - timedelta(days=75)
    while day <= now - timedelta(days=55):
        check_ins.append((SARAH_ID, day))
        day += timedelta(days=2)
    check_ins.append((SARAH_ID, now - timedelta(days=24)))

    # Marcus Webb: Slipping — 16 days inactive
    day = now - timedelta(days=60)
    while day <= now - timedelta(days=30):
        check_ins.append((MARCUS_ID, day))
        day += timedelta(days=5)
    check_ins.append((MARCUS_ID, now - timedelta(days=16)))

    # Jamie Torres: Healthy on flex — regular visits since apply (~6 weeks)
    for n in range(0, 42, 2):
        check_ins.append((JAMIE_ID, now - timedelta(days=n) + timedelta(hours=8)))

    return check_ins


# Bimodal gym peaks (UTC hours matching seed "local" display): morning 7–10, evening 17–19.
_PEAK_HOURS = (7, 8, 9, 10, 17, 18, 19)
_OFF_PEAK_HOURS = (11, 12, 13, 14, 15, 16)


def _demo_checkin_hour(index: int, visit_day: int) -> int:
    """Bias ~70% of visits into morning/evening peaks for overview peak-hours demo."""
    if (index + visit_day) % 10 < 7:
        return _PEAK_HOURS[(index + visit_day) % len(_PEAK_HOURS)]
    return _OFF_PEAK_HOURS[(index + visit_day) % len(_OFF_PEAK_HOURS)]


def _check_ins_for_tier(
    member: MemberRow,
    tier: str,
    index: int,
    now: datetime,
) -> list[tuple[uuid.UUID, datetime]]:
    if tier == "unknown":
        return []

    check_ins: list[tuple[uuid.UUID, datetime]] = []

    if tier == "healthy":
        for visit_day in range(0, 28, 2):
            hour = _demo_checkin_hour(index, visit_day)
            checkin_time = now - timedelta(days=visit_day) + timedelta(hours=hour)
            check_ins.append((member.id, checkin_time))
        return check_ins

    if tier == "slipping":
        # Use 15–20 days so EXTRACT(day FROM …) reliably clears the 14-day threshold.
        last_visit_offset = 15 + (index % 6)
    elif tier == "critical":
        # Use 22–33 days so EXTRACT(day FROM …) reliably clears the 21-day threshold.
        last_visit_offset = 22 + (index % 12)
    else:
        raise ValueError(f"Unsupported tier for check-ins: {tier}")

    hour = _demo_checkin_hour(index, last_visit_offset)
    checkin_time = now - timedelta(days=last_visit_offset) + timedelta(hours=hour)
    check_ins.append((member.id, checkin_time))

    for visit_day in range(30, 81, 7):
        hour = _demo_checkin_hour(index, last_visit_offset + visit_day)
        checkin_time = (
            now - timedelta(days=last_visit_offset + visit_day) + timedelta(hours=hour)
        )
        if checkin_time > member.joined_at:
            check_ins.append((member.id, checkin_time))

    return check_ins


async def _insert_members(conn: asyncpg.Connection, members: list[MemberRow]) -> None:
    await conn.executemany(
        """
        INSERT INTO members (
          id, name, email, phone, pinch_payer_id, membership_plan, status, joined_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        [
            (
                m.id,
                m.name,
                m.email,
                m.phone,
                m.pinch_payer_id,
                m.membership_plan,
                m.status,
                m.joined_at,
            )
            for m in members
        ],
    )


async def _insert_check_ins(
    conn: asyncpg.Connection,
    check_ins: list[tuple[uuid.UUID, datetime]],
) -> None:
    if not check_ins:
        return
    await conn.executemany(
        """
        INSERT INTO check_ins (member_id, checked_in_at, source)
        VALUES ($1, $2, 'mock')
        """,
        check_ins,
    )


async def _seed_interventions(
    conn: asyncpg.Connection,
    offer_ids: dict[str, uuid.UUID],
    now: datetime,
) -> None:
    # Jamie applied ~6 weeks ago while critical — snapshot economics at switch.
    applied_at = now - timedelta(days=42)
    pricing_breakdown = price_offer(
        churn_probability_pct=80,
        membership_plan="standard",
        offer_slug="hold_plan",
        visits_30d=0,
        risk_tier="critical",
    )
    value_projection = projection_from_breakdown(
        risk_tier="critical",
        offer_slug="hold_plan",
        offer_type="plan_switch",
        breakdown=pricing_breakdown,
    )
    pinch_response = {
        "status": "demo",
        "message": "Flex plan applied in sandbox demo",
        "pinch_subscription_id": "sub_demo_jamie_flex",
        "pricing_breakdown": pricing_breakdown,
        "value_projection": value_projection,
    }
    await conn.execute(
        """
        INSERT INTO interventions (
          member_id, offer_id, status, pinch_response, created_by, created_at
        )
        VALUES ($1, $2, 'applied', $3::jsonb, 'demo_owner', $4)
        """,
        JAMIE_ID,
        offer_ids["hold_plan"],
        json.dumps(pinch_response),
        applied_at,
    )
    await conn.execute(
        """
        INSERT INTO interventions (member_id, offer_id, status, pinch_response, created_by)
        VALUES ($1, $2, 'suggested', NULL, 'demo_owner')
        """,
        MARCUS_ID,
        offer_ids["winback_link"],
    )


async def _print_tier_summary(conn: asyncpg.Connection) -> None:
    rows = await conn.fetch(MEMBER_METRICS_SELECT)
    summary = {"healthy": 0, "slipping": 0, "critical": 0, "unknown": 0, "watch": 0}

    for row in rows:
        tier = compute_risk_tier(
            joined_at=row["joined_at"],
            visits_30d=int(row["visits_30d"]),
            days_since_last_visit=int(row["days_since_last_visit"]),
        )
        if tier in summary:
            summary[tier] += 1

    print("\nTier summary:")
    for tier, count in summary.items():
        print(f"  {tier:10s} {count}")

    personas = {str(SARAH_ID): "Sarah Chen", str(MARCUS_ID): "Marcus Webb", str(JAMIE_ID): "Jamie Torres"}
    print("\nDemo personas:")
    for row in rows:
        member_id = str(row["id"])
        if member_id not in personas:
            continue
        tier = compute_risk_tier(
            joined_at=row["joined_at"],
            visits_30d=int(row["visits_30d"]),
            days_since_last_visit=int(row["days_since_last_visit"]),
        )
        print(
            f"  {personas[member_id]:14s} tier={tier:10s} "
            f"visits_30d={row['visits_30d']} days_since_last_visit={row['days_since_last_visit']}"
        )

    print(f"\nTotal members: {len(rows)}")


async def seed_demo_data(
    *,
    count: int,
    skip_interventions: bool,
    yes: bool,
) -> None:
    if count < 4:
        raise SystemExit("--count must be at least 4 (3 personas + 1 generated member).")

    _confirm_reset(yes)
    now = datetime.now(UTC)

    conn = await asyncpg.connect(settings.database_url, **_connect_kwargs())
    try:
        async with conn.transaction():
            print("Truncating demo tables...")
            await _truncate(conn)

            print("Inserting gym_config and retention_offers...")
            await _seed_gym_config(conn)
            offer_ids = await _seed_retention_offers(conn)

            personas = _persona_members(now)
            generated_with_tiers = _generated_members(now, count)
            all_members = personas + [member for member, _ in generated_with_tiers]

            tier_targets = _generated_tier_counts(count)
            print(
                f"Inserting {len(all_members)} members "
                f"(targets: {TARGET_CRITICAL} critical, {TARGET_SLIPPING} slipping, "
                f"{tier_targets['healthy'] + 1} healthy, {tier_targets['unknown']} unknown)..."
            )
            await _insert_members(conn, all_members)

            check_ins = _persona_check_ins(now)
            for i, (member, tier) in enumerate(generated_with_tiers, start=4):
                check_ins.extend(_check_ins_for_tier(member, tier, i, now))

            print(f"Inserting {len(check_ins)} check-ins...")
            await _insert_check_ins(conn, check_ins)

            if not skip_interventions:
                print("Inserting sample interventions...")
                await _seed_interventions(conn, offer_ids, now)

        await _print_tier_summary(conn)
        print("\nSeed complete.")
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset and seed RetainIQ+ demo data.")
    parser.add_argument(
        "--count",
        type=int,
        default=DEFAULT_MEMBER_COUNT,
        help=f"Total member count including 3 demo personas (default: {DEFAULT_MEMBER_COUNT})",
    )
    parser.add_argument(
        "--skip-interventions",
        action="store_true",
        help="Skip sample intervention rows",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip interactive confirmation before truncating",
    )
    args = parser.parse_args()

    asyncio.run(
        seed_demo_data(
            count=args.count,
            skip_interventions=args.skip_interventions,
            yes=args.yes,
        )
    )


if __name__ == "__main__":
    main()
