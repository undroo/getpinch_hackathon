"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TierBadge, tierAccentClass } from "@/components/tier-badge";
import { cn, formatAUD, formatRelativeDays } from "@/lib/utils";
import type { FlexMemberRow, VisitPace } from "@/lib/types";

function flexPricingLabel(row: FlexMemberRow): string {
  const bd = row.pricing_breakdown;
  const base = bd?.base_weekly_cents ?? bd?.base_cents;
  if (base != null && bd?.per_entry_cents != null) {
    const cap =
      bd.max_cap_weekly_cents != null
        ? ` · max ${formatAUD(bd.max_cap_weekly_cents)}/wk`
        : "";
    return `${formatAUD(base)}/wk + ${formatAUD(bd.per_entry_cents)}/visit${cap}`;
  }
  return "Flex plan";
}

function visitPaceLabel(pace: VisitPace): string {
  switch (pace) {
    case "ahead":
      return "Ahead";
    case "on_track":
      return "On track";
    case "behind":
      return "Behind";
    default:
      return "Unknown";
  }
}

function visitPaceClass(pace: VisitPace): string {
  switch (pace) {
    case "ahead":
    case "on_track":
      return "border-status-applied/40 bg-status-applied/10 text-status-applied";
    case "behind":
      return "border-status-failed/40 bg-status-failed/10 text-status-failed";
    default:
      return "border-border-subtle text-text-secondary";
  }
}

function formatSentTime(iso: string): string {
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

function PerformanceCell({ row }: { row: FlexMemberRow }) {
  if (row.intervention_status === "offered") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-text-secondary">Awaiting confirm</p>
        <p className="text-xs text-text-muted">Sent {formatSentTime(row.created_at)}</p>
        {row.offer_url ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-1 h-7 gap-1.5 px-2 text-xs"
            onClick={async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(row.offer_url!);
              toast.success("Offer link copied");
            }}
          >
            <Copy className="h-3 w-3" />
            Copy link
          </Button>
        ) : null}
      </div>
    );
  }

  const perf = row.flex_performance;
  if (!perf) {
    return <span className="text-sm text-text-muted">—</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("capitalize", visitPaceClass(perf.visit_pace))}>
          {visitPaceLabel(perf.visit_pace)}
        </Badge>
        <span className="text-xs text-text-muted">
          {perf.days_on_plan} day{perf.days_on_plan === 1 ? "" : "s"} on plan
        </span>
      </div>
      {perf.estimated_actual_weekly_cents != null ? (
        <p className="text-xs tabular-nums text-text-secondary">
          ~{formatAUD(perf.estimated_actual_weekly_cents)}/wk est.
        </p>
      ) : null}
    </div>
  );
}

export function FlexMembersTable({
  members,
  emptyMessage = "No flex members match this filter",
}: {
  members: FlexMemberRow[];
  emptyMessage?: string;
}) {
  const router = useRouter();

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-bg-surface px-6 py-16 text-center">
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  function navigateToMember(id: string) {
    router.push(`/members/${id}`);
  }

  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToMember(id);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Flex pricing</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead>Last visit</TableHead>
            <TableHead>Visits (30d)</TableHead>
            <TableHead>Tier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((row) => (
            <TableRow
              key={row.id}
              role="button"
              tabIndex={0}
              aria-label={`View ${row.name}'s profile`}
              onClick={() => navigateToMember(row.id)}
              onKeyDown={(event) => handleRowKeyDown(event, row.id)}
              className={cn(
                "group cursor-pointer border-l-[3px]",
                tierAccentClass(row.risk_tier),
              )}
            >
              <TableCell>
                <span className="font-medium text-text-primary group-hover:underline">
                  {row.name}
                </span>
              </TableCell>
              <TableCell>
                {row.intervention_status === "applied" ? (
                  <Badge className="border-status-applied/40 bg-status-applied/10 text-status-applied">
                    Active ✓
                  </Badge>
                ) : (
                  <Badge className="border-status-pending/40 bg-status-pending/10 text-status-pending">
                    Pending
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-text-secondary">
                {flexPricingLabel(row)}
              </TableCell>
              <TableCell>
                <PerformanceCell row={row} />
              </TableCell>
              <TableCell className="text-text-secondary">
                {formatRelativeDays(row.days_since_last_visit)}
              </TableCell>
              <TableCell className="text-text-secondary">{row.visits_30d}</TableCell>
              <TableCell>
                <TierBadge tier={row.risk_tier} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
