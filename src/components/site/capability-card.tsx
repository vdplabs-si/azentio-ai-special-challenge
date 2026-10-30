import {
  ChartColumn,
  Check,
  FileSearch,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Capability, CapabilityIcon } from "@/content/site";
import { cn } from "@/lib/utils";

export const CAPABILITY_ICONS: Record<CapabilityIcon, LucideIcon> = {
  decisioning: Scale,
  documents: FileSearch,
  agents: Workflow,
  analytics: ChartColumn,
  platform: SlidersHorizontal,
  trust: ShieldCheck,
};

/** One of the six "Intelligence in Every Layer" capability areas. */
export function CapabilityCard({
  capability,
  compact = false,
  className,
}: {
  capability: Capability;
  compact?: boolean;
  className?: string;
}) {
  const Icon = CAPABILITY_ICONS[capability.key];
  return (
    <article
      className={cn(
        "group flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-6 transition-colors hover:border-brand-green/60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 items-center justify-center rounded-lg bg-brand-navy text-brand-green">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="rounded-full border border-border bg-brand-light px-2.5 py-1 text-xs font-medium text-brand-muted">
          {capability.subtitle}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-brand-ink">{capability.title}</h3>
        <p className="text-sm text-muted-foreground">{capability.description}</p>
      </div>
      {compact ? null : (
        <ul className="mt-auto grid gap-2 border-t border-border pt-4 text-sm text-brand-ink">
          {capability.points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
