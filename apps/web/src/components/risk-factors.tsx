import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RiskFactor, RiskFactorLevel } from "@/lib/types";

const LEVEL_BAR: Record<RiskFactorLevel, string> = {
  critical: "bg-[#EF4444]",
  high: "bg-[#A78BFA]",
  stable: "bg-brand-primary",
  neutral: "bg-text-muted",
  low: "bg-[#22C55E]",
};

const LEVEL_TEXT: Record<RiskFactorLevel, string> = {
  critical: "text-[var(--tier-critical-text)]",
  high: "text-[#C4B5FD]",
  stable: "text-brand-primary",
  neutral: "text-text-secondary",
  low: "text-[var(--tier-healthy-text)]",
};

export function RiskFactors({ factors }: { factors: RiskFactor[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        Churn Risk Factors
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {factors.map((factor) => (
          <Card key={factor.key}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  {factor.title}
                </CardTitle>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    LEVEL_TEXT[factor.level],
                  )}
                >
                  {factor.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <p className="text-xs leading-relaxed text-text-secondary">
                {factor.description}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-border-subtle">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    LEVEL_BAR[factor.level],
                  )}
                  style={{ width: `${factor.severity}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
