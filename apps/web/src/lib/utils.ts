import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PricingBreakdown } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAUD(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

/** Like formatAUD, but prefixes "+" for positive amounts. */
export function formatSignedAUD(cents: number): string {
  if (cents > 0) return `+${formatAUD(cents)}`;
  return formatAUD(cents);
}

export function improvementToneClass(cents: number): string {
  if (cents > 0) return "text-status-applied";
  if (cents < 0) return "text-[var(--tier-critical-text)]";
  return "text-text-muted";
}

export function formatRelativeDays(days: number | null): string {
  if (days === null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Display label for membership_plan. Flex is a pricing model; premium maps to Flex (legacy). */
export function formatMembershipPlan(plan: string | null | undefined): string {
  if (plan === "flex" || plan === "premium") return "Flex";
  if (plan === "standard") return "Standard";
  if (!plan) return "Standard";
  return capitalize(plan);
}

export function isPinchPayerLinked(
  payerId: string | null | undefined,
): boolean {
  if (!payerId) return false;
  return !payerId.startsWith("REPLACE_");
}

export interface FlexPricingParts {
  base: number | null;
  perEntry: number | null;
  maxCap: number | null;
  expectedVisits: number | null;
  estimatedWeekly: number | null;
}

export function flexPricingParts(
  bd: PricingBreakdown | null | undefined,
): FlexPricingParts {
  if (!bd) {
    return {
      base: null,
      perEntry: null,
      maxCap: null,
      expectedVisits: null,
      estimatedWeekly: null,
    };
  }
  const base = bd.base_weekly_cents ?? bd.base_cents ?? null;
  const perEntry = bd.per_entry_cents ?? null;
  const maxCap = bd.max_cap_weekly_cents ?? null;
  const expectedVisits =
    bd.expected_visits_per_week ?? bd.expected_visits ?? null;
  const estimatedWeekly =
    bd.estimated_weekly_cents ?? bd.amount_cents ?? null;
  return { base, perEntry, maxCap, expectedVisits, estimatedWeekly };
}

export function formatFlexStructureLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { base, perEntry } = flexPricingParts(bd);
  if (base == null || perEntry == null) return null;
  return `${formatAUD(base)}/wk + ${formatAUD(perEntry)}/visit`;
}

export function formatFlexWeeklyRangeLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { base, maxCap } = flexPricingParts(bd);
  if (base == null || maxCap == null) return null;
  return `${formatAUD(base)}–${formatAUD(maxCap)}/wk`;
}

export function formatFlexEstimateLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { expectedVisits, estimatedWeekly, maxCap } = flexPricingParts(bd);
  if (expectedVisits == null || estimatedWeekly == null) return null;
  const capSuffix =
    maxCap != null ? ` · max ${formatAUD(maxCap)}/wk` : "";
  return `~${formatAUD(estimatedWeekly)}/wk at ${expectedVisits} visit${
    expectedVisits === 1 ? "" : "s"
  }/week${capSuffix}`;
}

export function formatFlexFallbackWeeklyLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { estimatedWeekly } = flexPricingParts(bd);
  if (estimatedWeekly == null) return null;
  return `~${formatAUD(estimatedWeekly)}/wk estimated weekly bill`;
}

/** Monthly base fee charged on Pinch confirm (weekly base × 4). */
export function formatFlexPinchConfirmAmount(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { base } = flexPricingParts(bd);
  if (base == null) return null;
  return `${formatAUD(base * 4)}/mo base fee`;
}
