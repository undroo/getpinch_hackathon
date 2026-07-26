"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Copy,
  ExternalLink,
  History,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ApplyOfferModal } from "@/components/apply-offer-modal";
import { FlexPlanValueChart } from "@/components/flex-plan-value-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tierAccentClass } from "@/components/tier-badge";
import { formatFlexChurnDelta, type MemberInsight } from "@/lib/member-insights";
import type {
  ActiveIntervention,
  FlexPerformance,
  Member,
  PricingBreakdown,
  RiskTier,
  SuggestedOffer,
  ValueProjection,
  VisitPace,
} from "@/lib/types";
import {
  capitalize,
  cn,
  formatAUD,
  formatMembershipPlan,
  formatSignedAUD,
  improvementToneClass,
  isPinchPayerLinked,
} from "@/lib/utils";

function formatAppliedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatVisitsPerWeek(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function flexStatusLine(
  riskTier: RiskTier,
  visitPace: VisitPace | undefined,
): string {
  if (riskTier === "healthy") {
    return "On flex pricing · Healthy engagement";
  }
  if (visitPace === "ahead") {
    return "On flex pricing · Ahead of expected visits";
  }
  if (visitPace === "on_track") {
    return "On flex pricing · On track vs expected visits";
  }
  if (visitPace === "behind") {
    return "On flex pricing · Behind expected visit pace";
  }
  if (riskTier === "critical" || riskTier === "slipping") {
    return "On flex pricing · Still at elevated risk";
  }
  return "On flex pricing";
}

function OfferedFlexPlanPanel({
  activeIntervention,
  borderClass,
}: {
  activeIntervention: ActiveIntervention;
  borderClass: string;
}) {
  const breakdown = activeIntervention.pricing_breakdown;
  const base = breakdown?.base_weekly_cents ?? breakdown?.base_cents;
  const perEntry = breakdown?.per_entry_cents;
  const maxCap = breakdown?.max_cap_weekly_cents;
  const structureLabel =
    base != null && perEntry != null
      ? `${formatAUD(base)}/wk + ${formatAUD(perEntry)}/visit`
      : activeIntervention.offer_name;
  const offerUrl = activeIntervention.offer_url;

  async function copyLink() {
    if (!offerUrl) return;
    await navigator.clipboard.writeText(offerUrl);
    toast.success("Offer link copied");
  }

  return (
    <Card className={cn("border-l-[3px]", borderClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-status-pending" strokeWidth={1.5} />
          <CardTitle className="text-base">Offer Sent</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-text-primary">
              {activeIntervention.offer_name}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Sent{" "}
              <span className="font-medium text-status-pending">
                {formatAppliedAt(activeIntervention.applied_at)}
              </span>
              {" · awaiting member Pinch confirmation"}
            </p>
          </div>
          <Badge className="border-status-pending/40 bg-status-pending/10 text-status-pending">
            Offered
          </Badge>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Flex structure
          </p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">
            {structureLabel}
            {maxCap != null ? (
              <span className="font-normal text-text-muted">
                {" "}
                · max {formatAUD(maxCap)}/wk
              </span>
            ) : null}
          </p>
        </div>

        {offerUrl ? (
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Offer link
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={offerUrl}
                className="h-10 flex-1 rounded-lg border border-border-focus bg-bg-base px-3 font-mono text-xs text-text-primary"
              />
              <Button variant="secondary" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <Button asChild className="w-full" variant="default">
          <Link href="/flex-members">
            View Flex Members
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ActiveFlexPlanPanel({
  member,
  activeIntervention,
  flexPerformance,
  borderClass,
}: {
  member: Member;
  activeIntervention: ActiveIntervention;
  flexPerformance?: FlexPerformance | null;
  borderClass: string;
}) {
  const breakdown = activeIntervention.pricing_breakdown;
  const projection = activeIntervention.value_projection;
  const base = breakdown?.base_weekly_cents ?? breakdown?.base_cents;
  const perEntry = breakdown?.per_entry_cents;
  const maxCap = breakdown?.max_cap_weekly_cents;
  const expectedVisits =
    breakdown?.expected_visits_per_week ?? breakdown?.expected_visits ?? null;
  const expectedWeekly =
    breakdown?.estimated_weekly_cents ??
    flexPerformance?.estimated_expected_weekly_cents ??
    null;
  const structureLabel =
    base != null && perEntry != null
      ? `${formatAUD(base)}/wk + ${formatAUD(perEntry)}/visit`
      : activeIntervention.offer_name;

  const daysOnPlan = flexPerformance?.days_on_plan;
  const hasThen =
    expectedWeekly != null || expectedVisits != null || projection != null;
  const hasNow = flexPerformance != null;
  const startedAt =
    activeIntervention.accepted_at ?? activeIntervention.applied_at;

  return (
    <Card className={cn("border-l-[3px]", borderClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
          <CardTitle className="text-base">Active Flex Plan</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-text-primary">
              {activeIntervention.offer_name}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Started{" "}
              <span className="font-medium text-status-applied">
                {formatAppliedAt(startedAt)}
              </span>
              {daysOnPlan != null ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-text-secondary">
                    {daysOnPlan} day{daysOnPlan === 1 ? "" : "s"} on plan
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <Badge className="border-status-applied/40 bg-status-applied/10 text-status-applied">
            Applied ✓
          </Badge>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Flex structure
          </p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">
            {structureLabel}
            {maxCap != null ? (
              <span className="font-normal text-text-muted">
                {" "}
                · max {formatAUD(maxCap)}/wk
              </span>
            ) : null}
          </p>
        </div>

        {hasThen ? (
          <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              At switch
            </p>
            {expectedWeekly != null || expectedVisits != null ? (
              <p className="text-sm text-text-primary">
                Expected{" "}
                {expectedWeekly != null ? (
                  <span className="font-medium tabular-nums">
                    ~{formatAUD(expectedWeekly)}/wk
                  </span>
                ) : null}
                {expectedVisits != null ? (
                  <span className="text-text-secondary">
                    {expectedWeekly != null ? " at " : ""}
                    {expectedVisits} visit
                    {expectedVisits === 1 ? "" : "s"}/wk
                  </span>
                ) : null}
              </p>
            ) : null}
            {projection ? (
              <p className="text-xs text-text-secondary">
                Projected value retained{" "}
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    improvementToneClass(projection.improvement_cents),
                  )}
                >
                  {formatSignedAUD(projection.improvement_cents)}
                </span>{" "}
                over {projection.horizon_months} mo
              </p>
            ) : null}
          </div>
        ) : null}

        {hasNow ? (
          <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              Since switch
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-primary">
              <span>
                <span className="font-medium tabular-nums">
                  {formatVisitsPerWeek(flexPerformance.actual_visits_per_week)}
                </span>
                <span className="text-text-secondary"> visits/wk</span>
                {flexPerformance.expected_visits_per_week != null ? (
                  <span className="text-text-muted">
                    {" "}
                    vs {flexPerformance.expected_visits_per_week} expected
                  </span>
                ) : null}
              </span>
              {flexPerformance.estimated_actual_weekly_cents != null ? (
                <span>
                  Est.{" "}
                  <span className="font-medium tabular-nums">
                    ~{formatAUD(flexPerformance.estimated_actual_weekly_cents)}
                    /wk
                  </span>
                </span>
              ) : null}
            </div>
            {flexPerformance.estimated_revenue_to_date_cents != null ? (
              <p className="text-xs text-text-secondary">
                Est. revenue to date{" "}
                <span className="font-medium tabular-nums text-text-primary">
                  {formatAUD(flexPerformance.estimated_revenue_to_date_cents)}
                </span>
                {" · "}
                {flexPerformance.visits_since_apply} visit
                {flexPerformance.visits_since_apply === 1 ? "" : "s"} logged
              </p>
            ) : (
              <p className="text-xs text-text-secondary">
                {flexPerformance.visits_since_apply} visit
                {flexPerformance.visits_since_apply === 1 ? "" : "s"} since
                apply
              </p>
            )}
            <p
              className={cn(
                "text-xs font-medium",
                member.risk_tier === "healthy"
                  ? "text-[var(--tier-healthy-text)]"
                  : flexPerformance.visit_pace === "behind"
                    ? "text-[var(--tier-critical-text)]"
                    : "text-brand-primary/90",
              )}
            >
              {flexStatusLine(member.risk_tier, flexPerformance.visit_pace)}
            </p>
          </div>
        ) : null}

        {projection?.series?.length ? (
          <div className="rounded-md border border-border-subtle bg-bg-base px-2 py-2">
            <p className="mb-1 px-1 text-[11px] uppercase tracking-wide text-text-muted">
              Expected value at switch
            </p>
            <FlexPlanValueChart projection={projection} />
          </div>
        ) : null}

        {activeIntervention.pinch_subscription_id ? (
          <p className="text-xs text-text-muted">
            Pinch subscription{" "}
            <span className="font-mono text-text-secondary">
              {activeIntervention.pinch_subscription_id}
            </span>
          </p>
        ) : null}

        <Button asChild className="w-full" variant="default">
          <Link href="/flex-members">
            View Flex Members
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function MemberOfferPanel({
  member,
  offer,
  insight,
  pricingBreakdown,
  valueProjection,
  activeIntervention,
  flexPerformance,
}: {
  member: Member;
  offer: SuggestedOffer | null;
  insight: MemberInsight;
  pricingBreakdown?: PricingBreakdown | null;
  valueProjection?: ValueProjection | null;
  activeIntervention?: ActiveIntervention | null;
  flexPerformance?: FlexPerformance | null;
}) {
  const [open, setOpen] = useState(false);
  const linked = isPinchPayerLinked(member.pinch_payer_id);
  const borderClass = tierAccentClass(member.risk_tier);

  if (activeIntervention?.status === "offered") {
    return (
      <OfferedFlexPlanPanel
        activeIntervention={activeIntervention}
        borderClass={borderClass}
      />
    );
  }

  if (activeIntervention?.status === "applied") {
    return (
      <ActiveFlexPlanPanel
        member={member}
        activeIntervention={activeIntervention}
        flexPerformance={flexPerformance}
        borderClass={borderClass}
      />
    );
  }

  if (insight.variant === "at-risk" && offer) {
    const base =
      pricingBreakdown?.base_weekly_cents ?? pricingBreakdown?.base_cents;
    const perEntry = pricingBreakdown?.per_entry_cents;
    const maxCap = pricingBreakdown?.max_cap_weekly_cents;
    const structureLabel =
      base != null && perEntry != null
        ? `${formatAUD(base)}/wk + ${formatAUD(perEntry)}/visit`
        : offer.amount_cents != null
          ? `~${formatAUD(offer.amount_cents)}/wk`
          : null;
    const estimated =
      pricingBreakdown?.estimated_weekly_cents ?? offer.amount_cents;

    return (
      <>
        <Card className={cn("border-l-[3px]", borderClass)}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-brand-primary"
                strokeWidth={1.5}
              />
              <CardTitle className="text-base">Recommended Intervention</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {offer.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {offer.description}
              </p>
            </div>

            <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">
                Flex structure
              </p>
              <p className="mt-0.5 text-sm font-medium text-text-primary">
                {structureLabel ?? offer.name}
              </p>
              {estimated != null && pricingBreakdown?.expected_visits != null ? (
                <p className="mt-1 text-xs text-text-muted">
                  ~{formatAUD(estimated)}/wk at{" "}
                  {pricingBreakdown.expected_visits} visit
                  {pricingBreakdown.expected_visits === 1 ? "" : "s"}/week
                  {maxCap != null
                    ? ` · max ${formatAUD(maxCap)}/wk`
                    : ""}
                </p>
              ) : null}
            </div>

            {pricingBreakdown ? (
              <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">
                  How we priced this
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>
                    Leave in{" "}
                    <span className="font-medium text-text-primary tabular-nums">
                      {pricingBreakdown.months_to_quit} mo
                    </span>
                  </span>
                  <span>
                    Flex stay{" "}
                    <span className="font-medium text-text-primary tabular-nums">
                      ~{pricingBreakdown.flex_retention_months} mo
                    </span>
                  </span>
                  {pricingBreakdown.break_even_visits != null ? (
                    <span>
                      Break-even{" "}
                      <span className="font-medium text-text-primary tabular-nums">
                        {pricingBreakdown.break_even_visits} visits/wk
                      </span>
                    </span>
                  ) : null}
                  {maxCap != null ? (
                    <span>
                      Max cap{" "}
                      <span className="font-medium text-text-primary tabular-nums">
                        {formatAUD(maxCap)}/wk
                      </span>
                    </span>
                  ) : null}
                  {pricingBreakdown.weekly_rate_cents != null ? (
                    <span>
                      Unlimited{" "}
                      <span className="font-medium text-text-primary tabular-nums">
                        {formatAUD(pricingBreakdown.weekly_rate_cents)}/wk
                      </span>
                    </span>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {pricingBreakdown.explanation}
                </p>
              </div>
            ) : null}

            {valueProjection ? (
              <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2.5 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">
                  {valueProjection.horizon_months}-mo value
                </p>
                <p className="text-sm text-text-primary">
                  <span className="font-medium tabular-nums">
                    {formatAUD(valueProjection.flex_total_cents)}
                  </span>
                  <span className="text-text-muted"> flex vs </span>
                  <span className="font-medium tabular-nums">
                    {formatAUD(valueProjection.current_total_cents)}
                  </span>
                  <span className="text-text-muted"> full price</span>
                </p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    improvementToneClass(valueProjection.improvement_cents),
                  )}
                >
                  {formatSignedAUD(valueProjection.improvement_cents)} over{" "}
                  {valueProjection.horizon_months} mo
                </p>
                <p className="text-[11px] text-text-muted">
                  Full price{" "}
                  {formatAUD(valueProjection.current_plan_monthly_cents)}/mo ×{" "}
                  {valueProjection.full_price_months} mo
                </p>
              </div>
            ) : null}

            <Badge variant="outline" className="font-mono text-[11px]">
              {offer.pinch_mechanism}
            </Badge>

            <div className="space-y-2 pt-1">
              <Button
                className="w-full"
                disabled={!linked}
                onClick={() => setOpen(true)}
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
                Send Offer
              </Button>
              {!linked ? (
                <p className="text-center text-xs text-text-muted">
                  Pinch payer not linked
                </p>
              ) : null}
              <Link
                href="/actions"
                className="block w-full text-center text-xs text-text-muted hover:text-brand-primary"
              >
                Browse alternative offers
              </Link>
            </div>
          </CardContent>
        </Card>

        <ApplyOfferModal
          open={open}
          onOpenChange={setOpen}
          member={member}
          offer={offer}
          pricingBreakdown={pricingBreakdown}
        />
      </>
    );
  }

  if (insight.variant === "at-risk" && !offer) {
    return (
      <Card className={cn("border-l-[3px]", borderClass)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-brand-primary"
              strokeWidth={1.5}
            />
            <CardTitle className="text-base">Recommended Intervention</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            Flex isn&apos;t recommended — the value projection isn&apos;t
            better than the expected quit path. You can still take other
            retention actions outside RetainIQ+.
          </p>
          <Badge variant="secondary" className="mt-4">
            Monitor
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const planLabel =
    member.membership_plan === "flex" || member.membership_plan === "premium"
      ? "Flex Plan"
      : `${formatMembershipPlan(member.membership_plan)} Plan`;
  const statusLabel =
    member.risk_tier === "healthy"
      ? "Healthy"
      : member.risk_tier === "watch"
        ? "Watch"
        : "Monitoring";
  const flexChurnDelta = formatFlexChurnDelta(insight);

  return (
    <div className="space-y-4">
      <Card className={cn("border-l-[3px]", borderClass)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
            <CardTitle className="text-base">Active Strategy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {planLabel}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Status:{" "}
                <span
                  className={cn(
                    "font-medium",
                    member.risk_tier === "healthy"
                      ? "text-[var(--tier-healthy-text)]"
                      : "text-text-secondary",
                  )}
                >
                  {statusLabel}
                </span>
              </p>
            </div>
            <Badge variant="secondary">{capitalize(member.risk_tier)}</Badge>
          </div>

          <p className="text-sm leading-relaxed text-text-secondary">
            {insight.strategyCopy}
          </p>

          <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2.5">
            <History className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-muted">
                Converted from
              </p>
              <p className="text-sm text-text-primary">{insight.convertedFrom}</p>
            </div>
          </div>

          <Button asChild className="w-full" variant="default">
            <Link href="/flex-members">
              View Performance Details
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-text-secondary">
            Risk Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-text-muted">Churn Probability (60d)</p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  insight.churnProbability >= 50
                    ? "text-[var(--tier-critical-text)]"
                    : "text-[var(--tier-healthy-text)]",
                )}
              >
                {insight.churnProbability}%
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-subtle">
              <div
                className={cn(
                  "h-full rounded-full",
                  insight.churnProbability >= 50
                    ? "bg-[#EF4444]"
                    : "bg-[#22C55E]",
                )}
                style={{ width: `${insight.churnProbability}%` }}
              />
            </div>
            {flexChurnDelta ? (
              <p className="mt-1.5 text-xs text-text-muted">{flexChurnDelta}</p>
            ) : null}
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-border-subtle pt-3">
            <p className="text-xs text-text-muted">Projected LTV</p>
            <p className="text-lg font-bold tabular-nums text-text-primary">
              {formatAUD(insight.ltvCents)}
            </p>
          </div>
          {insight.riskExposureCents != null &&
          insight.riskExposureCents > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-text-muted">At risk vs healthy</p>
              <p className="text-sm font-medium tabular-nums text-[var(--tier-critical-text)]">
                {formatAUD(insight.riskExposureCents)}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
