import type { PricingBreakdown } from "@/lib/types";
import { flexPricingParts, formatAUD } from "@/lib/utils";

/** Large hero price for expected weekly cost. */
export function formatFlexTypicalHeroLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const { estimatedWeekly } = flexPricingParts(bd);
  if (estimatedWeekly == null) return null;
  return `~${formatAUD(estimatedWeekly)}/wk`;
}

export const FLEX_TYPICAL_SUBLINE = "at your usual visits";

/** Secondary line for cards when hero styling isn’t used. */
export function formatFlexTypicalLabel(
  bd: PricingBreakdown | null | undefined,
): string | null {
  const hero = formatFlexTypicalHeroLabel(bd);
  if (!hero) return null;
  return `About ${hero.slice(1)} ${FLEX_TYPICAL_SUBLINE}`;
}

export function flexOfferBenefits(rangeLabel: string | null): string[] {
  return [
    "Pay for how often you go — lower bill when you visit less",
    "Cheaper than unlimited when visits are casual",
    rangeLabel
      ? `Weekly bill stays within ${rangeLabel}`
      : "Weekly bill stays within a capped range",
  ];
}

export const FLEX_RANGE_TRUST_LINE =
  "You’ll never pay more than the top of this range.";

export const FLEX_HOW_IT_WORKS_HEADING = "How it works";

export const FLEX_HOW_IT_WORKS_DETAIL =
  "A small weekly base plus a charge each time you check in.";
