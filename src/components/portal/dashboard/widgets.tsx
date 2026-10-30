import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import type { Priority } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Humanise an enum value: "IN_PROGRESS" → "In progress". */
export function enumLabel(value: string) {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Dashboard section card with a heading and an optional "view all" link. */
export function Panel({
  title,
  description,
  href,
  hrefLabel = "View all",
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)} aria-label={title}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-brand-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-navy hover:underline">
            {hrefLabel} <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Small inline empty message for a panel with no records. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/**
 * Meter for a single ratio (e.g. tasks done / total). The track is a lighter step of the
 * fill's hue; the figures are printed as text beside it so the value never relies on the bar.
 */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={max > 0 ? `${value} of ${max} (${pct}%)` : "No tasks yet"}
        className="h-2 flex-1 overflow-hidden rounded-full bg-brand-navy/10"
      >
        {pct > 0 && <div className="h-full rounded-full bg-brand-navy" style={{ width: `${pct}%` }} />}
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {max > 0 ? `${value}/${max} · ${pct}%` : "No tasks"}
      </span>
    </div>
  );
}

/**
 * Ranked horizontal bars (largest first, one hue, shared zero baseline) for a handful of
 * counts. Each row prints its label and value, so the list doubles as the table view.
 */
export function RankedBars({ rows, label }: { rows: { key: string; label: string; value: number; href?: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return (
    <ul className="grid gap-2" aria-label={label}>
      {sorted.map((r) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        const name = r.href ? (
          <Link href={r.href} className="hover:underline">
            {r.label}
          </Link>
        ) : (
          r.label
        );
        return (
          <li key={r.key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm" title={`${r.label}: ${r.value}`}>
            <span className="truncate text-brand-ink">{name}</span>
            <span className="h-2 rounded-r-[4px] bg-brand-navy" style={{ width: `${pct}%` }} aria-hidden />
            <span className="text-right tabular-nums text-muted-foreground">{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

const PRIORITY_CLASS: Record<Priority, string> = {
  URGENT: "border-destructive/40 text-destructive",
  HIGH: "border-warning/50 text-warning",
  MEDIUM: "border-border text-muted-foreground",
  LOW: "border-border text-muted-foreground",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={PRIORITY_CLASS[priority]}>
      {enumLabel(priority)}
    </Badge>
  );
}

/** Overdue / due-soon indicator: always icon + text, never colour alone. */
export function DueBadge({ overdue, dueSoon }: { overdue: boolean; dueSoon: boolean }) {
  if (overdue)
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle aria-hidden /> Overdue
      </Badge>
    );
  if (dueSoon)
    return (
      <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
        <CalendarClock aria-hidden /> Due soon
      </Badge>
    );
  return null;
}
