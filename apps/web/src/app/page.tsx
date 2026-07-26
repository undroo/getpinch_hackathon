import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { MembersTable } from "@/components/members-table";
import { OverviewAttendanceChart } from "@/components/overview-attendance-chart";
import { OverviewPeakHoursChart } from "@/components/overview-peak-hours-chart";
import { Badge } from "@/components/ui/badge";
import { getAttendanceStats, getMembers } from "@/lib/api";
import type { AttendanceStats } from "@/lib/types";
import { GYM_NAME } from "@/lib/constants";

export default async function OverviewPage() {
  let summary = {
    critical: 0,
    slipping: 0,
    healthy: 0,
    unknown: 0,
    watch: 0,
    total_scored: 0,
  };
  let needsAttention: Awaited<ReturnType<typeof getMembers>>["members"] = [];
  let attendance: AttendanceStats | null = null;
  let error: string | null = null;

  const [membersResult, attendanceResult] = await Promise.allSettled([
    getMembers({ sort: "severity" }),
    getAttendanceStats(),
  ]);

  if (membersResult.status === "fulfilled") {
    summary = membersResult.value.summary;
    needsAttention = membersResult.value.members
      .filter(
        (m) => m.risk_tier === "critical" || m.risk_tier === "slipping",
      )
      .slice(0, 8);
  } else {
    error =
      membersResult.reason instanceof Error
        ? membersResult.reason.message
        : "Failed to load members";
  }

  if (attendanceResult.status === "fulfilled") {
    attendance = attendanceResult.value;
  }

  const attentionCount = summary.critical + summary.slipping;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text-primary md:text-[32px]">
            Retention pricing overview
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {GYM_NAME} · {summary.total_scored} members scored ·{" "}
            {attentionCount} expected to leave
          </p>
        </div>
        <div className="text-xs text-text-muted">Scored on demand</div>
      </div>

      {error && (
        <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] px-6 py-4 text-sm text-[var(--tier-critical-text)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Critical"
          value={summary.critical}
          subtext="Needs action today"
          icon={AlertTriangle}
          tier="critical"
          emphasized
        />
        <StatCard
          label="Slipping"
          value={summary.slipping}
          subtext="Likely to leave"
          icon={TrendingDown}
          tier="slipping"
        />
        <StatCard
          label="Healthy"
          value={summary.healthy}
          subtext="Low churn risk"
          icon={CheckCircle2}
          tier="healthy"
        />
        <StatCard
          label="Unknown"
          value={summary.unknown}
          subtext="New / no data"
          icon={HelpCircle}
          tier="unknown"
        />
      </div>

      {attendance && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OverviewAttendanceChart
            totalCheckIns={attendance.total_check_ins}
            uniqueMembers={attendance.unique_members}
            windowDays={attendance.window_days}
            byDay={attendance.by_day}
          />
          <OverviewPeakHoursChart
            byHour={attendance.by_hour}
            windowDays={attendance.window_days}
          />
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Needs attention
          </h2>
          <Badge variant="secondary" className="w-fit">
            {attentionCount}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary">
          Members expected to leave — sorted by churn severity
        </p>
        <MembersTable members={needsAttention} />
        <div className="pt-1">
          <Link
            href="/members"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            View all members →
          </Link>
        </div>
      </section>
    </div>
  );
}
