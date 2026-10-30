import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, FlaskConical, Info, LockKeyhole } from "lucide-react";
import { OFFERINGS, type OfferingDef } from "@/content/catalogue";
import { DISCLAIMER } from "@/content/site";
import { findIndustry, findOffering, industryName, isAiOffering } from "@/components/site/catalogue";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { ExternalLink } from "@/components/site/external-link";
import { OfferingCard } from "@/components/site/offering-card";
import { PageHero } from "@/components/site/page-hero";
import { hostLabel } from "@/components/site/embed";
import { pageMetadata } from "@/components/site/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return OFFERINGS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const offering = findOffering(slug);
  if (!offering) return { title: "Product not found" };
  return pageMetadata({
    title: offering.name,
    description: `${offering.summary} ${offering.category} from ${isAiOffering(offering) ? "azentio.ai" : "Azentio"}.`,
    path: `/products/${offering.slug}`,
  });
}

function related(offering: OfferingDef) {
  return OFFERINGS.filter(
    (o) => o.slug !== offering.slug && (o.industry === offering.industry || (isAiOffering(offering) && isAiOffering(o))),
  ).slice(0, 3);
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const offering = findOffering(slug);
  if (!offering) notFound();

  const ai = isAiOffering(offering);
  const industry = findIndustry(offering.industry);
  const others = related(offering);

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: offering.name }]}
        eyebrow={offering.category}
        title={offering.name}
        description={<p>{offering.summary}</p>}
      >
        <CtaLink href={`/connect?interest=${encodeURIComponent(offering.slug)}`} variant="green">
          Request a demo
        </CtaLink>
        {offering.sandbox ? (
          <CtaLink href="/portal/playground" variant="outline-dark">
            Try it in the Playground
          </CtaLink>
        ) : null}
      </PageHero>

      <section aria-labelledby="overview-heading" className="bg-white py-14 sm:py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <h2 id="overview-heading" className="text-2xl font-semibold text-brand-ink sm:text-3xl">
                Overview
              </h2>
              <p className="text-base text-muted-foreground sm:text-lg">{offering.description}</p>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-brand-ink">Capabilities</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {offering.capabilities.map((c) => (
                  <li key={c} className="flex items-start gap-3 rounded-lg border border-border bg-white p-4">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-success">
                      <Check aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="text-sm font-medium text-brand-ink">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {DISCLAIMER}
            </p>
          </div>

          <aside aria-label="Product details" className="flex flex-col gap-4">
            <dl className="divide-y divide-border rounded-lg border border-border bg-brand-light text-sm">
              <div className="flex flex-col gap-1 p-5">
                <dt className="text-xs font-semibold tracking-[0.14em] text-brand-muted uppercase">Portfolio</dt>
                <dd className="font-medium text-brand-ink">{ai ? "azentio.ai AI offering" : "Azentio enterprise product line"}</dd>
              </div>
              <div className="flex flex-col gap-1 p-5">
                <dt className="text-xs font-semibold tracking-[0.14em] text-brand-muted uppercase">Industry</dt>
                <dd className="font-medium text-brand-ink">
                  {industry ? (
                    <Link href={`/solutions/${industry.slug}`} className="text-brand-navy underline-offset-4 hover:underline">
                      {industry.name}
                    </Link>
                  ) : (
                    <Link href="/solutions" className="text-brand-navy underline-offset-4 hover:underline">
                      {industryName(offering.industry)}
                    </Link>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1 p-5">
                <dt className="text-xs font-semibold tracking-[0.14em] text-brand-muted uppercase">Source</dt>
                <dd>
                  <ExternalLink href={offering.sourceUrl} className="text-brand-navy">
                    {hostLabel(offering.sourceUrl)}
                  </ExternalLink>
                </dd>
              </div>
            </dl>

            {offering.sandbox ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
                <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                  <FlaskConical aria-hidden="true" className="size-4 text-success" />
                  Playground scenario
                </p>
                <p className="text-sm text-muted-foreground">
                  A guided scenario with synthetic data is available in the azentio.ai portal for employees and for client
                  workspaces entitled to this offering.
                </p>
                <p className="flex items-center gap-1.5 text-xs text-brand-muted">
                  <LockKeyhole aria-hidden="true" className="size-3.5" />
                  Sign-in required
                </p>
                <Link
                  href="/portal/playground"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline"
                >
                  Open the Playground
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {others.length ? (
        <section aria-labelledby="related-heading" className="bg-brand-light py-14 sm:py-16">
          <div className="container-page flex flex-col gap-8">
            <h2 id="related-heading" className="text-2xl font-semibold text-brand-ink sm:text-3xl">
              Related products
            </h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {others.map((o) => (
                <li key={o.slug}>
                  <OfferingCard offering={o} variant="compact" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <CTASection
        eyebrow="Request a demo"
        title={`Talk to us about ${offering.name}.`}
        description="Share your context and what you'd like to see. Your request goes to the azentio.ai team for review."
        primary={{ label: "Request a demo", href: `/connect?interest=${encodeURIComponent(offering.slug)}` }}
        secondary={{ label: "All products", href: "/products" }}
      />
    </>
  );
}
