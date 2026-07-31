import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/types";
import { tierNumberClass } from "@/components/tier-badge";

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  tier,
  emphasized,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  subtext: string;
  icon: LucideIcon;
  tier: RiskTier;
  emphasized?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative overflow-hidden transition-colors duration-150",
        emphasized && !selected && "border-[var(--tier-critical-border)]",
        selected && "border-brand-primary ring-2 ring-brand-primary/40",
        interactive &&
          "cursor-pointer hover:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50",
      )}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <Icon
            className={cn("h-4 w-4", tierNumberClass(tier))}
            strokeWidth={1.5}
          />
        </div>
        <p
          className={cn(
            "mt-3 text-4xl font-bold tracking-tight tabular-nums md:text-5xl",
            tierNumberClass(tier),
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-xs text-text-muted">{subtext}</p>
      </CardContent>
    </Card>
  );
}
