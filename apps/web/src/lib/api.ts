import type {
  ActiveIntervention,
  AttendanceStats,
  CompleteOfferResult,
  FlexMemberRow,
  FlexMembersSummary,
  FlexPerformance,
  FlexPlan,
  FlexPlanStatus,
  Member,
  MemberDetail,
  MemberInsights,
  MemberSort,
  OfferPreview,
  OfferSlug,
  OverviewSummary,
  PricingBreakdown,
  PublicOffer,
  RiskFactor,
  RiskFactorLevel,
  RiskTier,
  SendOfferResult,
  SuggestedOffer,
  VaultOfferSourceResult,
  ValueProjection,
  VisitPace,
} from "@/lib/types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail ?? body);
    } catch {
      // ignore parse errors
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

function pinchMechanism(offerType: string): string {
  return offerType === "plan_switch"
    ? "Member confirms via Pinch"
    : "Payment link";
}

function normalizeOffer(
  raw: {
    slug: string;
    name: string;
    description: string;
    offer_type: string;
    amount_cents?: number | null;
  } | null,
): SuggestedOffer | null {
  if (!raw) return null;
  return {
    slug: raw.slug as OfferSlug,
    name: raw.name,
    description: raw.description,
    offer_type: raw.offer_type as "plan_switch" | "payment_link",
    amount_cents: raw.amount_cents ?? null,
    pinch_mechanism: pinchMechanism(raw.offer_type),
  };
}

interface MembersResponse {
  summary: OverviewSummary;
  members: Array<Member & { status?: string }>;
}

interface MemberDetailResponse {
  member: Omit<Member, "risk_tier" | "visits_30d" | "days_since_last_visit">;
  risk: {
    tier: RiskTier;
    visits_30d: number;
    days_since_last_visit: number | null;
  };
  check_ins: Array<{ checked_in_at: string; source?: string }>;
  suggested_offer: {
    slug: string;
    name: string;
    description: string;
    offer_type: string;
    amount_cents?: number | null;
  } | null;
  active_intervention: {
    id: string;
    offer_slug: string;
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
  } | null;
  pricing_breakdown?: PricingBreakdown | null;
  insights: MemberInsights;
  value_projection?: ValueProjection | null;
  flex_performance?: FlexPerformance | null;
}

interface FlexPlansResponse {
  interventions: Array<{
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
    payment_link_url?: string | null;
    pinch_subscription_id?: string | null;
    error_message?: string | null;
    pricing_breakdown?: PricingBreakdown | null;
    value_projection?: FlexPlan["value_projection"];
  }>;
}

interface FlexMembersResponse {
  summary: FlexMembersSummary;
  members: Array<
    Omit<FlexMemberRow, "pricing_breakdown" | "value_projection" | "flex_performance"> & {
      pricing_breakdown?: PricingBreakdown | null;
      value_projection?: ValueProjection | null;
      flex_performance?: FlexPerformance | null;
    }
  >;
}

interface PreviewPlanResponse {
  offer_slug: string;
  offer_type: "plan_switch";
  next_payment_amount_cents: number;
  next_payment_date: string;
  pricing_breakdown?: PricingBreakdown | null;
  value_projection?: ValueProjection | null;
}

interface PreviewLinkResponse {
  offer_slug: string;
  offer_type: "payment_link";
  amount_cents: number;
  description: string;
  pricing_breakdown?: PricingBreakdown | null;
  value_projection?: ValueProjection | null;
}

function normalizeRiskFactor(raw: RiskFactor): RiskFactor {
  return {
    key: raw.key,
    title: raw.title,
    level: raw.level as RiskFactorLevel,
    label: raw.label,
    description: raw.description,
    severity: Number(raw.severity) || 0,
  };
}

function normalizeInsights(raw: MemberInsights): MemberInsights {
  return {
    churn_probability: Number(raw.churn_probability) || 0,
    churn_probability_baseline:
      raw.churn_probability_baseline != null
        ? Number(raw.churn_probability_baseline)
        : undefined,
    churn_trend_label: raw.churn_trend_label ?? "",
    engagement_score: Number(raw.engagement_score) || 0,
    engagement_label: raw.engagement_label ?? "",
    ltv_cents: Number(raw.ltv_cents) || 0,
    risk_exposure_cents:
      raw.risk_exposure_cents != null
        ? Number(raw.risk_exposure_cents)
        : undefined,
    visit_slope_90d: Number(raw.visit_slope_90d) || 0,
    risk_factors: (raw.risk_factors ?? []).map(normalizeRiskFactor),
  };
}

function normalizeValueProjection(
  raw: ValueProjection | null | undefined,
): ValueProjection | null {
  if (!raw) return null;
  return {
    horizon_months: Number(raw.horizon_months) || 12,
    current_plan_monthly_cents: Number(raw.current_plan_monthly_cents) || 0,
    full_price_months: Number(raw.full_price_months) || 0,
    flex_retention_months:
      raw.flex_retention_months != null
        ? Number(raw.flex_retention_months)
        : undefined,
    flex_plan_label: raw.flex_plan_label ?? "Flex plan",
    current_total_cents: Number(raw.current_total_cents) || 0,
    flex_total_cents: Number(raw.flex_total_cents) || 0,
    improvement_cents: Number(raw.improvement_cents) || 0,
    series: (raw.series ?? []).map((p) => ({
      month: Number(p.month) || 0,
      current_cumulative_cents: Number(p.current_cumulative_cents) || 0,
      flex_cumulative_cents: Number(p.flex_cumulative_cents) || 0,
    })),
  };
}

function normalizePricingBreakdown(
  raw: PricingBreakdown | null | undefined,
): PricingBreakdown | null {
  if (!raw) return null;
  const kind: PricingBreakdown["amount_kind"] =
    raw.amount_kind === "base_plus_entry"
      ? "base_plus_entry"
      : raw.amount_kind === "one_off"
        ? "one_off"
        : "monthly";
  const baseWeekly =
    raw.base_weekly_cents != null
      ? Number(raw.base_weekly_cents)
      : raw.base_cents != null
        ? Number(raw.base_cents)
        : undefined;
  return {
    amount_cents: Number(raw.amount_cents) || 0,
    amount_kind: kind,
    base_cents: baseWeekly,
    base_weekly_cents: baseWeekly,
    per_entry_cents:
      raw.per_entry_cents != null ? Number(raw.per_entry_cents) : undefined,
    max_cap_weekly_cents:
      raw.max_cap_weekly_cents != null
        ? Number(raw.max_cap_weekly_cents)
        : undefined,
    expected_visits:
      raw.expected_visits_per_week != null
        ? Number(raw.expected_visits_per_week)
        : raw.expected_visits != null
          ? Number(raw.expected_visits)
          : undefined,
    expected_visits_per_week:
      raw.expected_visits_per_week != null
        ? Number(raw.expected_visits_per_week)
        : raw.expected_visits != null
          ? Number(raw.expected_visits)
          : undefined,
    estimated_weekly_cents:
      raw.estimated_weekly_cents != null
        ? Number(raw.estimated_weekly_cents)
        : undefined,
    estimated_monthly_cents:
      raw.estimated_monthly_cents != null
        ? Number(raw.estimated_monthly_cents)
        : undefined,
    break_even_visits:
      raw.break_even_visits != null
        ? Number(raw.break_even_visits)
        : undefined,
    weekly_rate_cents:
      raw.weekly_rate_cents != null
        ? Number(raw.weekly_rate_cents)
        : undefined,
    months_to_quit: Number(raw.months_to_quit) || 0,
    flex_retention_months: Number(raw.flex_retention_months) || 0,
    current_monthly_cents: Number(raw.current_monthly_cents) || 0,
    formula: raw.formula ?? "",
    explanation: raw.explanation ?? "",
    inputs: {
      churn_probability_pct: Number(raw.inputs?.churn_probability_pct) || 0,
      visits_30d:
        raw.inputs?.visits_30d != null
          ? Number(raw.inputs.visits_30d)
          : undefined,
      risk_tier: raw.inputs?.risk_tier,
      membership_plan: raw.inputs?.membership_plan,
      offer_slug: raw.inputs?.offer_slug ?? "",
    },
  };
}

interface ApplyResponse {
  intervention_id: string;
  status: string;
  payment_link_url?: string;
  pinch_subscription_id?: string;
}

export async function getAttendanceStats(): Promise<AttendanceStats> {
  const data = await apiFetch<AttendanceStats>("/stats/attendance", {
    cache: "no-store",
  });

  return {
    window_days: data.window_days ?? 30,
    total_check_ins: data.total_check_ins ?? 0,
    unique_members: data.unique_members ?? 0,
    yesterday_unique_members: data.yesterday_unique_members ?? 0,
    avg_daily_users_30d: data.avg_daily_users_30d ?? 0,
    avg_daily_users_180d: data.avg_daily_users_180d ?? 0,
    by_day: (data.by_day ?? []).map((d) => ({
      date: d.date,
      check_ins: d.check_ins ?? 0,
      unique_members: d.unique_members ?? 0,
    })),
    by_hour: (data.by_hour ?? []).map((h) => ({
      hour: h.hour,
      check_ins: h.check_ins ?? 0,
    })),
  };
}

export async function getMembers(params?: {
  sort?: MemberSort;
  riskTier?: RiskTier;
}): Promise<{ summary: OverviewSummary; members: Member[] }> {
  const search = new URLSearchParams();
  if (params?.sort) search.set("sort", params.sort);
  if (params?.riskTier) search.set("risk_tier", params.riskTier);
  const qs = search.toString();

  const data = await apiFetch<MembersResponse>(
    `/members${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );

  const members: Member[] = data.members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    risk_tier: m.risk_tier,
    visits_30d: m.visits_30d,
    days_since_last_visit: m.days_since_last_visit,
    membership_plan: m.membership_plan,
    pinch_payer_id: m.pinch_payer_id,
    joined_at: m.joined_at,
  }));

  const summary: OverviewSummary = {
    critical: data.summary.critical ?? 0,
    slipping: data.summary.slipping ?? 0,
    healthy: data.summary.healthy ?? 0,
    unknown: data.summary.unknown ?? 0,
    watch: data.summary.watch ?? 0,
    total_scored:
      (data.summary.critical ?? 0) +
      (data.summary.slipping ?? 0) +
      (data.summary.healthy ?? 0) +
      (data.summary.unknown ?? 0) +
      (data.summary.watch ?? 0),
  };

  return { summary, members };
}

function normalizeActiveIntervention(
  raw: MemberDetailResponse["active_intervention"],
): ActiveIntervention | null {
  if (!raw) return null;
  const status = raw.status === "offered" ? "offered" : "applied";
  return {
    id: raw.id,
    offer_slug: raw.offer_slug as OfferSlug,
    offer_name: raw.offer_name,
    offer_type: raw.offer_type,
    status,
    applied_at: raw.applied_at,
    accepted_at: raw.accepted_at ?? null,
    offer_token: raw.offer_token ?? null,
    offer_url: raw.offer_url ?? null,
    payment_link_url: raw.payment_link_url ?? null,
    pinch_subscription_id: raw.pinch_subscription_id ?? null,
    pricing_breakdown: normalizePricingBreakdown(raw.pricing_breakdown),
    value_projection: normalizeValueProjection(raw.value_projection),
  };
}

function normalizeFlexPerformance(
  raw: FlexPerformance | null | undefined,
): FlexPerformance | null {
  if (!raw) return null;
  const pace = raw.visit_pace;
  const visitPace: VisitPace =
    pace === "ahead" ||
    pace === "on_track" ||
    pace === "behind" ||
    pace === "unknown"
      ? pace
      : "unknown";
  return {
    days_on_plan: Number(raw.days_on_plan) || 0,
    visits_since_apply: Number(raw.visits_since_apply) || 0,
    actual_visits_per_week: Number(raw.actual_visits_per_week) || 0,
    expected_visits_per_week:
      raw.expected_visits_per_week == null
        ? null
        : Number(raw.expected_visits_per_week),
    estimated_actual_weekly_cents:
      raw.estimated_actual_weekly_cents == null
        ? null
        : Number(raw.estimated_actual_weekly_cents),
    estimated_expected_weekly_cents:
      raw.estimated_expected_weekly_cents == null
        ? null
        : Number(raw.estimated_expected_weekly_cents),
    estimated_revenue_to_date_cents:
      raw.estimated_revenue_to_date_cents == null
        ? null
        : Number(raw.estimated_revenue_to_date_cents),
    visit_pace: visitPace,
  };
}

export async function getMember(id: string): Promise<MemberDetail> {
  const data = await apiFetch<MemberDetailResponse>(`/members/${id}`, {
    cache: "no-store",
  });

  const member: Member = {
    ...data.member,
    risk_tier: data.risk.tier,
    visits_30d: data.risk.visits_30d,
    days_since_last_visit: data.risk.days_since_last_visit,
    joined_at: data.member.joined_at,
  };

  return {
    member,
    risk: data.risk,
    check_ins: data.check_ins.map((c) => ({
      checked_in_at: c.checked_in_at,
    })),
    suggested_offer: normalizeOffer(data.suggested_offer),
    active_intervention: normalizeActiveIntervention(data.active_intervention),
    pricing_breakdown: normalizePricingBreakdown(data.pricing_breakdown),
    insights: normalizeInsights(data.insights),
    value_projection: normalizeValueProjection(data.value_projection),
    flex_performance: normalizeFlexPerformance(data.flex_performance),
  };
}

export async function getFlexPlans(): Promise<FlexPlan[]> {
  const data = await apiFetch<FlexPlansResponse>("/interventions", {
    cache: "no-store",
  });

  return data.interventions.map((item) => ({
    id: item.id,
    member_id: item.member_id,
    member_name: item.member_name,
    offer_slug: item.offer_slug,
    offer_name: item.offer_name,
    status: item.status,
    created_at: item.created_at,
    risk_tier: item.risk_tier,
    amount_cents: item.amount_cents ?? null,
    offer_token: item.offer_token ?? null,
    offer_url: item.offer_url ?? null,
    payment_link_url: item.payment_link_url ?? null,
    pinch_subscription_id: item.pinch_subscription_id ?? null,
    error_message: item.error_message ?? null,
    pricing_breakdown: normalizePricingBreakdown(item.pricing_breakdown),
    value_projection: normalizeValueProjection(item.value_projection),
  }));
}

export async function getFlexMembers(): Promise<{
  summary: FlexMembersSummary;
  members: FlexMemberRow[];
}> {
  const data = await apiFetch<FlexMembersResponse>("/flex-members", {
    cache: "no-store",
  });

  return {
    summary: {
      total: data.summary.total ?? 0,
      active: data.summary.active ?? 0,
      pending: data.summary.pending ?? 0,
      retained_value_cents: data.summary.retained_value_cents ?? null,
    },
    members: data.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      risk_tier: m.risk_tier,
      visits_30d: m.visits_30d,
      days_since_last_visit: m.days_since_last_visit,
      intervention_status: m.intervention_status,
      intervention_id: m.intervention_id,
      offer_url: m.offer_url ?? null,
      accepted_at: m.accepted_at ?? null,
      created_at: m.created_at,
      pricing_breakdown: normalizePricingBreakdown(m.pricing_breakdown),
      value_projection: normalizeValueProjection(m.value_projection),
      flex_performance: normalizeFlexPerformance(m.flex_performance),
    })),
  };
}

function normalizeNextPaymentDate(raw: unknown): string {
  if (raw == null) return "After you confirm";
  const text = String(raw).trim();
  if (!text || /^(n\/a|na|null|undefined|—|-)$/i.test(text)) {
    return "After you confirm";
  }
  return text;
}

export async function previewOffer(
  memberId: string,
  offerSlug: OfferSlug,
): Promise<OfferPreview> {
  const data = await apiFetch<PreviewPlanResponse | PreviewLinkResponse>(
    `/members/${memberId}/interventions/preview`,
    {
      method: "POST",
      body: JSON.stringify({ offer_slug: offerSlug }),
    },
  );

  const value_projection = normalizeValueProjection(data.value_projection);
  const pricing_breakdown = normalizePricingBreakdown(data.pricing_breakdown);

  if (data.offer_type === "payment_link") {
    return {
      next_payment_amount_cents: data.amount_cents,
      next_payment_date: "One-time link",
      currency: "AUD",
      description: data.description,
      pricing_breakdown,
      value_projection,
    };
  }

  return {
    next_payment_amount_cents: data.next_payment_amount_cents ?? 0,
    next_payment_date: normalizeNextPaymentDate(data.next_payment_date),
    currency: "AUD",
    description: "Flex plan · member confirms via Pinch",
    pricing_breakdown,
    value_projection,
  };
}

export async function applyOffer(
  memberId: string,
  offerSlug: OfferSlug,
): Promise<SendOfferResult> {
  return apiFetch<SendOfferResult>(`/members/${memberId}/interventions`, {
    method: "POST",
    body: JSON.stringify({ offer_slug: offerSlug, confirmed: true }),
  });
}

export async function getOffer(token: string): Promise<PublicOffer> {
  const data = await apiFetch<PublicOffer>(`/offers/${token}`, {
    cache: "no-store",
  });
  return {
    ...data,
    pricing_breakdown: normalizePricingBreakdown(data.pricing_breakdown),
  };
}

export async function vaultOfferSource(
  token: string,
  body: { token: string; source_type: "credit-card" | "bank-account" },
): Promise<VaultOfferSourceResult> {
  return apiFetch<VaultOfferSourceResult>(`/offers/${token}/vault-source`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function completeOffer(
  token: string,
): Promise<CompleteOfferResult> {
  return apiFetch<CompleteOfferResult>(`/offers/${token}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
