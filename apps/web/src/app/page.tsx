import { OverviewDashboard } from "@/components/overview-dashboard";
import { PageHeader } from "@/components/page-header";
import { getAttendanceStats, getMembers } from "@/lib/api";
import type { AttendanceStats, Member } from "@/lib/types";
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
  let allMembers: Member[] = [];
  let attendance: AttendanceStats | null = null;
  let error: string | null = null;
  let attendanceError: string | null = null;

  const [membersResult, attendanceResult] = await Promise.allSettled([
    getMembers({ sort: "severity" }),
    getAttendanceStats(),
  ]);

  if (membersResult.status === "fulfilled") {
    summary = membersResult.value.summary;
    allMembers = membersResult.value.members;
  } else {
    error =
      membersResult.reason instanceof Error
        ? membersResult.reason.message
        : "Failed to load members";
  }

  if (attendanceResult.status === "fulfilled") {
    attendance = attendanceResult.value;
  } else {
    attendanceError =
      attendanceResult.reason instanceof Error
        ? attendanceResult.reason.message
        : "Failed to load attendance stats";
  }

  const attentionCount = summary.critical + summary.slipping;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title=""
        description={
          <>
            {GYM_NAME} · {summary.total_scored} members scored
          </>
        }
      />

      <OverviewDashboard
        summary={summary}
        members={allMembers}
        attendance={attendance}
        attendanceError={attendanceError}
        error={error}
      />
    </div>
  );
}
