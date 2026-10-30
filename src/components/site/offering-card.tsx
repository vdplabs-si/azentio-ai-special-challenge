import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import type { OfferingDef } from "@/content/catalogue";
import { industryName } from "@/components/site/catalogue";
import { cn } from "@/lib/utils";

/** Product card. The whole card is clickable through a stretched link on the CTA. */
export function OfferingCard({
  offering,
  variant = "default",
  showIndustry = false,
  headingLevel = "h3",
  className,
}: {
  offering: OfferingDef;
  variant?: "default" | "compact";
  showIndustry?: boolean;
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const Heading = headingLevel;
  const compact = variant === "compact";
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-lg border border-border bg-white transition-colors focus-within:border-brand-green focus-within:ring-3 focus-within:ring-ring/40 hover:border-brand-green/60",
        compact ? "p-5" : "p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-success uppercase">{offering.category}</p>
        {offering.sandbox ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-success">
            <FlaskConical aria-hidden="true" className="size-3" />
            Playground
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Heading className={cn("font-semibold text-brand-ink", compact ? "text-base" : "text-xl")}>{offering.name}</Heading>
        <p className="text-sm text-muted-foreground">{compact ? offering.summary : offering.description}</p>
      </div>
      {compact ? null : (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${offering.name} capabilities`}>
          {offering.capabilities.slice(0, 4).map((c) => (
            <li key={c} className="rounded-md border border-border bg-brand-light px-2 py-1 text-xs text-brand-ink">
              {c}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        {showIndustry ? <span className="text-xs text-brand-muted">{industryName(offering.industry)}</span> : <span />}
        <Link
          href={`/products/${offering.slug}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-brand-navy after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
        >
          Explore product
          <span className="sr-only">: {offering.name}</span>
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </article>
  );
}
