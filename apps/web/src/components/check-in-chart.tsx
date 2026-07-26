import { Sparkles } from "lucide-react";
import { BarChartColumn } from "@/components/bar-chart-column";
import type { CheckIn, RiskTier } from "@/lib/types";
import { monthlyCheckInBuckets } from "@/lib/member-insights";
import { cn } from "@/lib/utils";

export function CheckInChart({
  checkIns,
  tier,
  callout,
  highlightCurrent = false,
}: {
  checkIns: CheckIn[];
  tier: RiskTier;
  callout?: string | null;
  highlightCurrent?: boolean;
}) {
  const months = monthlyCheckInBuckets(checkIns, 6);
  const max = Math.max(1, ...months.map((m) => m.count));
  const yTicks = [...new Set([max, Math.round(max / 2), 0])].sort(
    (a, b) => b - a,
  );

  const recent = [...checkIns]
    .sort(
      (a, b) =>
        new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime(),
    )
    .slice(0, 6);

  const lowestKey = months.reduce((lowest, m) =>
    m.count < lowest.count ? m : lowest,
  ).key;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4">
          <p className="text-sm font-medium text-text-primary">
            Attendance Trend
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Check-ins per month · last 6 months
          </p>
        </div>

        <div className="flex h-44 gap-1.5 rounded-md border border-border-subtle bg-bg-base px-3 pb-2 pt-4 sm:gap-2 sm:px-4">
          <div className="flex w-3 shrink-0 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <span className="rotate-180 text-[9px] tracking-wide text-text-muted [writing-mode:vertical-rl]">
                check-ins
              </span>
            </div>
            <div className="h-5" aria-hidden />
          </div>

          <div className="flex w-5 shrink-0 flex-col">
            <div className="relative min-h-0 flex-1">
              {yTicks.map((tick) => {
                const top = ((max - tick) / max) * 100;
                return (
                  <span
                    key={tick}
                    className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-text-muted"
                    style={{ top: `${top}%` }}
                  >
                    {tick}
                  </span>
                );
              })}
            </div>
            <div className="h-5" aria-hidden />
          </div>

          <div className="flex h-full min-w-0 flex-1 gap-3 sm:gap-4">
            {months.map((month) => {
              const heightPct = Math.max(
                8,
                Math.round((month.count / max) * 100),
              );
              const emphasize =
                highlightCurrent &&
                (month.isCurrent || month.key === lowestKey) &&
                (tier === "critical" || tier === "slipping");

              return (
                <BarChartColumn
                  key={month.key}
                  heightPct={heightPct}
                  maxBarWidth={48}
                  barClassName={
                    emphasize
                      ? tier === "critical"
                        ? "bg-[var(--tier-critical-border)]"
                        : "bg-[var(--tier-slipping-border)]"
                      : month.count > 0
                        ? "bg-brand-primary"
                        : "bg-border-subtle"
                  }
                  label={month.label}
                  labelClassName={cn(
                    "text-[10px]",
                    emphasize ? "text-text-primary" : "text-text-muted",
                  )}
                  ariaLabel={`${month.label}: ${month.count} check-ins`}
                  tooltip={`${month.count} check-in${month.count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {callout ? (
        <div className="flex gap-3 rounded-md border border-brand-primary/30 bg-brand-primary/5 px-3 py-3">
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
            strokeWidth={1.5}
          />
          <p className="text-sm leading-relaxed text-text-secondary">
            {callout}
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-sm font-medium text-text-primary">
          Recent check-ins
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-text-muted">No check-ins recorded.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((c) => (
              <li
                key={c.checked_in_at}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-base px-3 py-2"
              >
                <span className="font-mono text-xs text-text-secondary">
                  {new Date(c.checked_in_at).toLocaleString("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="text-xs text-text-muted">check-in</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
