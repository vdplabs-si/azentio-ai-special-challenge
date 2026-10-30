import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { AZENTIO, RECOGNITION_SOURCE } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { EmptyState } from "@/components/site/empty-state";
import { ExternalLink } from "@/components/site/external-link";
import { formatDate, isoDate } from "@/components/site/format";
import { PageHero } from "@/components/site/page-hero";
import { RecognitionList } from "@/components/site/recognition-list";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";
import { listPublicInsights } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Insights",
  description:
    "Perspectives from azentio.ai on applied enterprise AI, plus Azentio's verified 2026 industry recognitions.",
  path: "/insights",
});

export default async function InsightsPage() {
  const insights = await listPublicInsights();

  return (
    <>
      <PageHero
        eyebrow="Perspectives"
        title="Ideas Worth Exploring. Perspectives Worth Sharing."
        description={<p>Points of view on applied enterprise AI from the azentio.ai team, and the recognition Azentio has earned in 2026.</p>}
      >
        <CtaLink href="#recognition" variant="outline-dark" arrow={false}>
          2026 recognition
        </CtaLink>
      </PageHero>

      <section aria-labelledby="articles-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader id="articles-heading" eyebrow="Insights" title="Latest perspectives" />
          {insights.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No insights have been published yet."
              description="Articles appear here once the content team publishes them for public readers."
            >
              <CtaLink href={AZENTIO.insights} variant="outline-light" size="md" external>
                Insights on azentio.com
              </CtaLink>
            </EmptyState>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((item) => {
                const date = item.publishedAt ?? item.updatedAt;
                return (
                  <li key={item.id}>
                    <article className="group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6 transition-colors focus-within:ring-3 focus-within:ring-ring/40 hover:border-brand-green/60">
                      <time dateTime={isoDate(date)} className="text-xs font-medium text-brand-muted">
                        {formatDate(date)}
                      </time>
                      <h3 className="text-lg font-semibold text-balance text-brand-ink">{item.title}</h3>
                      <p className="line-clamp-4 text-sm text-muted-foreground">{item.summary}</p>
                      <Link
                        href={`/insights/${item.slug}`}
                        className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-navy after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                      >
                        Read insight<span className="sr-only">: {item.title}</span>
                        <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section id="recognition" aria-labelledby="recognition-heading" className="scroll-mt-20 bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="recognition-heading"
            eyebrow="Recognition"
            title="Recognised by industry analysts in 2026."
            description={
              <>
                As published by Azentio. Source:{" "}
                <ExternalLink href={RECOGNITION_SOURCE} className="text-brand-navy">
                  azentio.com
                </ExternalLink>
              </>
            }
          />
          <RecognitionList />
          <div>
            <CtaLink href={AZENTIO.awards} variant="outline-light" size="md" external>
              Awards &amp; analyst reports on azentio.com
            </CtaLink>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
