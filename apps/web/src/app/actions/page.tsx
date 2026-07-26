"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FlexPlanValueChart } from "@/components/flex-plan-value-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFlexPlans } from "@/lib/api";
import {
  cn,
  formatAUD,
  formatSignedAUD,
  improvementToneClass,
} from "@/lib/utils";
import type { FlexPlan, FlexPlanStatus } from "@/lib/types";

const TABS: Array<{ value: FlexPlanStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "offered", label: "Offered" },
  { value: "applied", label: "Applied" },
  { value: "failed", label: "Failed" },
];

function statusClass(status: FlexPlanStatus): string {
  switch (status) {
    case "applied":
      return "border-status-applied/40 bg-status-applied/10 text-status-applied";
    case "offered":
    case "pending":
      return "border-status-pending/40 bg-status-pending/10 text-status-pending";
    case "failed":
      return "border-status-failed/40 bg-status-failed/10 text-status-failed";
    default:
      return "border-border-subtle text-text-secondary";
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ValueSummary({ plan }: { plan: FlexPlan }) {
  const vp = plan.value_projection;
  if (!vp) {
    return <span className="text-xs text-text-muted">—</span>;
  }

  const horizon = vp.horizon_months || 12;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium tabular-nums text-text-primary">
        {formatAUD(vp.flex_total_cents)}{" "}
        <span className="font-normal text-text-muted">vs</span>{" "}
        {formatAUD(vp.current_total_cents)}
      </p>
      <p
        className={cn(
          "text-xs tabular-nums",
          improvementToneClass(vp.improvement_cents),
        )}
      >
        {formatSignedAUD(vp.improvement_cents)} over {horizon} mo
      </p>
    </div>
  );
}

function offerAmountLabel(plan: FlexPlan): string {
  const bd = plan.pricing_breakdown;
  const base = bd?.base_weekly_cents ?? bd?.base_cents;
  if (base != null && bd?.per_entry_cents != null) {
    const cap =
      bd.max_cap_weekly_cents != null
        ? ` · max ${formatAUD(bd.max_cap_weekly_cents)}/wk`
        : "";
    return `${plan.offer_name} · ${formatAUD(base)}/wk + ${formatAUD(bd.per_entry_cents)}/visit${cap}`;
  }
  const cents =
    bd?.estimated_weekly_cents ?? plan.amount_cents ?? bd?.amount_cents ?? null;
  if (cents == null) return plan.offer_name;
  return `${plan.offer_name} · ~${formatAUD(cents)}/wk`;
}

function FlexPlanRow({ item }: { item: FlexPlan }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = Boolean(
    item.value_projection && item.value_projection.series.length > 0,
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface">
      <div className="flex w-full items-start gap-2 px-4 py-4 md:items-center md:gap-4 md:px-5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse value chart" : "Expand value chart"}
          disabled={!canExpand}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-0.5 shrink-0 rounded-md p-1 text-text-muted transition-colors",
            canExpand
              ? "hover:bg-bg-elevated hover:text-text-primary"
              : "cursor-default opacity-40",
          )}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>

        <div className="min-w-0 flex-1 grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-center">
          {item.member_id ? (
            <Link
              href={`/members/${item.member_id}`}
              className="truncate font-medium text-text-primary hover:text-brand-primary"
            >
              {item.member_name}
            </Link>
          ) : (
            <span className="truncate font-medium text-text-primary">
              {item.member_name}
            </span>
          )}
          <span className="text-sm text-text-secondary">
            {offerAmountLabel(item)}
          </span>
          <ValueSummary plan={item} />
          <div>
            <Badge className={cn("capitalize", statusClass(item.status))}>
              {item.status}
              {item.status === "applied"
                ? " ✓"
                : item.status === "failed"
                  ? " ✗"
                  : ""}
            </Badge>
          </div>
          <span className="text-xs text-text-muted sm:text-right">
            {formatTime(item.created_at)}
          </span>
        </div>
      </div>

      {((item.status === "offered" && item.offer_url) ||
        (expanded && item.value_projection)) && (
        <div className="space-y-3 border-t border-border-subtle px-4 py-4 md:px-5">
          {item.status === "offered" && item.offer_url ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">Offer link</span>
              <code className="max-w-full truncate font-mono text-xs text-text-secondary">
                {item.offer_url}
              </code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(item.offer_url!);
                  toast.success("Offer link copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          ) : null}
          {expanded && item.pricing_breakdown ? (
            <p className="text-xs leading-relaxed text-text-secondary">
              {item.pricing_breakdown.explanation}
            </p>
          ) : null}
          {expanded && item.value_projection ? (
            <FlexPlanValueChart projection={item.value_projection} />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  const [tab, setTab] = useState<FlexPlanStatus | "all">("all");
  const [flexPlans, setFlexPlans] = useState<
    Awaited<ReturnType<typeof getFlexPlans>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFlexPlans()
      .then((data) => {
        if (!cancelled) setFlexPlans(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load flex plans",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return flexPlans;
    return flexPlans.filter((item) => item.status === tab);
  }, [flexPlans, tab]);

  const retainedSummary = useMemo(() => {
    const applied = filtered.filter(
      (p) => p.status === "applied" && p.value_projection,
    );
    if (applied.length === 0) return null;
    const total = applied.reduce(
      (sum, p) => sum + (p.value_projection?.improvement_cents ?? 0),
      0,
    );
    return { count: applied.length, total };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text-primary md:text-[32px]">
          Flex Plans
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Offers sent and accepted via Pinch — projected member value impact
        </p>
        {retainedSummary && retainedSummary.total > 0 && (
          <p className="mt-2 text-sm text-status-applied">
            {formatAUD(retainedSummary.total)} projected value retained across{" "}
            {retainedSummary.count} flex plan
            {retainedSummary.count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === value
                ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-focus",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading flex plans…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] px-6 py-4 text-sm text-[var(--tier-critical-text)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-bg-surface px-6 py-16 text-center text-sm text-text-secondary">
              No flex plans match this filter
            </div>
          ) : (
            filtered.map((item) => <FlexPlanRow key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}
