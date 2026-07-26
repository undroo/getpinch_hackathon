import { formatAUD } from "@/lib/utils";
import type { ValueProjection } from "@/lib/types";

const WIDTH = 480;
const HEIGHT = 180;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

export function FlexPlanValueChart({
  projection,
}: {
  projection: ValueProjection;
}) {
  const { series, full_price_months } = projection;
  if (series.length === 0) return null;

  const maxCents = Math.max(
    ...series.map((p) =>
      Math.max(p.current_cumulative_cents, p.flex_cumulative_cents),
    ),
    1,
  );

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  function x(month: number): number {
    const n = series.length;
    if (n <= 1) return PAD.left;
    return PAD.left + ((month - 1) / (n - 1)) * innerW;
  }

  function y(cents: number): number {
    return PAD.top + innerH - (cents / maxCents) * innerH;
  }

  function linePath(
    key: "current_cumulative_cents" | "flex_cumulative_cents",
  ): string {
    return series
      .map((p, i) => {
        const cmd = i === 0 ? "M" : "L";
        return `${cmd}${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`;
      })
      .join(" ");
  }

  const yTicks = [0, 0.5, 1].map((t) => Math.round(maxCents * t));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">
          Cumulative customer value
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-[var(--tier-critical-border)]" />
            Full price (expected quit)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-brand-primary" />
            With flex plan
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-subtle bg-bg-base p-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full min-w-[280px]"
          role="img"
          aria-label={`${projection.horizon_months}-month cumulative customer value comparison`}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="currentColor"
                className="text-border-subtle"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 3}
                textAnchor="end"
                className="fill-text-muted"
                fontSize={10}
              >
                {formatAUD(tick).replace(/\.00$/, "")}
              </text>
            </g>
          ))}

          <path
            d={linePath("current_cumulative_cents")}
            fill="none"
            stroke="var(--tier-critical-border)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={linePath("flex_cumulative_cents")}
            fill="none"
            stroke="currentColor"
            className="text-brand-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {series
            .filter((_, i) => i === 0 || i === series.length - 1 || (i + 1) % 3 === 0)
            .map((p) => (
              <text
                key={p.month}
                x={x(p.month)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-text-muted"
                fontSize={10}
              >
                M{p.month}
              </text>
            ))}
        </svg>
      </div>

      <p className="text-[11px] text-text-muted">
        Full price: {formatAUD(projection.current_plan_monthly_cents)}/mo for{" "}
        {full_price_months} month{full_price_months === 1 ? "" : "s"} then quit.
        Flex: {projection.flex_plan_label}
        {projection.flex_retention_months != null
          ? ` retained ~${projection.flex_retention_months} mo`
          : ""}
        .
      </p>
    </div>
  );
}
