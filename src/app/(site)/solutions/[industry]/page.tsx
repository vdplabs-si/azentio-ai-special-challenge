import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { INDUSTRIES } from "@/content/catalogue";
import { CAPABILITIES, DISCLAIMER, INDUSTRY_CAPABILITIES } from "@/content/site";
import { aiOfferingsFor, findIndustry, industryPhrase, productLinesFor } from "@/components/site/catalogue";
import { CapabilityCard } from "@/components/site/capability-card";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { OfferingCard } from "@/components/site/offering-card";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

type Props = { params: Promise<{ industry: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ industry: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { industry: slug } = await params;
  const industry = findIndustry(slug);
  if (!industry) return { title: "Solution not found" };
  return pageMetadata({
    title: `${industry.name} solutions`,
    description: `${industry.tagline} Azentio product lines for ${industryPhrase(industry.name)} and the azentio.ai capabilities that apply.`,
    path: `/solutions/${industry.slug}`,
  });
}

export default async function IndustryPage({ params }: Props) {
  const { industry: slug } = await params;
  const industry = findIndustry(slug);
  if (!industry) notFound();

  const lines = productLinesFor(industry.slug);
  const ai = aiOfferingsFor(industry.slug);
  const capabilityKeys = INDUSTRY_CAPABILITIES[industry.slug] ?? [];
  const capabilities = CAPABILITIES.filter((c) => capabilityKeys.includes(c.key));

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: industry.name }]}
        eyebrow="Solutions"
        title={industry.name}
        description={<p>{industry.tagline}</p>}
        art="layers"
      >
        <CtaLink href="/connect?interest=general" variant="green">
          Request a demo
        </CtaLink>
        <CtaLink href={industry.sourceUrl} variant="outline-dark" external>
          {industry.name} on azentio.com
        </CtaLink>
      </PageHero>

      <section aria-labelledby="lines-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          <SectionHeader
            id="lines-heading"
            eyebrow="Azentio enterprise portfolio"
            title={`${industry.name} product lines`}
            description="Enterprise software from Azentio's portfolio, as published on azentio.com."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((o) => (
              <li key={o.slug}>
                <OfferingCard offering={o} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {ai.length ? (
        <section aria-labelledby="ai-heading" className="bg-brand-light py-16 sm:py-20">
          <div className="container-page flex flex-col gap-8">
            <SectionHeader
              id="ai-heading"
              eyebrow="azentio.ai"
              title="AI offerings for this industry"
              description={
                ai.every((o) => o.industry === "cross-industry")
                  ? "These azentio.ai offerings work across industries."
                  : "azentio.ai offerings built for this industry, plus those that work across industries."
              }
            />
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ai.map((o) => (
                <li key={o.slug}>
                  <OfferingCard offering={o} showIndustry />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {capabilities.length ? (
        <section aria-labelledby="capabilities-heading" className="bg-white py-16 sm:py-20">
          <div className="container-page flex flex-col gap-8">
            <SectionHeader
              id="capabilities-heading"
              eyebrow="Intelligence in every layer"
              title="Capabilities that apply"
              description="The azentio.ai capability areas most relevant to this industry. An indicative view, not a list of deployed features."
            />
            <ul className="grid gap-5 md:grid-cols-3">
              {capabilities.map((c) => (
                <li key={c.key}>
                  <CapabilityCard capability={c} />
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {DISCLAIMER}
            </p>
          </div>
        </section>
      ) : null}

      <CTASection
        title={`Bring intelligence to ${industryPhrase(industry.name)}.`}
        primary={{ label: "Start a Conversation", href: "/connect?interest=general" }}
        secondary={{ label: "All solutions", href: "/solutions" }}
      />
    </>
  );
}
