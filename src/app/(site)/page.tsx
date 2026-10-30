import Link from "next/link";
import { ArrowRight, Award, BookOpen, CirclePlay, FlaskConical, Radio, Video } from "lucide-react";
import { AI_OFFERINGS, INDUSTRIES } from "@/content/catalogue";
import {
  CAPABILITIES,
  CAPABILITIES_INTRO,
  COMPANY_DESCRIPTION,
  FEATURED_INTRO,
  FEATURED_PRODUCT_SLUGS,
  HERO,
  IDEAS_IN_MOTION,
  MEDIA_TEASER,
  RECOGNITION_HIGHLIGHT,
  REGIONS_LINE,
  TRUST_INTRO,
  TRUST_PILLARS,
  WHO_WE_ARE,
} from "@/content/site";
import { log } from "@/lib/log";
import { CapabilityCard } from "@/components/site/capability-card";
import { productLinesFor } from "@/components/site/catalogue";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { OfferingCard } from "@/components/site/offering-card";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeader } from "@/components/site/section-header";
import { SiteBanner, type BannerData } from "@/components/site/site-banner";
import { pageMetadata } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "azentio.ai — Build Intelligence. Create Impact.",
  absoluteTitle: true,
  description:
    "Enterprise AI from Azentio for banking, insurance, capital markets and ERP: intelligent decisioning, document intelligence, AI agents and analytics — engineered for trust.",
  path: "/",
});

const IDEA_ICONS = [FlaskConical, Radio, BookOpen];

/**
 * The banner is optional: the homepage must render even if the database is unreachable or
 * misconfigured, so the service is imported lazily and the query is bounded by a timeout.
 */
