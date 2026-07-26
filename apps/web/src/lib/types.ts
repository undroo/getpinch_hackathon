export type RiskTier =
  | "critical"
  | "slipping"
  | "watch"
  | "healthy"
  | "unknown";

export type FlexPlanStatus =
  | "suggested"
  | "offered"
  | "applied"
  | "pending"
  | "failed";

export type OfferSlug = "hold_plan" | "winback_link";

export type MemberSort = "severity" | "name" | "last_visit";

export type MembershipPlan = "standard" | "premium" | "flex";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  risk_tier: RiskTier;
  visits_30d: number;
  days_since_last_visit: number | null;
  membership_plan: MembershipPlan;
  pinch_payer_id: string | null;
  joined_at: string;
}

export interface CheckIn {
  checked_in_at: string;
}

export interface SuggestedOffer {
  slug: OfferSlug;
  name: string;
  description: string;
  offer_type: "plan_switch" | "payment_link";
  amount_cents: number | null;
  pinch_mechanism: string;
}

export type RiskFactorLevel =
  | "critical"
  | "high"
  | "stable"
  | "neutral"
  | "low";

export interface RiskFactor {
  key: string;
  title: string;
  level: RiskFactorLevel;
  label: string;
  description: string;
  /** 0–100 fill for status bar */
  severity: number;
}

export interface MemberInsights {
  churn_probability: number;
  churn_trend_label: string;
  engagement_score: number;
  engagement_label: string;
  ltv_cents: number;
  /** Gap vs healthy 24-mo tenure at unlimited rate */
  risk_exposure_cents?: number;
  visit_slope_90d: number;
  risk_factors: RiskFactor[];
}

export interface ValueProjectionSeriesPoint {
  month: number;
  current_cumulative_cents: number;
  flex_cumulative_cents: number;
}

export interface ValueProjection {
  horizon_months: number;
  current_plan_monthly_cents: number;
  full_price_months: number;
  flex_retention_months?: number;
  flex_plan_label: string;
  current_total_cents: number;
  flex_total_cents: number;
  improvement_cents: number;
  series: ValueProjectionSeriesPoint[];
}

export type PricingAmountKind = "base_plus_entry" | "monthly" | "one_off";

export interface PricingBreakdown {
  amount_cents: number;
  amount_kind: PricingAmountKind;
  /** Weekly base fee (cents) */
  base_cents?: number;
  base_weekly_cents?: number;
  per_entry_cents?: number;
  /** Weekly max bill; always ≥ $30/week unlimited */
  max_cap_weekly_cents?: number;
  /** Expected visits per week */
  expected_visits?: number;
  expected_visits_per_week?: number;
  estimated_weekly_cents?: number;
  estimated_monthly_cents?: number;
  /** Break-even visits per week vs unlimited */
  break_even_visits?: number;
  weekly_rate_cents?: number;
  months_to_quit: number;
  flex_retention_months: number;
  current_monthly_cents: number;
  formula: string;
  explanation: string;
  inputs: {
    churn_probability_pct: number;
    visits_30d?: number;
    risk_tier?: string;
    membership_plan?: MembershipPlan | string;
    offer_slug: OfferSlug | string;
  };
}

export interface MemberDetail {
  member: Member;
  risk: {
    tier: RiskTier;
    visits_30d: number;
    days_since_last_visit: number | null;
  };
  check_ins: CheckIn[];
  suggested_offer: SuggestedOffer | null;
  active_intervention: ActiveIntervention | null;
  pricing_breakdown: PricingBreakdown | null;
  insights: MemberInsights;
  value_projection: ValueProjection | null;
  flex_performance: FlexPerformance | null;
}

export interface OverviewSummary {
  critical: number;
  slipping: number;
  healthy: number;
  unknown: number;
  watch: number;
  total_scored: number;
}

export interface AttendanceDayBucket {
  date: string;
  check_ins: number;
  unique_members: number;
}

export interface AttendanceHourBucket {
  hour: number;
  check_ins: number;
}

export interface AttendanceStats {
  window_days: number;
  total_check_ins: number;
  unique_members: number;
  by_day: AttendanceDayBucket[];
  by_hour: AttendanceHourBucket[];
}

export interface FlexPlan {
  id: string;
  member_id?: string;
  member_name: string;
  offer_slug?: OfferSlug;
  offer_name: string;
  status: FlexPlanStatus;
  created_at: string;
  risk_tier?: RiskTier;
  amount_cents?: number | null;
  offer_token?: string | null;
  offer_url?: string | null;
  pinch_subscription_id?: string | null;
  payment_link_url?: string | null;
  error_message?: string | null;
  pricing_breakdown?: PricingBreakdown | null;
  value_projection?: ValueProjection | null;
}

export interface FlexMembersSummary {
  total: number;
  active: number;
  pending: number;
  retained_value_cents: number | null;
}

export interface FlexMemberRow {
  id: string;
  name: string;
  email: string;
  risk_tier: RiskTier;
  visits_30d: number;
  days_since_last_visit: number | null;
  intervention_status: "offered" | "applied";
  intervention_id: string;
  offer_url: string | null;
  accepted_at: string | null;
  created_at: string;
  pricing_breakdown: PricingBreakdown | null;
  value_projection: ValueProjection | null;
  flex_performance: FlexPerformance | null;
}

export interface ActiveIntervention {
  id: string;
  offer_slug: OfferSlug | string;
  offer_name: string;
  offer_type: "plan_switch" | "payment_link";
  status: "offered" | "applied";
  applied_at: string;
  accepted_at?: string | null;
  offer_token?: string | null;
  offer_url?: string | null;
  payment_link_url?: string | null;
  pinch_subscription_id?: string | null;
  pricing_breakdown?: PricingBreakdown | null;
  value_projection?: ValueProjection | null;
}

export interface PublicOffer {
  offer_token: string;
  status: FlexPlanStatus;
  member_display_name: string;
  gym_name: string;
  offer_slug: OfferSlug | string;
  offer_name: string;
  flex_weekly_range_label?: string | null;
  description: string;
  pricing_breakdown: PricingBreakdown | null;
  capture_publishable_key?: string | null;
  demo_mode?: boolean;
  accepted_at?: string | null;
}

export interface VaultOfferSourceResult {
  source_id: string | null;
  demo_mode: boolean;
}

export interface SendOfferResult {
  intervention_id: string;
  status: "offered" | "applied" | "failed";
  offer_token?: string | null;
  offer_url?: string | null;
  payment_link_url?: string | null;
  pinch_subscription_id?: string | null;
}

export interface CompleteOfferResult {
  intervention_id: string;
  status: "applied";
  offer_token: string;
  pinch_subscription_id?: string | null;
  already_applied: boolean;
}

export type VisitPace = "ahead" | "on_track" | "behind" | "unknown";

export interface FlexPerformance {
  days_on_plan: number;
  visits_since_apply: number;
  actual_visits_per_week: number;
  expected_visits_per_week: number | null;
  estimated_actual_weekly_cents: number | null;
  estimated_expected_weekly_cents: number | null;
  estimated_revenue_to_date_cents: number | null;
  visit_pace: VisitPace;
}

export interface OfferPreview {
  next_payment_amount_cents: number;
  next_payment_date: string;
  currency: "AUD";
  description: string;
  pricing_breakdown: PricingBreakdown | null;
  value_projection: ValueProjection | null;
}
