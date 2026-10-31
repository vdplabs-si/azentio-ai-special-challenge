import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard portal page header: title, optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Legitimate empty state — used when there are no records (never sample data). */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center", className)}>
      <Icon className="mb-3 size-8 text-brand-muted/60" aria-hidden />
      <p className="font-medium text-brand-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Small stat tile computed from real records. */
export function StatTile({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-brand-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {body}
    </a>
  ) : (
    body
  );
}

/** Labelled notice used for synthetic-data, privacy and configuration messages. */
export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "success"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-brand-navy/15 bg-brand-light text-brand-ink",
    warning: "border-warning/40 bg-warning/10 text-brand-ink",
    success: "border-success/40 bg-success/10 text-brand-ink",
  };
  return (
    <div role="note" className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-0.5", "text-[0.85rem] leading-relaxed")}>{children}</div>
    </div>
  );
}
