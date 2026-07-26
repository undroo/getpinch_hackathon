import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MemberMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClassName,
  emphasized,
  ringPercent,
  selected,
  interactive,
  onSelect,
}: {
  label: string;
  value: string;
  sub: ReactNode;
  icon?: LucideIcon;
  valueClassName?: string;
  emphasized?: boolean;
  /** Optional 0–100 for a small progress ring */
  ringPercent?: number;
  selected?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
}) {
  const circumference = 2 * Math.PI * 14;
  const offset =
    ringPercent === undefined
      ? 0
      : circumference - (clamp(ringPercent, 0, 100) / 100) * circumference;

  const cardClassName = cn(
    "relative overflow-hidden text-left transition-colors",
    emphasized && !selected && "glow-critical border-[#7F1D1D]",
    selected &&
      "border-brand-primary bg-bg-elevated ring-1 ring-brand-primary/40",
    interactive &&
      !selected &&
      "cursor-pointer hover:border-border-focus hover:bg-bg-elevated/60",
    interactive &&
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50",
  );

  const content = (
    <CardContent className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </p>
        {ringPercent !== undefined ? (
          <svg width="36" height="36" viewBox="0 0 36 36" className="-mt-1">
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border-subtle"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(valueClassName ?? "text-brand-primary")}
              transform="rotate(-90 18 18)"
            />
          </svg>
        ) : Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              valueClassName ?? "text-text-muted",
            )}
            strokeWidth={1.5}
          />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tracking-tight tabular-nums md:text-3xl",
          valueClassName ?? "text-text-primary",
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 text-xs text-text-muted">{sub}</div>
    </CardContent>
  );

  if (interactive) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "rounded-lg border border-border-subtle bg-bg-surface text-text-primary shadow-card w-full",
          cardClassName,
        )}
      >
        {content}
      </button>
    );
  }

  return <Card className={cardClassName}>{content}</Card>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
