export const PINCH_CAPTURE_SCRIPT =
  "https://cdn.getpinch.com.au/capturejs/pinch.capture.v2.js";

export const PINCH_CAPTURE_INTEGRITY =
  "sha384-hglYFSKC4AMA/rAQOGB3OiA8u5ri5F4qNMGgw4I+fggDSlTmPyREcj1J+VGnkAX8";

export interface PinchCaptureInstance {
  createToken: (
    opts: Record<string, string>,
  ) => Promise<{ token: string; error?: string }>;
}

declare global {
  interface Window {
    Pinch?: {
      Capture: (opts: { publishableKey: string }) => PinchCaptureInstance;
    };
  }
}

export function createPinchCapture(
  publishableKey: string,
): PinchCaptureInstance | null {
  if (typeof window === "undefined" || !window.Pinch) return null;
  return window.Pinch.Capture({ publishableKey });
}

/** Parse MM/YY or MM / YY into CaptureJS expiry fields. */
export function parseCardExpiry(raw: string): { month: string; year: string } {
  const cleaned = raw.replace(/\s/g, "");
  const [monthPart, yearPart] = cleaned.split("/");
  const month = (monthPart ?? "").padStart(2, "0").slice(0, 2);
  let year = (yearPart ?? "").trim();
  if (year.length === 2) {
    year = `20${year}`;
  }
  return { month, year };
}
