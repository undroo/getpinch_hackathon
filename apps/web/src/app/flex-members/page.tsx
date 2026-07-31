"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { FlexMembersTable } from "@/components/flex-members-table";
import { getFlexMembers } from "@/lib/api";
import { cn, formatAUD } from "@/lib/utils";

type FlexTab = "all" | "applied" | "offered";

const TABS: Array<{ value: FlexTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "applied", label: "Active" },
  { value: "offered", label: "Pending" },
];

export default function FlexMembersPage() {
  const [tab, setTab] = useState<FlexTab>("all");
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlexMembers>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFlexMembers()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load flex members",
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
    if (!data) return [];
    if (tab === "all") return data.members;
    return data.members.filter((m) => m.intervention_status === tab);
  }, [data, tab]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text-primary md:text-[32px]">
          Flex Members
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Members on flex pricing — active plans and pending offers awaiting Pinch
          confirmation
        </p>
        {summary && summary.total > 0 && (
          <p className="mt-2 text-sm text-text-secondary">
            {summary.active} active · {summary.pending} pending
            {summary.retained_value_cents != null &&
            summary.retained_value_cents > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="text-status-applied">
                  {formatAUD(summary.retained_value_cents)} projected value
                  retained
                </span>
              </>
            ) : null}
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
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
              tab === value
                ? "border-brand-primary bg-brand-primary/12 text-brand-primary"
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
          Loading flex members…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] px-6 py-4 text-sm text-[var(--tier-critical-text)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <FlexMembersTable
          members={filtered}
          emptyMessage="No flex members match this filter"
        />
      )}
    </div>
  );
}
