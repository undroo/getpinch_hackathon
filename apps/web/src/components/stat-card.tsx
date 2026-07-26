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
}: {
  label: string;
  value: number;
  subtext: string;
  icon: LucideIcon;
  tier: RiskTier;
  emphasized?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        emphasized && "glow-critical border-[#ba1a1a]",
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
