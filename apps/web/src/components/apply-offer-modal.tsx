"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FlexPlanValueChart } from "@/components/flex-plan-value-chart";
import { ApiError, applyOffer, previewOffer } from "@/lib/api";
import {
  cn,
  formatAUD,
  formatFlexEstimateLabel,
  formatFlexStructureLabel,
  formatFlexWeeklyRangeLabel,
  formatSignedAUD,
  improvementToneClass,
  isPinchPayerLinked,
} from "@/lib/utils";
import type {
  Member,
  OfferPreview,
  PricingBreakdown,
  SuggestedOffer,
} from "@/lib/types";

type Step = "preview" | "loading" | "success" | "error";

export function ApplyOfferModal({
  open,
  onOpenChange,
  member,
  offer,
  pricingBreakdown: initialBreakdown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  offer: SuggestedOffer;
  pricingBreakdown?: PricingBreakdown | null;
}) {
  const [step, setStep] = useState<Step>("preview");
  const [offerLink, setOfferLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OfferPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function reset() {
    setStep("preview");
    setOfferLink(null);
    setError(null);
    setPreview(null);
    setPreviewLoading(false);
    setConfirming(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open || !isPinchPayerLinked(member.pinch_payer_id)) return;

    let cancelled = false;
    setPreviewLoading(true);
    setPreview(null);

    previewOffer(member.id, offer.slug)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load preview",
          );
          setStep("error");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, member.id, member.pinch_payer_id, offer.slug]);

  async function handleConfirm() {
    if (!isPinchPayerLinked(member.pinch_payer_id)) {
      setError("Pinch payer not linked");
      setStep("error");
      return;
    }

    setStep("loading");
    setConfirming(true);
    setError(null);

    try {
      const result = await applyOffer(member.id, offer.slug);
      setOfferLink(result.offer_url ?? null);
      setStep("success");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send offer");
      setStep("error");
    } finally {
      setConfirming(false);
    }
  }

  async function copyLink() {
    if (!offerLink) return;
    await navigator.clipboard.writeText(offerLink);
    toast.success("Offer link copied");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send {offer.name}</DialogTitle>
          <DialogDescription>
            {offer.description} — for {member.name}
          </DialogDescription>
        </DialogHeader>

        {step === "preview" && (
          <>
            {previewLoading || !preview ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
                <p className="text-sm text-text-secondary">Loading preview…</p>
              </div>
            ) : (
              <PreviewBody
                preview={preview}
                offer={offer}
                fallbackBreakdown={initialBreakdown}
              />
            )}
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={previewLoading || !preview || confirming}
              >
                Send offer
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <p className="text-sm text-text-secondary">Preparing offer…</p>
          </div>
        )}

        {step === "success" && (
          <>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-status-applied" />
              <p className="text-sm font-medium text-text-primary">
                Offer sent — share this link
              </p>
              <p className="text-xs text-text-muted">
                The member reviews terms and confirms with Pinch before the
                flex plan is applied
              </p>
            </div>
            {offerLink && (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Offer link
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={offerLink}
                    className="h-10 flex-1 rounded-lg border border-border-focus bg-bg-base px-3 font-mono text-xs text-text-primary"
                  />
                  <Button variant="secondary" size="icon" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}

        {step === "error" && (
          <>
            <div className="rounded-lg border border-status-failed/30 bg-[var(--tier-critical-bg)] p-4">
              <p className="text-sm font-medium text-[var(--tier-critical-text)]">Pinch error</p>
              <pre className="mt-2 overflow-auto font-mono text-xs text-text-secondary">
                {error}
              </pre>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setStep("preview")}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  preview,
  offer,
  fallbackBreakdown,
}: {
  preview: OfferPreview;
  offer: SuggestedOffer;
  fallbackBreakdown?: PricingBreakdown | null;
}) {
  const breakdown = preview.pricing_breakdown ?? fallbackBreakdown ?? null;
  const structureLabel = formatFlexStructureLabel(breakdown);
  const rangeLabel = formatFlexWeeklyRangeLabel(breakdown);
  const estimateLabel = formatFlexEstimateLabel(breakdown);
  const maxCap = breakdown?.max_cap_weekly_cents;
  const showNextPayment =
    preview.next_payment_date &&
    preview.next_payment_date !== "After you confirm" &&
    !/^n\/a$/i.test(preview.next_payment_date.trim());

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-focus bg-bg-base p-4 font-mono text-sm">
        {rangeLabel ? (
          <>
            <div className="flex justify-between text-text-secondary">
              <span>Weekly range</span>
              <span className="font-medium text-text-primary">{rangeLabel}</span>
            </div>
            {structureLabel ? (
              <div className="mt-2 flex justify-between text-text-secondary">
                <span>Structure</span>
                <span className="text-text-primary">{structureLabel}</span>
              </div>
            ) : null}
            {estimateLabel ? (
              <div className="mt-2 flex justify-between text-text-secondary">
                <span>Expected</span>
                <span className="text-text-primary">{estimateLabel}</span>
              </div>
            ) : null}
          </>
        ) : structureLabel ? (
          <>
            <div className="flex justify-between text-text-secondary">
              <span>Flex structure</span>
              <span className="text-text-primary">{structureLabel}</span>
            </div>
            {estimateLabel ? (
              <div className="mt-2 flex justify-between text-text-secondary">
                <span>Expected</span>
                <span className="text-text-primary">{estimateLabel}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex justify-between text-text-secondary">
            <span>Amount</span>
            <span className="text-text-primary">
              {formatAUD(preview.next_payment_amount_cents)}/wk
            </span>
          </div>
        )}
        {showNextPayment ? (
          <div className="mt-2 flex justify-between text-text-secondary">
            <span>Next payment</span>
            <span className="text-text-primary">{preview.next_payment_date}</span>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-text-muted">
          {preview.description} · {offer.pinch_mechanism}
        </p>
      </div>

      {breakdown ? (
        <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-base p-4">
          <p className="text-sm font-medium text-text-primary">
            How we priced this
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>
              Leave in{" "}
              <span className="font-medium tabular-nums text-text-primary">
                {breakdown.months_to_quit} mo
              </span>
            </span>
            <span>
              Flex stay{" "}
              <span className="font-medium tabular-nums text-text-primary">
                ~{breakdown.flex_retention_months} mo
              </span>
            </span>
            {breakdown.break_even_visits != null ? (
              <span>
                Break-even{" "}
                <span className="font-medium tabular-nums text-text-primary">
                  {breakdown.break_even_visits} visits/wk
                </span>
              </span>
            ) : null}
            {maxCap != null ? (
              <span>
                Max cap{" "}
                <span className="font-medium tabular-nums text-text-primary">
                  {formatAUD(maxCap)}/wk
                </span>
              </span>
            ) : null}
            {breakdown.weekly_rate_cents != null ? (
              <span>
                Unlimited{" "}
                <span className="font-medium tabular-nums text-text-primary">
                  {formatAUD(breakdown.weekly_rate_cents)}/wk
                </span>
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            {breakdown.explanation}
          </p>
        </div>
      ) : null}

      {preview.value_projection ? (
        <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-base p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">
              {preview.value_projection.horizon_months}-month value impact
            </p>
            <p
              className={cn(
                "text-xs tabular-nums",
                improvementToneClass(
                  preview.value_projection.improvement_cents,
                ),
              )}
            >
              {formatSignedAUD(preview.value_projection.improvement_cents)}{" "}
              over {preview.value_projection.horizon_months} mo
            </p>
          </div>
          <p className="text-xs text-text-muted">
            {formatAUD(preview.value_projection.flex_total_cents)} with flex vs{" "}
            {formatAUD(preview.value_projection.current_total_cents)} expected
            quit ({formatAUD(preview.value_projection.current_plan_monthly_cents)}
            /mo × {preview.value_projection.full_price_months} mo)
          </p>
          <FlexPlanValueChart projection={preview.value_projection} />
        </div>
      ) : null}
    </div>
  );
}