async function loadBanner(): Promise<BannerData | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { getActiveBanner } = await import("@/server/services/public-content");
    return await Promise.race([
      getActiveBanner(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 2500);
      }),
    ]);
  } catch (error) {
    log.warn("Homepage banner unavailable", { error });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function HomePage() {
  const banner = await loadBanner();
  const featured = FEATURED_PRODUCT_SLUGS.map((slug) => AI_OFFERINGS.find((o) => o.slug === slug)).filter(
    (o): o is (typeof AI_OFFERINGS)[number] => Boolean(o),
  );

  return (
    <>
      {banner ? <SiteBanner banner={banner} /> : null}

      <PageHero
        size="lg"
        art="network"
        eyebrow={
          <>
            {HERO.eyebrowPrefix} <span className="tracking-normal normal-case">azentio.ai</span>
          </>
        }
        title={
          <>
            {HERO.title[0]} <span className="block text-brand-green">{HERO.title[1]}</span>
          </>
        }
        description={<p>{HERO.lead}</p>}
      >
        <CtaLink href={HERO.cta.href} variant="green">
          {HERO.cta.label}
        </CtaLink>
        <CtaLink href="/connect" variant="outline-dark" arrow={false}>
          Request a demo
        </CtaLink>
      </PageHero>

      {/* Enterprise portfolio strip */}
      <section aria-label="Industries Azentio serves" className="border-b border-white/10 bg-brand-navy-deep">
        <div className="container-page flex flex-col gap-3 py-5 text-sm sm:flex-row sm:items-center sm:gap-6">
          <p className="shrink-0 text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Azentio enterprise portfolio</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {INDUSTRIES.map((i) => (
              <li key={i.slug}>
                <Link
                  href={`/solutions/${i.slug}`}
                  className="rounded-sm font-medium text-slate-200 hover:text-brand-green focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who we are */}
      <section aria-labelledby="who-heading" className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionHeader id="who-heading" eyebrow={WHO_WE_ARE.eyebrow} title={WHO_WE_ARE.title} />
            <div className="mt-6 flex max-w-xl flex-col gap-4 text-base text-muted-foreground sm:text-lg">
              {WHO_WE_ARE.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {WHO_WE_ARE.pillars.map((p, i) => (
                <li key={p.title} className="flex flex-col gap-2 bg-white p-6">
                  <span className="font-heading text-sm font-semibold text-success">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-base font-semibold text-brand-ink">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* What we do */}
      <section aria-labelledby="what-heading" className="bg-brand-light py-16 sm:py-20 lg:py-24">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="what-heading"
            eyebrow={CAPABILITIES_INTRO.eyebrow}
            title={CAPABILITIES_INTRO.title}
            description={CAPABILITIES_INTRO.description}
          />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <li key={c.key}>
                <Reveal delay={(i % 3) * 0.06} className="h-full">
                  <CapabilityCard capability={c} />
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured products */}
      <section aria-labelledby="featured-heading" className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeader id="featured-heading" eyebrow={FEATURED_INTRO.eyebrow} title={FEATURED_INTRO.title} />
            <CtaLink href="/products" variant="outline-light" size="md">
              View all products
            </CtaLink>
          </div>
          <ul className="grid gap-5 md:grid-cols-2">
            {featured.map((o, i) => (
              <li key={o.slug}>
                <Reveal delay={(i % 2) * 0.06} className="h-full">
                  <OfferingCard offering={o} />
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Media teaser */}
      <section aria-labelledby="media-heading" className="relative overflow-hidden bg-brand-navy py-16 text-white sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-60" />
        <div className="container-page relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <Reveal>
            <SectionHeader
              id="media-heading"
              tone="dark"
              eyebrow={MEDIA_TEASER.eyebrow}
              title={
                <>
                  {MEDIA_TEASER.title} <span className="text-brand-green">{MEDIA_TEASER.emphasis}</span>
                </>
              }
              description={MEDIA_TEASER.description}
            />
            <div className="mt-8">
              <CtaLink href={MEDIA_TEASER.cta.href} variant="green">
                {MEDIA_TEASER.cta.label}
              </CtaLink>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <ul className="grid gap-3">
              {[
                { icon: CirclePlay, title: "Product showcases", text: "Approved videos of azentio.ai products and workflows." },
                { icon: Video, title: "Session recordings", text: "Public azentio.ai Live sessions, once recorded." },
                { icon: Radio, title: "Upcoming live sessions", text: "Conversations open to everyone, listed on azentio.ai Live." },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-green" />
                  <div>
                    <p className="font-heading font-semibold text-white">{title}</p>
                    <p className="text-sm text-slate-300">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust-heading" className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeader id="trust-heading" eyebrow={TRUST_INTRO.eyebrow} title={TRUST_INTRO.title} description={TRUST_INTRO.description} />
            <CtaLink href="/technology" variant="outline-light" size="md">
              How we build for trust
            </CtaLink>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_PILLARS.map((p, i) => (
              <li key={p.title} className="flex flex-col gap-3 bg-white p-6 sm:p-7">
                <span aria-hidden="true" className="font-heading text-3xl font-semibold text-success">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold text-brand-ink">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Azentio enterprise portfolio */}
      <section aria-labelledby="portfolio-heading" className="bg-brand-light py-16 sm:py-20 lg:py-24">
        <div className="container-page flex flex-col gap-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <SectionHeader id="portfolio-heading" eyebrow="Azentio enterprise portfolio" title="Purpose-built for the industries we serve." />
            <div className="flex flex-col gap-3 text-base text-muted-foreground">
              <p>{COMPANY_DESCRIPTION}</p>
              <p className="text-sm font-medium text-brand-ink">{REGIONS_LINE}.</p>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {INDUSTRIES.map((ind) => (
              <li key={ind.slug}>
                <Link
                  href={`/solutions/${ind.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-5 transition-colors hover:border-brand-green/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <h3 className="text-base font-semibold text-brand-ink">{ind.name}</h3>
                  <p className="text-sm text-muted-foreground">{ind.tagline}</p>
                  <p className="mt-auto text-xs text-brand-muted">
                    {productLinesFor(ind.slug)
                      .slice(0, 3)
                      .map((p) => p.name)
                      .join(" · ")}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy">
                    Explore
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Award aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <p className="text-sm text-brand-ink">
                <span className="font-semibold">Recognised in 2026: </span>
                {RECOGNITION_HIGHLIGHT}
              </p>
            </div>
            <CtaLink href="/insights#recognition" variant="outline-light" size="md">
              See all recognitions
            </CtaLink>
          </div>
        </div>
      </section>

      {/* Ideas in motion */}
      <section aria-labelledby="ideas-heading" className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader id="ideas-heading" eyebrow={IDEAS_IN_MOTION.eyebrow} title={IDEAS_IN_MOTION.title} />
          <ul className="grid gap-5 md:grid-cols-3">
            {IDEAS_IN_MOTION.cards.map((card, i) => {
              const Icon = IDEA_ICONS[i] ?? FlaskConical;
              return (
                <li key={card.href}>
                  <Reveal delay={i * 0.06} className="h-full">
                    <Link
                      href={card.href}
                      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-brand-green/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <div className="relative flex h-32 items-end bg-brand-navy p-5">
                        <div aria-hidden="true" className="absolute inset-0 bg-[url(/art/dots.svg)] opacity-70" />
                        <Icon aria-hidden="true" className="relative size-6 text-brand-green" />
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-6">
                        <p className="text-xs font-semibold tracking-[0.16em] text-success uppercase">{card.label}</p>
                        <h3 className="text-xl font-semibold text-balance text-brand-ink">{card.title}</h3>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-navy">
                          {card.cta}
                          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <CTASection />
    </>
  );
}
