import Link from "next/link";
import { ArrowRight, FlaskConical, Info } from "lucide-react";
import { AI_OFFERINGS, INDUSTRIES } from "@/content/catalogue";
import { DISCLAIMER } from "@/content/site";
import { productLinesFor } from "@/components/site/catalogue";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { ExternalLink } from "@/components/site/external-link";
import { OfferingCard } from "@/components/site/offering-card";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Products",
  description:
    "azentio.ai AI offerings — Credit Strategy Simulator, SME Credit Decisioning Workbench, Similar Portfolio Intelligence, RIVA and Financial Analysis Intelligence — and Azentio's enterprise product lines by industry.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Products"
        title="Built to Work. Designed to Evolve."
        description={
          <p>
            azentio.ai AI offerings, alongside the Azentio enterprise product lines for banking, capital markets, risk
            &amp; compliance, insurance and ERP.
          </p>
        }
        art="network"
      >
        <CtaLink href="#ai-offerings" variant="green">
          azentio.ai offerings
        </CtaLink>
        <CtaLink href="#enterprise-portfolio" variant="outline-dark" arrow={false}>
          Enterprise portfolio
        </CtaLink>
      </PageHero>

      <section id="ai-offerings" aria-labelledby="ai-offerings-heading" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="ai-offerings-heading"
            eyebrow="azentio.ai"
            title="AI offerings"
            description="Explainable intelligence for credit, portfolio and reporting teams. Offerings marked Playground have a guided scenario with synthetic data in the portal."
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {AI_OFFERINGS.map((o, i) => (
              <li key={o.slug}>
                <Reveal delay={(i % 3) * 0.05} className="h-full">
                  <OfferingCard offering={o} showIndustry />
                </Reveal>
              </li>
            ))}
            <li>
              <div className="flex h-full flex-col justify-between gap-4 rounded-lg border border-dashed border-border bg-brand-light p-6">
                <div className="flex flex-col gap-2">
                  <FlaskConical aria-hidden="true" className="size-5 text-success" />
                  <h3 className="text-lg font-semibold text-brand-ink">Try before you talk</h3>
                  <p className="text-sm text-muted-foreground">
                    Signed-in employees and entitled client workspaces can run the Playground scenarios with synthetic
                    data — never customer data.
                  </p>
                </div>
                <Link href="/lab" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline">
                  How the AI Lab works
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section
        id="enterprise-portfolio"
        aria-labelledby="enterprise-heading"
        className="scroll-mt-20 bg-brand-light py-16 sm:py-20"
      >
        <div className="container-page flex flex-col gap-12">
          <SectionHeader
            id="enterprise-heading"
            eyebrow="Azentio enterprise portfolio"
            title="Product lines by industry"
            description="Azentio's enterprise software, as published on azentio.com. Follow a product for a summary and a link to its official page."
          />
          {INDUSTRIES.map((ind) => {
            const lines = productLinesFor(ind.slug);
            return (
              <section key={ind.slug} aria-labelledby={`industry-${ind.slug}`} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 id={`industry-${ind.slug}`} className="text-2xl font-semibold text-brand-ink">
                      {ind.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{ind.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <Link href={`/solutions/${ind.slug}`} className="font-semibold text-brand-navy hover:underline">
                      {ind.name} solutions
                    </Link>
                    <ExternalLink href={ind.sourceUrl} className="text-brand-muted">
                      azentio.com
                    </ExternalLink>
                  </div>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {lines.map((o) => (
                    <li key={o.slug}>
                      <OfferingCard offering={o} variant="compact" headingLevel="h4" />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {DISCLAIMER}
          </p>
        </div>
      </section>

      <CTASection
        title="See an offering in context."
        description="Tell us which product you're interested in and what you'd like to achieve, and the azentio.ai team will review your request."
        primary={{ label: "Request a demo", href: "/connect" }}
      />
    </>
  );
}
