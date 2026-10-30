import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleBody } from "@/components/site/article-body";
import { CTASection } from "@/components/site/cta-section";
import { ExternalLink } from "@/components/site/external-link";
import { hostLabel, safeExternalUrl } from "@/components/site/embed";
import { formatDate, isoDate } from "@/components/site/format";
import { PageHero } from "@/components/site/page-hero";
import { pageMetadata } from "@/components/site/seo";
import { getPublicInsight } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getPublicInsight(slug);
  if (!insight) return { title: "Insight not found", robots: { index: false } };
  return pageMetadata({
    title: insight.title,
    description: insight.summary.slice(0, 200),
    path: `/insights/${insight.slug}`,
    type: "article",
  });
}

export default async function InsightPage({ params }: Props) {
  const { slug } = await params;
  // Only PUBLIC + PUBLISHED insights resolve; anything else is indistinguishable from "missing".
  const insight = await getPublicInsight(slug);
  if (!insight) notFound();

  const date = insight.publishedAt ?? insight.updatedAt;
  const source = safeExternalUrl(insight.sourceUrl);

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: insight.title }]}
        eyebrow={
          <>
            Insight · <time dateTime={isoDate(date)}>{formatDate(date)}</time>
          </>
        }
        title={insight.title}
        description={<p>{insight.summary}</p>}
      />

      <article aria-label={insight.title} className="bg-white py-14 sm:py-16">
        <div className="container-page">
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            <ArticleBody body={insight.body} />
            {source ? (
              <p className="border-t border-border pt-6 text-sm text-muted-foreground">
                Source:{" "}
                <ExternalLink href={source} className="text-brand-navy">
                  {hostLabel(source)}
                </ExternalLink>
              </p>
            ) : null}
            <Link
              href="/insights"
              className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-semibold text-brand-navy hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              All insights
            </Link>
          </div>
        </div>
      </article>

      <CTASection />
    </>
  );
}
