import { BarChartColumn } from "@/components/bar-chart-column";
import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceDayBucket } from "@/lib/types";

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function OverviewAttendanceChart({
  totalCheckIns,
  uniqueMembers,
  windowDays,
  byDay,
}: {
  totalCheckIns: number;
  uniqueMembers: number;
  windowDays: number;
  byDay: AttendanceDayBucket[];
}) {
  const max = Math.max(1, ...byDay.map((d) => d.check_ins));
  const yTicks = [...new Set([max, Math.round(max / 2), 0])].sort(
    (a, b) => b - a,
  );

  // Show ~6–8 x-axis labels so a 30-day series stays readable.
  const labelEvery = Math.max(1, Math.ceil(byDay.length / 7));

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <p className="text-sm font-medium text-text-secondary">
          Overall attendance
        </p>
        <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-text-primary md:text-5xl">
          {totalCheckIns.toLocaleString("en-AU")}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Check-ins · last {windowDays} days · {uniqueMembers.toLocaleString("en-AU")}{" "}
          members
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
            {byDay.map((day, index) => {
              const heightPct = Math.max(
                day.check_ins > 0 ? 8 : 4,
                Math.round((day.check_ins / max) * 100),
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
                    day.check_ins > 0
                      ? "bg-brand-primary"
                      : "bg-border-subtle"
                  }
                  label={dayLabel}
                  showLabel={showLabel}
                  ariaLabel={`${dayLabel}: ${day.check_ins} check-ins`}
                  tooltip={`${dayLabel} · ${day.check_ins} check-in${day.check_ins === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
