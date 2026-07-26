import { BarChartColumn } from "@/components/bar-chart-column";
import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceHourBucket } from "@/lib/types";

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function OverviewPeakHoursChart({
  byHour,
  windowDays,
}: {
  byHour: AttendanceHourBucket[];
  windowDays: number;
}) {
  const max = Math.max(1, ...byHour.map((h) => h.check_ins));
  const peak = byHour.reduce(
    (best, h) => (h.check_ins > best.check_ins ? h : best),
    byHour[0] ?? { hour: 0, check_ins: 0 },
  );
  const yTicks = [...new Set([max, Math.round(max / 2), 0])].sort(
    (a, b) => b - a,
  );

  // Label every 3 hours for readability.
  const labelHours = new Set([0, 6, 9, 12, 15, 18, 21]);

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <p className="text-sm font-medium text-text-secondary">Peak hours</p>
        <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-text-primary md:text-5xl">
          {peak.check_ins > 0 ? formatHourLabel(peak.hour) : "—"}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Busiest hour · last {windowDays} days
          {peak.check_ins > 0
            ? ` · ${peak.check_ins.toLocaleString("en-AU")} check-ins`
            : ""}
        </p>

        <div className="mt-5 flex h-40 gap-1.5 rounded-md border border-border-subtle bg-bg-base px-3 pb-2 pt-4 sm:gap-2 sm:px-4">
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

          <div className="flex h-full min-w-0 flex-1 gap-px sm:gap-0.5">
            {byHour.map((bucket) => {
              const heightPct = Math.max(
                bucket.check_ins > 0 ? 8 : 4,
                Math.round((bucket.check_ins / max) * 100),
              );
              const isPeak =
                peak.check_ins > 0 && bucket.hour === peak.hour;
              const showLabel = labelHours.has(bucket.hour);
              const hourLabel = formatHourLabel(bucket.hour);

              return (
                <BarChartColumn
                  key={bucket.hour}
                  heightPct={heightPct}
                  maxBarWidth={14}
                  barClassName={
                    isPeak
                      ? "bg-brand-primary"
                      : bucket.check_ins > 0
                        ? "bg-[color-mix(in_srgb,var(--brand-primary)_70%,transparent)]"
                        : "bg-border-subtle"
                  }
                  label={hourLabel}
                  showLabel={showLabel}
                  labelClassName={isPeak ? "text-text-primary" : undefined}
                  ariaLabel={`${hourLabel}: ${bucket.check_ins} check-ins`}
                  tooltip={`${hourLabel} · ${bucket.check_ins} check-in${bucket.check_ins === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
