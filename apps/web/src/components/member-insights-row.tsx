import {
  CreditCard,
  Smile,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MemberInsight } from "@/lib/member-insights";

function InsightTile({
  title,
  headline,
  detail,
  icon: Icon,
}: {
  title: string;
  headline: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4 md:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-base">
          <Icon className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {title}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {headline}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MemberInsightsRow({ insight }: { insight: MemberInsight }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <InsightTile
        title="Member Persona"
        headline={insight.persona.title}
        detail={insight.persona.detail}
        icon={Timer}
      />
      <InsightTile
        title="Plan Satisfaction"
        headline={insight.planSatisfaction.title}
        detail={insight.planSatisfaction.detail}
        icon={Smile}
      />
      <InsightTile
        title="Billing Health"
        headline={insight.billingHealth.title}
        detail={insight.billingHealth.detail}
        icon={CreditCard}
      />
    </div>
  );
}
