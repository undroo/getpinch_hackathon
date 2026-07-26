"use client";

import { useState } from "react";
import { Activity, CalendarDays, Wallet } from "lucide-react";
import { CheckInChart } from "@/components/check-in-chart";
import { FlexPlanValueChart } from "@/components/flex-plan-value-chart";
import { LifecycleContext } from "@/components/lifecycle-context";
import { MemberMetricCard } from "@/components/member-metric-card";
import { MemberOfferPanel } from "@/components/member-offer-panel";
import { RiskFactors } from "@/components/risk-factors";
import { tierNumberClass } from "@/components/tier-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MemberInsight } from "@/lib/member-insights";
import type {
  ActiveIntervention,
  CheckIn,
  FlexPerformance,
  Member,
  PricingBreakdown,
  SuggestedOffer,
  ValueProjection,
} from "@/lib/types";
import {
  formatAUD,
  formatRelativeDays,
  formatSignedAUD,
  improvementToneClass,
} from "@/lib/utils";

type SelectedMetric = "churn" | "engagement" | "ltv" | "days";
type ViewMode = "churn" | "ltv";

function modeForMetric(metric: SelectedMetric): ViewMode {
  return metric === "ltv" ? "ltv" : "churn";
}

export function MemberDetailInsights({
  member,
  checkIns,
  daysSinceVisit,
  suggestedOffer,
  activeIntervention,
  pricingBreakdown,
  valueProjection,
  flexPerformance,
  insight,
}: {
  member: Member;
  checkIns: CheckIn[];
  daysSinceVisit: number | null;
  suggestedOffer: SuggestedOffer | null;
  activeIntervention?: ActiveIntervention | null;
  pricingBreakdown?: PricingBreakdown | null;
  valueProjection: ValueProjection | null;
  flexPerformance?: FlexPerformance | null;
  insight: MemberInsight;
}) {
  const [selectedMetric, setSelectedMetric] =
    useState<SelectedMetric>("churn");
  const mode = modeForMetric(selectedMetric);
  const tierColor = tierNumberClass(member.risk_tier);
  const days = daysSinceVisit;

  return (
    <div className="space-y-8">
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Member insight modes"
      >
        <MemberMetricCard
          label="60-Day Churn Probability"
          value={`${insight.churnProbability}%`}
          sub={<span className={tierColor}>{insight.churnTrendLabel}</span>}
          valueClassName={tierColor}
          emphasized={member.risk_tier === "critical"}
          ringPercent={insight.churnProbability}
          interactive
          selected={selectedMetric === "churn"}
          onSelect={() => setSelectedMetric("churn")}
        />
        <MemberMetricCard
          label="Engagement Score"
          value={`${insight.engagementScore} / 100`}
          sub={insight.engagementLabel}
          icon={Activity}
          valueClassName={tierColor}
          interactive
          selected={selectedMetric === "engagement"}
          onSelect={() => setSelectedMetric("engagement")}
        />
        <MemberMetricCard
          label="LTV Forecast"
          value={formatAUD(insight.ltvCents)}
          sub={
            insight.riskExposureCents != null && insight.riskExposureCents > 0
              ? `${formatAUD(insight.riskExposureCents)} at risk vs healthy tenure`
              : "Projected retention value"
          }
          icon={Wallet}
          valueClassName="text-text-primary"
          interactive
          selected={selectedMetric === "ltv"}
          onSelect={() => setSelectedMetric("ltv")}
        />
        <MemberMetricCard
          label="Days Since Visit"
          value={days === null ? "—" : String(days)}
          sub={
            days !== null && days >= 14 ? (
              <span className="font-semibold uppercase tracking-wide text-[var(--tier-critical-text)]">
                Action Required
              </span>
            ) : (
              formatRelativeDays(days)
            )
          }
          icon={CalendarDays}
          valueClassName={tierColor}
          emphasized={days !== null && days >= 21}
          interactive
          selected={selectedMetric === "days"}
          onSelect={() => setSelectedMetric("days")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {mode === "churn" ? (
            <>
              <Card>
                <CardContent className="p-5 md:p-6">
                  <CheckInChart
                    checkIns={checkIns}
                    tier={member.risk_tier}
                    highlightCurrent
                    callout={
                      insight.successCallout ??
                      insight.monitoringNote ??
                      null
                    }
                  />
                </CardContent>
              </Card>
              <div id="member-risk-factors">
                <RiskFactors factors={insight.riskFactors} />
              </div>
            </>
          ) : (
            <LtvModePanel
              insight={insight}
              valueProjection={valueProjection}
            />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <MemberOfferPanel
            member={member}
            offer={suggestedOffer}
            insight={insight}
            pricingBreakdown={pricingBreakdown}
            valueProjection={valueProjection}
            activeIntervention={activeIntervention}
            flexPerformance={flexPerformance}
          />
          {mode === "ltv" ? (
            <LifecycleContext items={insight.lifecycle} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LtvModePanel({
  insight,
  valueProjection,
}: {
  insight: MemberInsight;
  valueProjection: ValueProjection | null;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Lifetime value outlook
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Dollar impact of retention vs expected churn
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricStat
              label="LTV Forecast"
              value={formatAUD(insight.ltvCents)}
              sub={
                insight.riskExposureCents != null &&
                insight.riskExposureCents > 0
                  ? `${formatAUD(insight.riskExposureCents)} at risk vs healthy tenure`
                  : undefined
              }
            />
            <MetricStat
              label="Flex improvement"
              value={
                valueProjection
                  ? formatSignedAUD(valueProjection.improvement_cents)
                  : "—"
              }
              valueClassName={
                valueProjection
                  ? improvementToneClass(valueProjection.improvement_cents)
                  : "text-text-muted"
              }
              sub={
                valueProjection
                  ? `Over ${valueProjection.horizon_months} mo`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5 md:p-6">
          {valueProjection ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Flex plan value impact
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {valueProjection.flex_plan_label} vs expected quit at full
                    price
                  </p>
                </div>
                <p
                  className={`text-xs tabular-nums ${improvementToneClass(
                    valueProjection.improvement_cents,
                  )}`}
                >
                  {formatSignedAUD(valueProjection.improvement_cents)} over{" "}
                  {valueProjection.horizon_months} mo
                </p>
              </div>
              <FlexPlanValueChart projection={valueProjection} />
              <div className="overflow-hidden rounded-md border border-border-subtle">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-base text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Path</th>
                      <th className="px-3 py-2.5 font-medium text-right">
                        {valueProjection.horizon_months}-mo total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-text-secondary">
                    <tr>
                      <td className="px-3 py-2.5">
                        <span className="text-text-primary">
                          Full price (expected quit)
                        </span>
                        <span className="mt-0.5 block text-[11px] text-text-muted">
                          {formatAUD(valueProjection.current_plan_monthly_cents)}
                          /mo × {valueProjection.full_price_months} mo
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                        {formatAUD(valueProjection.current_total_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">
                        <span className="text-text-primary">
                          With {valueProjection.flex_plan_label}
                        </span>
                        {valueProjection.flex_retention_months != null ? (
                          <span className="mt-0.5 block text-[11px] text-text-muted">
                            Retained ~{valueProjection.flex_retention_months} mo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                        {formatAUD(valueProjection.flex_total_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-medium text-text-primary">
                        Difference
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-medium tabular-nums ${improvementToneClass(
                          valueProjection.improvement_cents,
                        )}`}
                      >
                        {formatSignedAUD(valueProjection.improvement_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border-subtle bg-bg-base px-4 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">
                No flex projection available
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Apply or preview a flex plan offer to see dollar impact over
                time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricStat({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
          valueClassName ?? "text-text-primary"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p> : null}
    </div>
  );
}
