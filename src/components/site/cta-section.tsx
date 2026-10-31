import type { ReactNode } from "react";
import { CLOSING_CTA } from "@/content/site";
import { CtaLink } from "@/components/site/cta-link";

/** Closing call-to-action band ("Build what's next"). Defaults to the prototype copy. */
export function CTASection({
  eyebrow = CLOSING_CTA.eyebrow,
  title = CLOSING_CTA.title,
  description = CLOSING_CTA.description,
  primary = CLOSING_CTA.cta,
  secondary,
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string; external?: boolean };
}) {
  return (
    <section aria-labelledby="cta-heading" className="bg-white py-16 sm:py-20">
      <div className="container-page">
        <div>
          <div className="relative overflow-hidden rounded-[14px] bg-brand-abyss px-6 py-12 sm:px-12 sm:py-14">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-40" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-2xl flex-col gap-4">
                <p className="text-sm font-medium text-white/65">{eyebrow}</p>
                <h2 id="cta-heading" className="type-display text-[clamp(1.9rem,3.4vw,2.8rem)] text-balance text-white">
                  {title}
                </h2>
                {description ? <p className="text-base text-slate-300 sm:text-lg">{description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <CtaLink href={primary.href} variant="green">
                  {primary.label}
                </CtaLink>
                {secondary ? (
                  <CtaLink href={secondary.href} variant="outline-dark" external={secondary.external}>
                    {secondary.label}
                  </CtaLink>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
