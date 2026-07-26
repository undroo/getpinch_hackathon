"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError, getOffer } from "@/lib/api";
import {
  formatFlexEstimateLabel,
  formatFlexFallbackWeeklyLabel,
  formatFlexStructureLabel,
  formatFlexWeeklyRangeLabel,
} from "@/lib/utils";
import type { PublicOffer } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function MemberOfferPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOffer(token)
      .then((data) => {
        if (!cancelled) setOffer(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "This offer link is invalid or expired",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
        Loading your offer…
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
        <BrandMark />
        <h1 className="mt-8 text-2xl font-semibold text-text-primary">
          Offer unavailable
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          {error ?? "This link is invalid, expired, or already used."}
        </p>
      </div>
    );
  }

  if (offer.status === "applied") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
        <BrandMark />
        <h1 className="mt-8 text-2xl font-semibold text-text-primary">
          You’re already on flex
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          Thanks {offer.member_display_name} — your flex plan is active with{" "}
          {offer.gym_name}.
        </p>
      </div>
    );
  }

  if (offer.status !== "offered") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
        <BrandMark />
        <h1 className="mt-8 text-2xl font-semibold text-text-primary">
          Offer unavailable
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          This offer can’t be confirmed right now.
        </p>
      </div>
    );
  }

  const bd = offer.pricing_breakdown;
  const rangeLabel =
    offer.flex_weekly_range_label ?? formatFlexWeeklyRangeLabel(bd);
  const structureLabel = formatFlexStructureLabel(bd);
  const estimateLabel = formatFlexEstimateLabel(bd);
  const fallbackWeeklyLabel = formatFlexFallbackWeeklyLabel(bd);
  const rationale = bd?.explanation?.trim() || offer.description;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <BrandMark />
      <p className="mt-3 text-xs text-text-muted">{offer.gym_name}</p>

      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-text-primary">
        Your flex plan offer
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        Hi {offer.member_display_name} — stay with a casual price that scales
        with how often you visit, instead of full unlimited.
      </p>

      <div className="mt-8 space-y-4 rounded-lg border border-border-subtle bg-bg-surface px-4 py-5">
        {rangeLabel ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              Your weekly range
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">
              {rangeLabel}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Depending on how often you visit
            </p>
          </div>
        ) : fallbackWeeklyLabel ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              Estimated weekly bill
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">
              {fallbackWeeklyLabel.replace(" estimated weekly bill", "")}
            </p>
          </div>
        ) : null}

        {structureLabel ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              How it’s calculated
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {structureLabel}
            </p>
          </div>
        ) : null}

        {estimateLabel ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              Expected for you
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {estimateLabel}
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Why this price
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            {rationale}
          </p>
        </div>
      </div>

      <>
        <p className="mt-6 text-sm leading-relaxed text-text-secondary">
          Next, confirm your payment method (credit card or bank account). Your
          weekly bill stays within{" "}
          {rangeLabel ? (
            <span className="font-medium text-text-primary">{rangeLabel}</span>
          ) : (
            "the range above"
          )}{" "}
          depending on how often you visit.
        </p>
        <Button asChild className="mt-4 w-full" size="lg">
          <a href={`/offer/${token}/confirm`}>Confirm payment method</a>
        </Button>
      </>

      <p className="mt-4 text-center text-xs text-text-muted">
        You’ll confirm billing securely with Pinch. Your gym can’t switch your
        plan without this step.
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="text-lg font-semibold tracking-tight text-text-primary">
      Retain<span className="text-brand-primary">IQ+</span>
    </span>
  );
}
