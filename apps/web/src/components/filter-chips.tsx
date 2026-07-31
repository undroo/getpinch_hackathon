"use client";

import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/types";

const FILTERS: Array<{ value: RiskTier | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "slipping", label: "Slipping" },
  { value: "watch", label: "Watch" },
  { value: "healthy", label: "Healthy" },
  { value: "unknown", label: "Unknown" },
];

export function FilterChips({
  selected,
  onChange,
}: {
  selected: Array<RiskTier | "all">;
  onChange: (next: Array<RiskTier | "all">) => void;
}) {
  function toggle(value: RiskTier | "all") {
    if (value === "all") {
      onChange(["all"]);
      return;
    }

    const withoutAll = selected.filter((v) => v !== "all") as RiskTier[];
    const exists = withoutAll.includes(value);
    const next = exists
      ? withoutAll.filter((v) => v !== value)
      : [...withoutAll, value];

    onChange(next.length === 0 ? ["all"] : next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ value, label }) => {
        const active =
          value === "all"
            ? selected.includes("all") || selected.length === 0
            : selected.includes(value);

        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
              active
                ? "border-brand-primary bg-brand-primary/12 text-brand-primary"
                : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-focus hover:text-text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
