import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { AI_OFFERINGS, INDUSTRIES } from "@/content/catalogue";
import { COMPANY_DESCRIPTION, REGIONS_LINE, REGIONS_SERVED } from "@/content/site";
import { industryPhrase, productLinesFor } from "@/components/site/catalogue";
import { CTASection } from "@/components/site/cta-section";
import { OfferingCard } from "@/components/site/offering-card";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Solutions",
  description:
    "Azentio solutions for banking, capital markets, risk & compliance, insurance and ERP — and where azentio.ai intelligence fits in each.",
  path: "/solutions",
});

export default function SolutionsPage() {
  const crossIndustry = AI_OFFERINGS.filter((o) => o.industry === "cross-industry");
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Intelligence for the industries Azentio serves."
        description={<p>{COMPANY_DESCRIPTION}</p>}
        art="layers"
      />

      <section aria-labelledby="industries-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="industries-heading"
            eyebrow="Industries"
            title="Five industries, one approach to applied intelligence."
            description="Choose an industry to see Azentio's product lines and the azentio.ai capabilities that apply."
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind, i) => {
              const lines = productLinesFor(ind.slug);
              return (
                <li key={ind.slug}>
                  <Reveal delay={(i % 3) * 0.05} className="h-full">
                    <Link
                      href={`/solutions/${ind.slug}`}
                      className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-6 transition-colors hover:border-brand-green/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <h3 className="text-xl font-semibold text-brand-ink">{ind.name}</h3>
                      <p className="text-sm text-muted-foreground">{ind.tagline}</p>
                      <ul className="flex flex-wrap gap-1.5" aria-label={`${ind.name} product lines`}>
                        {lines.map((p) => (
                          <li key={p.slug} className="rounded-md border border-border bg-brand-light px-2 py-1 text-xs text-brand-ink">
                            {p.name}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-navy">
                        Explore {industryPhrase(ind.name)}
                        <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </span>
                    </Link>
                  </Reveal>
                </li>
              );
            })}
            <li>
              <div className="flex h-full flex-col gap-4 rounded-lg border border-border bg-brand-navy p-6 text-white">
                <Globe aria-hidden="true" className="size-6 text-brand-green" />
                <h3 className="text-xl font-semibold">Where we work</h3>
                <p className="text-sm text-slate-300">{REGIONS_LINE}.</p>
                <ul className="mt-auto flex flex-wrap gap-1.5">
                  {REGIONS_SERVED.map((r) => (
                    <li key={r} className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {crossIndustry.length ? (
        <section aria-labelledby="cross-heading" className="bg-brand-light py-16 sm:py-20">
          <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <SectionHeader
              id="cross-heading"
              eyebrow="Cross-industry"
              title="Reporting intelligence that works across lines of business."
              description="Some azentio.ai offerings are not tied to one industry."
            />
            <ul className="grid gap-4">
              {crossIndustry.map((o) => (
                <li key={o.slug}>
                  <OfferingCard offering={o} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <CTASection />
    </>
  );
}
