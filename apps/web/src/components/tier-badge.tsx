import { cn, capitalize } from "@/lib/utils";
import type { RiskTier } from "@/lib/types";

const TIER_CLASS: Record<RiskTier, string> = {
  critical: "tier-critical",
  slipping: "tier-slipping",
  healthy: "tier-healthy",
  watch: "tier-watch",
  unknown: "tier-unknown",
};

const TIER_LABEL: Record<RiskTier, string> = {
  critical: "Critical",
  slipping: "Slipping",
  healthy: "Healthy",
  watch: "Watch",
  unknown: "Unknown",
};

export function TierBadge({
  tier,
  className,
  label,
}: {
  tier: RiskTier;
  className?: string;
  /** Override displayed label (e.g. Recovered for healthy). */
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        TIER_CLASS[tier],
        tier === "critical" && "glow-critical",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tier === "critical" && "bg-[var(--tier-critical-border)]",
          tier === "slipping" && "bg-[var(--tier-slipping-border)]",
          tier === "healthy" && "bg-[var(--tier-healthy-border)]",
          tier === "watch" && "bg-[var(--tier-watch-border)]",
          tier === "unknown" && "bg-[var(--tier-unknown-border)]",
        )}
      />
      {label ?? TIER_LABEL[tier] ?? capitalize(tier)}
    </span>
  );
}

export function tierAccentClass(tier: RiskTier): string {
  switch (tier) {
    case "critical":
      return "border-l-[var(--tier-critical-border)]";
    case "slipping":
      return "border-l-[var(--tier-slipping-border)]";
    case "healthy":
      return "border-l-[var(--tier-healthy-border)]";
    case "watch":
      return "border-l-[var(--tier-watch-border)]";
    default:
      return "border-l-[var(--tier-unknown-border)]";
  }
}

export function tierNumberClass(tier: RiskTier): string {
  switch (tier) {
    case "critical":
      return "text-[var(--tier-critical-text)]";
    case "slipping":
      return "text-[var(--tier-slipping-text)]";
    case "healthy":
      return "text-[var(--tier-healthy-text)]";
    default:
      return "text-text-muted";
  }
}
