import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  Sparkles,
  Zap,
} from "lucide-react";
import { CheckInChart } from "@/components/check-in-chart";
import { MemberDetailInsights } from "@/components/member-detail-insights";
import { MemberHeaderActions } from "@/components/member-header-actions";
import { MemberInsightsRow } from "@/components/member-insights-row";
import { MemberMetricCard } from "@/components/member-metric-card";
import { MemberOfferPanel } from "@/components/member-offer-panel";
import { TierBadge } from "@/components/tier-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMember } from "@/lib/api";
import { buildDetailViewModel } from "@/lib/member-insights";
import { formatMembershipPlan, formatRelativeDays, isPinchPayerLinked } from "@/lib/utils";

type MemberDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MemberDetailPage({
  params,
}: MemberDetailPageProps) {
  const { id } = await params;

  let detail;
  try {
    detail = await getMember(id);
  } catch {
    notFound();
  }

  const {
    member,
    risk,
    check_ins,
    suggested_offer,
    active_intervention,
    pricing_breakdown,
    value_projection,
    flex_performance,
  } = detail;
  const insight = buildDetailViewModel(detail);
  const atRisk = insight.variant === "at-risk";
  const showInsightDashboard = Boolean(active_intervention) || atRisk;
  const days = risk.days_since_last_visit;
  const pinchLinked = isPinchPayerLinked(member.pinch_payer_id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/members"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Members
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text-primary md:text-[32px]">
              {member.name}
            </h1>
            <TierBadge
              tier={member.risk_tier}
              label={
                member.risk_tier === "critical" ? "Critical" : undefined
              }
              className="uppercase tracking-wide"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            <span className="font-mono uppercase tracking-wide">
              MEMBER_ID: {insight.memberCode}
            </span>
            <span className="text-border-focus">·</span>
            <span>
              Joined{" "}
              {new Date(member.joined_at).toLocaleDateString("en-AU", {
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="text-border-focus">·</span>
            <span className="truncate">{member.email}</span>
          </div>
        </div>

        <MemberHeaderActions
          variant={insight.variant}
          email={member.email}
          name={member.name}
        />
      </div>

      {showInsightDashboard ? (
        <MemberDetailInsights
          member={member}
          checkIns={check_ins}
          daysSinceVisit={days}
          suggestedOffer={suggested_offer}
          activeIntervention={active_intervention}
          pricingBreakdown={pricing_breakdown}
          valueProjection={value_projection}
          flexPerformance={flex_performance}
          insight={insight}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MemberMetricCard
              label="Days since visit"
              value={days === null ? "—" : String(days)}
              sub={formatRelativeDays(days)}
              icon={days !== null && days <= 3 ? Check : CalendarDays}
              valueClassName={
                days !== null && days <= 3
                  ? "text-[var(--tier-healthy-text)]"
                  : "text-text-primary"
              }
            />
            <MemberMetricCard
              label="Visits (30d)"
              value={String(risk.visits_30d)}
              sub={
                insight.visitsGrowthLabel ? (
                  <span className="font-medium text-[var(--tier-healthy-text)]">
                    {insight.visitsGrowthLabel}
                  </span>
                ) : (
                  "Rolling window"
                )
              }
              icon={Sparkles}
              valueClassName="text-text-primary"
            />
            <MemberMetricCard
              label="Membership"
              value={formatMembershipPlan(member.membership_plan)}
              sub="Current plan"
              icon={Zap}
              valueClassName="text-text-primary"
            />
            <MemberMetricCard
              label="Pinch linked"
              value={pinchLinked ? "Linked" : "—"}
              sub={
                pinchLinked ? (
                  <span className="font-mono text-[11px]">
                    {member.pinch_payer_id}
                  </span>
                ) : (
                  "Not linked"
                )
              }
              icon={pinchLinked ? Check : CreditCard}
              valueClassName={
                pinchLinked ? "text-[var(--tier-healthy-text)]" : "text-text-muted"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <Card>
                <CardContent className="p-5 md:p-6">
                  <CheckInChart
                    checkIns={check_ins}
                    tier={member.risk_tier}
                    highlightCurrent={false}
                    callout={
                      insight.successCallout ??
                      insight.monitoringNote ??
                      null
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <MemberOfferPanel
                member={member}
                offer={suggested_offer}
                insight={insight}
                pricingBreakdown={pricing_breakdown}
                valueProjection={value_projection}
                activeIntervention={active_intervention}
                flexPerformance={flex_performance}
              />
            </div>
          </div>

          <MemberInsightsRow insight={insight} />
        </>
      )}
    </div>
  );
}
