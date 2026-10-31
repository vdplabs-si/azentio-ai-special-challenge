import Link from "next/link";
import { AI_OFFERINGS, INDUSTRIES } from "@/content/catalogue";
import { COMPANY_DESCRIPTION, GOVERNANCE, HOME_HERO, HOME_STEPS, RECOGNITIONS, RECOGNITION_SOURCE, REGIONS_LINE } from "@/content/site";
import { log } from "@/lib/log";
import { industryName, productLinesFor } from "@/components/site/catalogue";
import { CtaLink } from "@/components/site/cta-link";
import { HomeHero } from "@/components/site/home-hero";
import { ScenePoster } from "@/components/site/scene-chrome";
import { SiteBanner, type BannerData } from "@/components/site/site-banner";
import { pageMetadata } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "azentio.ai — Credit and risk AI that learns with you",
  absoluteTitle: true,
  description:
    "Enterprise AI from Azentio for banking, insurance, capital markets and ERP, improved through governed, de-identified learning that institutions choose to share.",
  path: "/",
});

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

/** Distinct recognising bodies, in the order Azentio lists them (e.g. "Chartis", "GIFA"). */
const RECOGNISED_BY = ["Chartis", "Celent", "GIFA", "QKS"].filter((body) => RECOGNITIONS.some((r) => r.detail.includes(body)));

export default async function HomePage() {
  const banner = await loadBanner();

  return (
    <>
      {banner ? <SiteBanner banner={banner} /> : null}

      <HomeHero
        title={HOME_HERO.title}
        lead={HOME_HERO.lead}
        steps={HOME_STEPS.map((s) => ({ ...s }))}
        poster={<ScenePoster preset="home" />}
        actions={
          <>
            <CtaLink href="/connect" variant="green">
              Request a demo
            </CtaLink>
            <CtaLink href="/products" variant="outline-dark">
              Explore the AI offerings
            </CtaLink>
          </>
        }
      />

      {/* Recognition — one typographic line, from Azentio's own announcements. */}
      <section aria-labelledby="recognition" className="border-b border-border bg-brand-light">
        <div className="container-page flex flex-col gap-2 py-8 sm:flex-row sm:items-baseline sm:justify-between">
          <p id="recognition" className="type-wide text-lg font-semibold text-brand-ink sm:text-xl">
            Recognised in 2026 by {RECOGNISED_BY.slice(0, -1).join(", ")} and {RECOGNISED_BY.at(-1)}
          </p>
          <a href={RECOGNITION_SOURCE} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-success underline-offset-4 hover:underline">
            Read the announcements on azentio.com<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>

      {/* AI offerings — a typographic index, not a card grid. */}
      <section aria-labelledby="offerings" className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 id="offerings" className="type-display text-[clamp(2rem,3.6vw,3rem)] text-brand-ink">
                Five AI offerings, each with a sandbox on synthetic data
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-brand-muted">
                Approved clients can try every offering in the portal Playground before anything touches production data. Outputs there are simulations, not credit decisions.
              </p>
              <div className="mt-7">
                <CtaLink href="/products" variant="navy">
                  Compare all offerings
                </CtaLink>
              </div>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {AI_OFFERINGS.map((o) => (
                <li key={o.slug}>
                  <Link
                    href={`/products/${o.slug}`}
                    className="group grid gap-2 py-7 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-8"
                  >
                    <span className="type-wide text-2xl font-semibold text-brand-ink transition-colors group-hover:text-success group-focus-visible:underline sm:text-[1.75rem]">
                      {o.name}
                    </span>
                    <span className="text-sm text-brand-muted sm:row-span-2 sm:self-center sm:text-right">{industryName(o.industry)}</span>
                    <span className="max-w-xl text-base text-brand-ink/80">{o.summary}</span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted sm:col-span-2">
                      {o.capabilities.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Governance — the lifecycle the portal enforces. A real sequence, so it is numbered. */}
      <section aria-labelledby="governance" className="relative overflow-clip bg-brand-abyss py-20 text-white sm:py-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-30" />
        <div className="container-page relative">
          <h2 id="governance" className="type-display max-w-3xl text-[clamp(2rem,3.8vw,3.2rem)]">
            {GOVERNANCE.title}
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-white/75">{GOVERNANCE.lead}</p>

          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {GOVERNANCE.lifecycle.map((s, i) => (
              <li key={s.state} className="relative pt-6">
                <span aria-hidden="true" className={i < 2 ? "absolute top-0 left-0 h-0.5 w-full bg-brand-green" : "absolute top-0 left-0 h-0.5 w-full bg-brand-mint"} />
                <p className="flex items-baseline gap-3">
                  <span className="type-wide text-sm text-white/50 tabular-nums">{i + 1}</span>
                  <span className="type-wide text-xl font-semibold">{s.state}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-3xl border-l-2 border-brand-mint pl-4 text-base text-white/85">{GOVERNANCE.withdraw}</p>

          <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <h3 className="type-wide text-xl font-semibold">Four separate consents</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{GOVERNANCE.consentNote}</p>
            </div>
            <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {GOVERNANCE.consents.map((c, i) => (
                <p key={c} className="flex gap-3 text-base text-white/85">
                  <span className="type-wide text-sm font-semibold text-brand-green">{String.fromCharCode(97 + i)}</span>
                  {c}
                </p>
              ))}
              <p className="text-sm text-white/60 sm:col-span-2">{GOVERNANCE.cohort}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Industries — an index of the enterprise portfolio. */}
      <section aria-labelledby="industries" className="bg-brand-light py-20 sm:py-24">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <h2 id="industries" className="type-display text-[clamp(2rem,3.4vw,2.8rem)] text-brand-ink">
                Built on Azentio&rsquo;s enterprise platforms
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-brand-muted">{COMPANY_DESCRIPTION}</p>
              <p className="mt-4 text-sm font-medium text-brand-ink">{REGIONS_LINE}</p>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {INDUSTRIES.map((ind) => (
                <li key={ind.slug}>
                  <Link href={`/solutions/${ind.slug}`} className="group block py-6 focus-visible:outline-none">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <span className="type-wide text-xl font-semibold text-brand-ink transition-colors group-hover:text-success group-focus-visible:underline">
                        {ind.name}
                      </span>
                      <span className="text-sm text-brand-muted">{ind.tagline}</span>
                    </span>
                    <span className="mt-2 block text-sm text-brand-ink/75">
                      {productLinesFor(ind.slug)
                        .map((p) => p.name)
                        .join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Closing — asymmetric: try it, or talk to us. */}
      <section aria-labelledby="next-steps" className="bg-white py-20 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <h2 id="next-steps" className="type-display text-[clamp(2rem,3.6vw,3rem)] text-brand-ink">
              See it work on synthetic data first
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-muted">
              The AI Lab explains how the Playground runs each offering against labelled synthetic portfolios, and how hackathon teams and live sessions feed the roadmap.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <CtaLink href="/lab" variant="navy">
                Visit the AI Lab
              </CtaLink>
              <CtaLink href="/live" variant="outline-light">
                Watch live sessions
              </CtaLink>
            </div>
          </div>
          <div className="rounded-[14px] bg-brand-abyss p-8 text-white sm:p-10">
            <h3 className="type-wide text-2xl font-semibold">Talk to the team</h3>
            <p className="mt-3 text-base text-white/75">Tell us about your portfolio and the decision you want to improve. We will reply to the contact you give us.</p>
            <div className="mt-7">
              <CtaLink href="/connect" variant="green">
                Request a demo
              </CtaLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
