import type {
  CheckIn,
  MemberDetail,
  RiskFactor,
  RiskTier,
} from "@/lib/types";
import { formatMembershipPlan, isPinchPayerLinked } from "@/lib/utils";

export type { RiskFactor, RiskFactorLevel } from "@/lib/types";

export type DashboardVariant = "at-risk" | "stable";

export interface LifecycleItem {
  key: string;
  label: string;
  value: string;
}

export interface MemberInsight {
  variant: DashboardVariant;
  /** Shortened real member UUID for display */
  memberCode: string;
  churnProbability: number;
  /** Pre-flex churn at switch, when on applied flex plan */
  churnProbabilityBaseline?: number;
  churnTrendLabel: string;
  engagementScore: number;
  engagementLabel: string;
  ltvCents: number;
  riskExposureCents: number | null;
  visitsGrowthLabel: string | null;
  persona: { title: string; detail: string };
  planSatisfaction: { title: string; detail: string };
  billingHealth: { title: string; detail: string };
  affinity: string;
  riskFactors: RiskFactor[];
  lifecycle: LifecycleItem[];
  strategyCopy: string;
  convertedFrom: string;
  successCallout: string | null;
  monitoringNote: string | null;
}

export function isAtRiskTier(tier: RiskTier): boolean {
  return tier === "critical" || tier === "slipping";
}

/** Shorten a real member UUID for display (first 8 hex chars). */
export function formatMemberCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function affinityFromVisits(visits: number): string {
  if (visits >= 8) return "High";
  if (visits >= 4) return "Medium";
  if (visits >= 1) return "Low";
  return "Very Low";
}

function slopeGrowthLabel(slope: number, tier: RiskTier): string | null {
  if (tier === "healthy" && slope >= 0.1) {
    return `+${Math.min(300, Math.round(slope * 100))}% trend`;
  }
  if (tier === "healthy" && slope >= 0) {
    return "Stable cadence";
  }
  return null;
}

/**
 * Maps API insights + member fields into presentational view-model props.
 * KPI / risk-factor values come from the API — not client heuristics.
 */
export function buildDetailViewModel(detail: MemberDetail): MemberInsight {
  const { member, risk, insights, active_intervention } = detail;
  const tier = member.risk_tier;
  const variant: DashboardVariant = isAtRiskTier(tier) ? "at-risk" : "stable";
  const linked = isPinchPayerLinked(member.pinch_payer_id);
  const visits = risk.visits_30d;
  const affinity = affinityFromVisits(visits);
  const onFlex =
    Boolean(active_intervention) ||
    member.membership_plan === "flex" ||
    member.membership_plan === "premium";
  const planLabel = formatMembershipPlan(member.membership_plan);

  const persona = {
    title: insights.engagement_label || "Engagement",
    detail: `${visits} visits in 30d · slope ${insights.visit_slope_90d.toFixed(2)}`,
  };

  const planSatisfaction =
    tier === "healthy"
      ? {
          title: "On track",
          detail: `Engagement score ${insights.engagement_score}/100.`,
        }
      : variant === "at-risk"
        ? {
            title: "Value at risk",
            detail: `${insights.churn_probability}% 60-day churn probability.`,
          }
        : {
            title: "Monitoring",
            detail: insights.engagement_label || "Watch engagement closely.",
          };

  const billingHealth = linked
    ? {
        title: "Pinch linked",
        detail: member.pinch_payer_id ?? "Payer connected",
      }
    : {
        title: "Pinch not linked",
        detail: "Link a payer to enable offers.",
      };

  const strategyCopy = onFlex
    ? "Member is on flex (base + per visit). Monitor engagement and visit pace vs the plan at switch."
    : tier === "healthy"
      ? "Member is in a healthy cadence. No variable pricing offer needed."
      : tier === "watch"
        ? "Monitor cadence closely. No pricing offer yet — intervene if inactivity crosses 14 days."
        : variant === "at-risk"
          ? "Apply the suggested pricing offer to keep expected value higher than a full quit."
          : "Insufficient signal for a pricing play. Keep scoring as check-ins arrive.";

  return {
    variant,
    memberCode: formatMemberCode(member.id),
    churnProbability: insights.churn_probability,
    churnProbabilityBaseline: insights.churn_probability_baseline,
    churnTrendLabel: insights.churn_trend_label,
    engagementScore: insights.engagement_score,
    engagementLabel: insights.engagement_label,
    ltvCents: insights.ltv_cents,
    riskExposureCents:
      insights.risk_exposure_cents != null
        ? insights.risk_exposure_cents
        : null,
    visitsGrowthLabel: slopeGrowthLabel(insights.visit_slope_90d, tier),
    persona,
    planSatisfaction,
    billingHealth,
    affinity,
    riskFactors: insights.risk_factors,
    lifecycle: [
      {
        key: "joined",
        label: "Joined",
        value: new Date(member.joined_at).toLocaleDateString("en-AU", {
          month: "short",
          year: "numeric",
        }),
      },
      { key: "plan", label: "Plan", value: planLabel },
      {
        key: "billing",
        label: "Billing",
        value: linked ? "Pinch linked" : "Not linked",
      },
      { key: "affinity", label: "Affinity", value: affinity },
    ],
    strategyCopy,
    convertedFrom:
      insights.churn_probability_baseline != null
        ? `Standard · ${insights.churn_probability_baseline}% churn at switch`
        : "Standard",
    successCallout:
      tier === "healthy"
        ? `Engagement score ${insights.engagement_score}/100 · LTV forecast $${(insights.ltv_cents / 100).toFixed(0)}.`
        : null,
    monitoringNote:
      !onFlex && (tier === "watch" || tier === "unknown")
        ? "Monitoring mode — no variable pricing offer until churn risk escalates."
        : null,
  };
}

export function formatFlexChurnDelta(insight: MemberInsight): string | null {
  if (insight.churnProbabilityBaseline == null) return null;
  return `${insight.churnProbabilityBaseline}% → ${insight.churnProbability}% at flex switch`;
}

export interface MonthBucket {
  key: string;
  label: string;
  count: number;
  isCurrent: boolean;
}

export function monthlyCheckInBuckets(
  checkIns: CheckIn[],
  months = 3,
): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase(),
      count: 0,
      isCurrent: i === 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const c of checkIns) {
    const dt = new Date(c.checked_in_at);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const idx = index.get(key);
    if (idx !== undefined) {
      buckets[idx].count += 1;
    }
  }

  return buckets;
}
