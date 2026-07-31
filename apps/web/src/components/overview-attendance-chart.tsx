import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { BarChartColumn } from "@/components/bar-chart-column";
import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceDayBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatAvg(value: number): string {
  return value.toLocaleString("en-AU", { maximumFractionDigits: 0 });
}

function ComparisonRow({
  value,
  average,
  label,
}: {
  value: number;
  average: number;
  label: string;
}) {
  const delta = value - average;
  const better = delta > 0;
  const worse = delta < 0;
  const Icon = better ? ArrowUp : worse ? ArrowDown : Minus;
  const color = better
    ? "text-[var(--tier-healthy-text)]"
    : worse
      ? "text-[var(--tier-critical-text)]"
      : "text-text-muted";

  return (
    <p className={cn("flex items-center gap-1.5 text-xs", color)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {formatAvg(average)}/day · {label}
      </span>
    </p>
  );
}

export function OverviewAttendanceChart({
  yesterdayUniqueMembers,
  avgDailyUsers30d,
  avgDailyUsers180d,
  byDay,
}: {
  yesterdayUniqueMembers: number;
  avgDailyUsers30d: number;
  avgDailyUsers180d: number;
  byDay: AttendanceDayBucket[];
}) {
  const max = Math.max(1, ...byDay.map((d) => d.unique_members));
  const yTicks = [...new Set([max, Math.round(max / 2), 0])].sort(
    (a, b) => b - a,
  );

  // Show ~6–8 x-axis labels so a 30-day series stays readable.
  const labelEvery = Math.max(1, Math.ceil(byDay.length / 7));

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5 md:p-6">
        <p className="text-sm font-medium text-text-secondary">
          Average daily users
        </p>
        <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-text-primary md:text-5xl">
          {yesterdayUniqueMembers.toLocaleString("en-AU")}
        </p>
        <p className="mt-2 text-xs text-text-muted">Yesterday</p>

        <div className="mt-3 space-y-1.5">
          <ComparisonRow
            value={yesterdayUniqueMembers}
            average={avgDailyUsers30d}
            label="last 30 days"
          />
          <ComparisonRow
            value={yesterdayUniqueMembers}
            average={avgDailyUsers180d}
            label="last 6 months"
          />
        </div>

        <div className="mt-auto flex h-40 gap-1.5 rounded-md border border-border-subtle bg-bg-base px-3 pb-2 pt-4 sm:gap-2 sm:px-4">
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
            {byDay.map((day, index) => {
              const heightPct = Math.max(
                day.unique_members > 0 ? 8 : 4,
                Math.round((day.unique_members / max) * 100),
              );
              const showLabel =
                index % labelEvery === 0 || index === byDay.length - 1;
              const dayLabel = formatDayLabel(day.date);

              return (
                <BarChartColumn
                  key={day.date}
                  heightPct={heightPct}
                  maxBarWidth={12}
                  barClassName={
                    day.unique_members > 0
                      ? "bg-brand-primary"
                      : "bg-border-subtle"
                  }
                  label={dayLabel}
                  showLabel={showLabel}
                  ariaLabel={`${dayLabel}: ${day.unique_members} unique members`}
                  tooltip={`${dayLabel} · ${day.unique_members} unique member${day.unique_members === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
