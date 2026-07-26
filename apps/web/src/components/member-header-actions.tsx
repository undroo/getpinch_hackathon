"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DashboardVariant } from "@/lib/member-insights";

export function MemberHeaderActions({
  variant,
  email,
  name,
}: {
  variant: DashboardVariant;
  email: string;
  name: string;
}) {
  if (variant === "at-risk") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.message("Account flagged", {
              description: `${name} added to the review queue.`,
            })
          }
        >
          Flag Account
        </Button>
        <Button asChild>
          <a href={`mailto:${email}?subject=${encodeURIComponent(`RetainIQ+ — ${name}`)}`}>
            Contact Member
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <Link href="/actions">Manage Plan</Link>
      </Button>
      <Button asChild>
        <a href={`mailto:${email}?subject=${encodeURIComponent(`Update for ${name}`)}`}>
          Send Update
        </a>
      </Button>
    </div>
  );
}
