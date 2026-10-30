import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export const SYNTHETIC_LABEL = "Synthetic data · Simulated output · Not a credit or business decision.";

/** Prominent label required on every Playground screen and result. */
export function SyntheticLabel({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Playground disclaimer"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-brand-ink",
        className,
      )}
    >
      <FlaskConical className="size-4 shrink-0 text-warning" aria-hidden />
      <span>{SYNTHETIC_LABEL}</span>
    </div>
  );
}
