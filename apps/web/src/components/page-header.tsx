import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[28px] font-semibold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]",
            eyebrow && "mt-1",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {meta ? (
        <div className="shrink-0 text-sm text-text-muted sm:pb-0.5">{meta}</div>
      ) : null}
    </header>
  );
}
