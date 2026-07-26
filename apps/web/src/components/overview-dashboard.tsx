"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { MembersTable } from "@/components/members-table";
import { OverviewAttendanceChart } from "@/components/overview-attendance-chart";
import { OverviewPeakHoursChart } from "@/components/overview-peak-hours-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceStats, Member, OverviewSummary, RiskTier } from "@/lib/types";

type TierFilter = RiskTier | "at-risk";

const TIER_SECTION: Record<
  TierFilter,
  { title: string; description: string }
> = {
  "at-risk": {
    title: "Needs attention",
    description: "Members expected to leave — sorted by churn severity",
  },
  critical: {
    title: "Critical",
    description: "Members who need action today",
  },
  slipping: {
    title: "Slipping",
    description: "Members likely to leave soon",
  },
  healthy: {
    title: "Healthy",
    description: "Members with low churn risk",
  },
  unknown: {
    title: "Unknown",
    description: "New members or members without enough data",
  },
  watch: {
    title: "Watch",
    description: "Members to keep an eye on",
  },
};

function isAtRiskTier(tier: RiskTier) {
  return tier === "critical" || tier === "slipping";
}

export function OverviewDashboard({
  summary,
  members,
  attendance,
  attendanceError,
  error,
}: {
  summary: OverviewSummary;
  members: Member[];
  attendance: AttendanceStats | null;
  attendanceError: string | null;
  error: string | null;
}) {
  const [filter, setFilter] = useState<TierFilter>("at-risk");

  const filteredMembers = useMemo(() => {
    if (filter === "at-risk") {
      return members.filter((m) => isAtRiskTier(m.risk_tier));
    }
    return members.filter((m) => m.risk_tier === filter);
  }, [members, filter]);

  const section = TIER_SECTION[filter];
  const attentionCount = summary.critical + summary.slipping;

  function toggleTier(tier: RiskTier) {
    setFilter((current) => (current === tier ? "at-risk" : tier));
  }

  function countForFilter(current: TierFilter) {
    if (current === "at-risk") return attentionCount;
    return summary[current] ?? 0;
  }

  return (
    <>
      {error && (
        <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] px-6 py-4 text-sm text-[var(--tier-critical-text)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Critical"
          value={summary.critical}
          subtext="Needs action today"
          icon={AlertTriangle}
          tier="critical"
          emphasized
          selected={filter === "critical"}
          onClick={() => toggleTier("critical")}
        />
        <StatCard
          label="Slipping"
          value={summary.slipping}
          subtext="Likely to leave"
          icon={TrendingDown}
          tier="slipping"
          selected={filter === "slipping"}
          onClick={() => toggleTier("slipping")}
        />
        <StatCard
          label="Watch"
          value={summary.watch}
          subtext="Keep an eye on"
          icon={Eye}
          tier="watch"
          selected={filter === "watch"}
          onClick={() => toggleTier("watch")}
        />
        <StatCard
          label="Healthy"
          value={summary.healthy}
          subtext="Low churn risk"
          icon={CheckCircle2}
          tier="healthy"
          selected={filter === "healthy"}
          onClick={() => toggleTier("healthy")}
        />
        <StatCard
          label="Unknown"
          value={summary.unknown}
          subtext="New / no data"
          icon={HelpCircle}
          tier="unknown"
          selected={filter === "unknown"}
          onClick={() => toggleTier("unknown")}
        />
      </div>

      {attendance ? (
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
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5 md:p-6">
              <p className="text-sm font-medium text-text-secondary">
                Overall attendance
              </p>
              <p className="mt-3 text-sm text-text-muted">
                {attendanceError ??
                  "Attendance charts are unavailable right now."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 md:p-6">
              <p className="text-sm font-medium text-text-secondary">
                Peak hours
              </p>
              <p className="mt-3 text-sm text-text-muted">
                {attendanceError ??
                  "Attendance charts are unavailable right now."}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {section.title}
          </h2>
          <Badge variant="secondary" className="w-fit">
            {countForFilter(filter)}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary">{section.description}</p>
        <MembersTable members={filteredMembers} />
        <div className="pt-1">
          <Link
            href="/members"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            View all members →
          </Link>
        </div>
      </section>
    </>
  );
}
