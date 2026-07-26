import { cn } from "@/lib/utils";

export function BarChartColumn({
  heightPct,
  barClassName,
  label,
  showLabel = true,
  labelClassName,
  ariaLabel,
  tooltip,
  maxBarWidth = 12,
}: {
  heightPct: number;
  barClassName?: string;
  label: string;
  showLabel?: boolean;
  labelClassName?: string;
  ariaLabel: string;
  tooltip: string;
  maxBarWidth?: 12 | 14 | 48;
}) {
  const maxWidthClass =
    maxBarWidth === 48
      ? "max-w-[48px]"
      : maxBarWidth === 14
        ? "max-w-[14px]"
        : "max-w-[12px]";

  return (
    <div className="group relative flex h-full min-w-0 flex-1 flex-col">
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex min-h-0 flex-1 cursor-default items-end justify-center"
      >
        <div
          className={cn(
            "w-full rounded-sm transition-colors",
            maxWidthClass,
            barClassName,
          )}
          style={{ height: `${heightPct}%` }}
        />
      </div>
      <span
        className={cn(
          "flex h-5 items-center justify-center text-[9px] font-medium tracking-wide text-text-muted",
          !showLabel && "opacity-0",
          labelClassName,
        )}
      >
        {showLabel ? label : "·"}
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        aria-hidden
      >
        {tooltip}
      </span>
    </div>
  );
}
