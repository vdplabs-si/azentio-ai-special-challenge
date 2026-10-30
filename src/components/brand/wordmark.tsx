import { cn } from "@/lib/utils";

/** "azentio.ai" wordmark: a, i and .ai in brand green (as on the Build Labs brief). */
export function Wordmark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const base = inverted ? "text-white" : "text-brand-navy";
  return (
    <span className={cn("font-heading text-xl font-bold tracking-tight", className)} aria-label="azentio.ai">
      <span className="text-brand-green">a</span>
      <span className={base}>zent</span>
      <span className="text-brand-green">i</span>
      <span className={base}>o</span>
      <span className="text-brand-green">.ai</span>
    </span>
  );
}
