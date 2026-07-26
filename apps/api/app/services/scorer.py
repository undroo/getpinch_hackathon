from datetime import UTC, datetime

RiskTier = str  # critical | slipping | healthy | watch | unknown


def compute_risk_tier(
    *,
    joined_at: datetime,
    visits_30d: int,
    days_since_last_visit: int | None,
    now: datetime | None = None,
) -> RiskTier:
    """Evaluate tiers most-severe-first per requirements Section 6."""
    now = now or datetime.now(UTC)
    if joined_at.tzinfo is None:
        joined_at = joined_at.replace(tzinfo=UTC)
    days_since_join = (now - joined_at).days

    # New member with no check-ins, or never checked in and still < 30 days
    if days_since_join < 30 and visits_30d == 0:
        return "unknown"

    if days_since_last_visit is None:
        if days_since_join >= 30:
            return "critical"
        return "unknown"

    if days_since_last_visit >= 21:
        return "critical"
    if days_since_last_visit >= 14:
        return "slipping"
    if visits_30d >= 8:
        return "healthy"
    return "watch"


TIER_SEVERITY = {
    "critical": 0,
    "slipping": 1,
    "watch": 2,
    "healthy": 3,
    "unknown": 4,
}


def tier_severity(tier: RiskTier) -> int:
    return TIER_SEVERITY.get(tier, 99)


# Flex plan (base + per entry) for members expected to leave — both tiers.
# winback_link seed row is unused in MVP suggest → apply path.
OFFER_BY_TIER: dict[RiskTier, str | None] = {
    "critical": "hold_plan",
    "slipping": "hold_plan",
    "healthy": None,
    "watch": None,
    "unknown": None,
}
