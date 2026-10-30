import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Honest empty state for DB-backed lists that currently have no public records. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-light text-brand-navy">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="font-heading text-lg font-semibold text-brand-ink">{title}</p>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </div>
  );
}
