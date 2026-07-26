import {
  CreditCard,
  Crosshair,
  Network,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LifecycleItem } from "@/lib/member-insights";

const ICONS: Record<string, LucideIcon> = {
  persona: Crosshair,
  billing: CreditCard,
  affinity: Network,
};

export function LifecycleContext({ items }: { items: LifecycleItem[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          Lifecycle Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? Crosshair;
          return (
            <div key={item.key} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-base">
                <Icon className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">
                  {item.label}
                </p>
                <p className="truncate text-sm font-medium text-text-primary">
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
