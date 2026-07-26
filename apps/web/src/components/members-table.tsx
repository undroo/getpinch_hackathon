"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TierBadge, tierAccentClass } from "@/components/tier-badge";
import { cn, formatMembershipPlan, formatRelativeDays } from "@/lib/utils";
import type { Member } from "@/lib/types";

export function MembersTable({
  members,
  showViewLink = true,
  emptyMessage = "No members match this filter",
}: {
  members: Member[];
  showViewLink?: boolean;
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
            <TableHead>Tier</TableHead>
            <TableHead>Last visit</TableHead>
            <TableHead>Visits (30d)</TableHead>
            <TableHead>Plan</TableHead>
            {showViewLink && <TableHead className="w-20 text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow
              key={member.id}
              role="button"
              tabIndex={0}
              aria-label={`View ${member.name}'s profile`}
              onClick={() => navigateToMember(member.id)}
              onKeyDown={(event) => handleRowKeyDown(event, member.id)}
              className={cn(
                "group cursor-pointer border-l-[3px]",
                tierAccentClass(member.risk_tier),
              )}
            >
              <TableCell>
                <span className="font-medium text-text-primary group-hover:underline">
                  {member.name}
                </span>
              </TableCell>
              <TableCell>
                <TierBadge tier={member.risk_tier} />
              </TableCell>
              <TableCell className="text-text-secondary">
                {formatRelativeDays(member.days_since_last_visit)}
              </TableCell>
              <TableCell className="text-text-secondary">
                {member.visits_30d}
              </TableCell>
              <TableCell className="text-text-secondary">
                {formatMembershipPlan(member.membership_plan)}
              </TableCell>
              {showViewLink && (
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary group-hover:underline">
                    View
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
