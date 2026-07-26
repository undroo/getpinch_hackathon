import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceDayBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

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

          <div className="flex min-w-0 flex-1 gap-px sm:gap-0.5">
            {byDay.map((day, index) => {
              const height = Math.max(
                day.check_ins > 0 ? 8 : 4,
                Math.round((day.check_ins / max) * 100),
              );
              const showLabel =
                index % labelEvery === 0 || index === byDay.length - 1;

              return (
                <div
                  key={day.date}
                  className="group relative flex h-full min-w-0 flex-1 flex-col"
                >
                  <div
                    role="img"
                    aria-label={`${formatDayLabel(day.date)}: ${day.check_ins} check-ins`}
                    className="flex min-h-0 flex-1 cursor-default items-end justify-center"
                  >
                    <div
                      className={cn(
                        "w-full max-w-[12px] rounded-sm transition-colors",
                        day.check_ins > 0
                          ? "bg-brand-primary/75"
                          : "bg-border-subtle/90",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "flex h-5 items-center justify-center text-[9px] font-medium tracking-wide text-text-muted",
                      !showLabel && "opacity-0",
                    )}
                  >
                    {showLabel ? formatDayLabel(day.date) : "·"}
                  </span>
                  <span
                    className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-hidden
                  >
                    {formatDayLabel(day.date)} · {day.check_ins} check-in
                    {day.check_ins === 1 ? "" : "s"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
