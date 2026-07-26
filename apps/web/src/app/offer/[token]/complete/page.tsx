"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ApiError, completeOffer } from "@/lib/api";

type State = "loading" | "success" | "error";

export default function OfferCompletePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setState("loading");
    completeOffer(token)
      .then((result) => {
        if (cancelled) return;
        setAlreadyApplied(Boolean(result.already_applied));
        setState("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage(
          err instanceof ApiError
            ? err.message
            : "Could not finish flex plan setup",
        );
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <span className="text-lg font-semibold tracking-tight text-text-primary">
        Retain<span className="text-brand-primary">IQ+</span>
      </span>

      {state === "loading" ? (
        <>
          <Loader2 className="mt-10 h-8 w-8 animate-spin text-brand-primary" />
          <p className="mt-4 text-sm text-text-secondary">
            Confirming your flex plan with Pinch…
          </p>
        </>
      ) : null}

      {state === "success" ? (
        <>
          <CheckCircle2 className="mt-10 h-12 w-12 text-status-applied" />
          <h1 className="mt-4 text-2xl font-semibold text-text-primary">
            You’re on flex
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            {alreadyApplied
              ? "Your flex plan was already set up. You’re all good."
              : "Pinch confirmation complete — your gym has switched you to the flex plan."}
          </p>
        </>
      ) : null}

      {state === "error" ? (
        <>
          <h1 className="mt-10 text-2xl font-semibold text-text-primary">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-status-failed">
            {message ?? "Please contact your gym to finish setup."}
          </p>
        </>
      ) : null}
    </div>
  );
}
