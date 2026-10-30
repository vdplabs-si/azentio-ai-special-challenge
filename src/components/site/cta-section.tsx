import type { ReactNode } from "react";
import { CLOSING_CTA } from "@/content/site";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal } from "@/components/site/reveal";

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
        <Reveal>
          <div className="relative overflow-hidden rounded-lg bg-brand-navy px-6 py-12 sm:px-12 sm:py-14">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-70" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-brand-green" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-2xl flex-col gap-4">
                <p className="eyebrow text-brand-green">{eyebrow}</p>
                <h2 id="cta-heading" className="text-3xl font-semibold text-balance text-white sm:text-4xl">
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
        </Reveal>
      </div>
    </section>
  );
}
