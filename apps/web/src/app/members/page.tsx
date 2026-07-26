"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { FilterChips } from "@/components/filter-chips";
import { MembersTable } from "@/components/members-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMembers } from "@/lib/api";
import type { Member, MemberSort, RiskTier } from "@/lib/types";

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Array<RiskTier | "all">>(["all"]);
  const [sort, setSort] = useState<MemberSort>("severity");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMembers({ sort })
      .then((data) => {
        if (!cancelled) setAllMembers(data.members);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load members");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  const members = useMemo(() => {
    let result = allMembers;

    const tiers =
      selected.includes("all") || selected.length === 0
        ? null
        : (selected.filter((t) => t !== "all") as RiskTier[]);

    if (tiers) {
      result = result.filter((m) => tiers.includes(m.risk_tier));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allMembers, selected, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text-primary md:text-[32px]">
          Members
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Filter and prioritize members expected to leave
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="pl-9"
          />
        </div>
        <div className="w-full max-w-[200px]">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as MemberSort)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="severity">Severity</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="last_visit">Last visit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FilterChips selected={selected} onChange={setSelected} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading members…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] px-6 py-4 text-sm text-[var(--tier-critical-text)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              Showing {members.length} member{members.length === 1 ? "" : "s"}
            </span>
          </div>

          <MembersTable
            members={members}
            emptyMessage="No members match this filter"
          />
        </>
      )}
    </div>
  );
}
