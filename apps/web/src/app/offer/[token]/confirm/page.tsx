"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  ApiError,
  completeOffer,
  getOffer,
  vaultOfferSource,
} from "@/lib/api";
import {
  createPinchCapture,
  parseCardExpiry,
  PINCH_CAPTURE_INTEGRITY,
  PINCH_CAPTURE_SCRIPT,
} from "@/lib/pinch-capture";
import {
  FLEX_HOW_IT_WORKS_DETAIL,
  FLEX_HOW_IT_WORKS_HEADING,
  FLEX_RANGE_TRUST_LINE,
  FLEX_TYPICAL_SUBLINE,
  flexOfferBenefits,
  formatFlexTypicalHeroLabel,
} from "@/lib/offer-copy";
import { cn, formatFlexStructureLabel, formatFlexWeeklyRangeLabel } from "@/lib/utils";
import type { PublicOffer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PaymentMethod = "credit-card" | "bank-account";

export default function OfferConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("credit-card");

  const cardNumberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const cardNameRef = useRef<HTMLInputElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);
  const bsbRef = useRef<HTMLInputElement>(null);
  const accountNumberRef = useRef<HTMLInputElement>(null);

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

  const useCaptureJs = Boolean(
    offer?.capture_publishable_key && !offer?.demo_mode,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !offer) return;
    setSubmitting(true);
    setError(null);

    try {
      if (useCaptureJs && offer.capture_publishable_key) {
        const capture = createPinchCapture(offer.capture_publishable_key);
        if (!capture) {
          throw new Error("Pinch secure checkout is still loading. Try again.");
        }

        if (method === "credit-card") {
          const cardNumber = cardNumberRef.current?.value ?? "";
          const expiry = expiryRef.current?.value ?? "";
          const cvv = cvvRef.current?.value ?? "";
          const cardHolderName =
            cardNameRef.current?.value?.trim() ||
            offer.member_display_name ||
            "Member";
          const { month, year } = parseCardExpiry(expiry);
          const result = await capture.createToken({
            sourceType: "credit-card",
            cardNumber: cardNumber.replace(/\s/g, ""),
            expiryMonth: month,
            expiryYear: year,
            cvc: cvv,
            cardHolderName,
          });
          if (!result.token) {
            throw new Error("Could not tokenize card details");
          }
          await vaultOfferSource(token, {
            token: result.token,
            source_type: "credit-card",
          });
        } else {
          const bankAccountName =
            accountNameRef.current?.value?.trim() ||
            offer.member_display_name ||
            "Member";
          const bsb = (bsbRef.current?.value ?? "").replace(/\D/g, "");
          const bankAccountNumber = (
            accountNumberRef.current?.value ?? ""
          ).replace(/\D/g, "");
          const result = await capture.createToken({
            sourceType: "bank-account",
            bankAccountName,
            bankAccountRouting: bsb,
            bankAccountNumber,
          });
          if (!result.token) {
            throw new Error("Could not tokenize bank account details");
          }
          await vaultOfferSource(token, {
            token: result.token,
            source_type: "bank-account",
          });
        }
      }

      await completeOffer(token);
      router.push(`/offer/${token}/complete`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not confirm your payment method",
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
          Loading checkout…
        </div>
      </Shell>
    );
  }

  if (error && !offer) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-text-primary">
          Offer unavailable
        </h1>
        <p className="mt-3 text-sm text-text-secondary">{error}</p>
      </Shell>
    );
  }

  if (!offer || offer.status !== "offered") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-text-primary">
          Offer unavailable
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          This offer can&apos;t be confirmed right now.
        </p>
      </Shell>
    );
  }

  const bd = offer.pricing_breakdown;
  const rangeLabel =
    offer.flex_weekly_range_label ?? formatFlexWeeklyRangeLabel(bd);
  const typicalHero = formatFlexTypicalHeroLabel(bd);
  const structureLabel = formatFlexStructureLabel(bd);
  const benefits = flexOfferBenefits(rangeLabel);

  return (
    <Shell>
      {useCaptureJs ? (
        <Script
          src={PINCH_CAPTURE_SCRIPT}
          integrity={PINCH_CAPTURE_INTEGRITY}
          crossOrigin="anonymous"
          strategy="afterInteractive"
          onLoad={() => setCaptureReady(true)}
        />
      ) : null}

      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-status-offered">
        Secure checkout
      </p>

      <div className="mt-6 text-center">
        {typicalHero ? (
          <>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              Typical for you
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-text-primary">
              {typicalHero}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{FLEX_TYPICAL_SUBLINE}</p>
            {rangeLabel ? (
              <>
                <p className="mt-4 text-[11px] uppercase tracking-wide text-text-muted">
                  Your weekly range
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {rangeLabel}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {FLEX_RANGE_TRUST_LINE}
                </p>
              </>
            ) : null}
          </>
        ) : rangeLabel ? (
          <>
            <p className="text-4xl font-semibold tracking-tight text-text-primary">
              {rangeLabel}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {FLEX_RANGE_TRUST_LINE}
            </p>
          </>
        ) : (
          <p className="text-2xl font-semibold text-text-primary">
            Flex plan confirmation
          </p>
        )}
      </div>

      <div className="mt-8 space-y-5 rounded-lg border border-border-subtle bg-bg-surface p-4 text-sm">
        {structureLabel ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">
              {FLEX_HOW_IT_WORKS_HEADING}
            </p>
            <p className="mt-1 font-medium text-text-primary">{structureLabel}</p>
            <p className="mt-1 text-xs text-text-muted">{FLEX_HOW_IT_WORKS_DETAIL}</p>
          </div>
        ) : null}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Why members choose flex
          </p>
          <ul className="mt-2 space-y-2 leading-relaxed text-text-secondary">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <p className="text-sm font-medium text-text-primary">
            Choose your payment method
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MethodTab
              active={method === "credit-card"}
              label="Credit card"
              onClick={() => setMethod("credit-card")}
            />
            <MethodTab
              active={method === "bank-account"}
              label="Bank account"
              onClick={() => setMethod("bank-account")}
            />
          </div>
        </div>

        {method === "credit-card" ? (
          <div className="space-y-3">
            <Field label="Card number">
              <Input
                ref={cardNumberRef}
                placeholder="4242 4242 4242 4242"
                autoComplete="cc-number"
                required={useCaptureJs}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry date">
                <Input
                  ref={expiryRef}
                  placeholder="MM / YY"
                  autoComplete="cc-exp"
                  required={useCaptureJs}
                />
              </Field>
              <Field label="CVV">
                <Input
                  ref={cvvRef}
                  placeholder="123"
                  autoComplete="cc-csc"
                  required={useCaptureJs}
                />
              </Field>
            </div>
            <Field label="Cardholder name">
              <Input
                ref={cardNameRef}
                placeholder={offer.member_display_name}
                autoComplete="cc-name"
                required={useCaptureJs}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Account name">
              <Input
                ref={accountNameRef}
                placeholder={offer.member_display_name}
                required={useCaptureJs}
              />
            </Field>
            <Field label="BSB">
              <Input ref={bsbRef} placeholder="000-000" required={useCaptureJs} />
            </Field>
            <Field label="Account number">
              <Input
                ref={accountNumberRef}
                placeholder="12345678"
                required={useCaptureJs}
              />
            </Field>
          </div>
        )}

        {error ? (
          <p className="text-sm text-status-failed">{error}</p>
        ) : null}

        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={submitting || (useCaptureJs && !captureReady)}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming…
            </>
          ) : (
            "Confirm payment"
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-text-muted">
        Powered by Pinch · your payment details are encrypted
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <span className="text-xl font-bold tracking-[-0.03em] text-text-primary">
        Retain<span className="font-extrabold text-brand-primary">IQ+</span>
      </span>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function MethodTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-primary bg-brand-primary/10 text-text-primary"
          : "border-border-subtle bg-bg-base text-text-secondary hover:border-border-focus",
      )}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
