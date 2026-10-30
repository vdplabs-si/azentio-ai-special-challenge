import Link from "next/link";
import { ArrowRight, Building2, Globe, LockKeyhole, MapPin, Users } from "lucide-react";
import { INDUSTRIES } from "@/content/catalogue";
import { AZENTIO, COMPANY_DESCRIPTION, RECOGNITION_SOURCE, REGIONS_LINE, REGIONS_SERVED, WHO_WE_ARE } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { ExternalLink } from "@/components/site/external-link";
import { PageHero } from "@/components/site/page-hero";
import { RecognitionList } from "@/components/site/recognition-list";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "About",
  description:
    "About Azentio and azentio.ai: purpose-built, intelligence-driven technology for banking, insurance, capital markets and ERP across the Middle East, Africa and South East Asia.",
  path: "/about",
});

const COMPANY_LINKS = [
  { icon: Users, label: "Our leadership", text: "Meet the team leading Azentio.", href: AZENTIO.leadership },
  { icon: MapPin, label: "Our presence", text: "Where Azentio operates.", href: AZENTIO.presence },
  { icon: Building2, label: "About Azentio", text: "The company behind azentio.ai.", href: AZENTIO.about },
  { icon: Globe, label: "Contact Azentio", text: "Corporate contact details.", href: AZENTIO.contact },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Azentio, and the intelligence behind azentio.ai."
        description={<p>{COMPANY_DESCRIPTION}</p>}
        art="network"
      >
        <CtaLink href={AZENTIO.home} variant="outline-dark" external>
          Visit azentio.com
        </CtaLink>
      </PageHero>

      <section aria-labelledby="what-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeader id="what-heading" eyebrow="azentio.ai" title={WHO_WE_ARE.title}>
            <div className="flex flex-col gap-4 text-base text-muted-foreground sm:text-lg">
              {WHO_WE_ARE.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </SectionHeader>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-brand-light p-6">
              <h3 className="text-lg font-semibold text-brand-ink">Two experiences, one platform</h3>
              <ul className="mt-4 flex flex-col gap-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Globe aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>
                    <strong className="font-semibold text-brand-ink">This public website</strong> — products, solutions,
                    approved media, insights, demo requests and hackathon registration.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>
                    <strong className="font-semibold text-brand-ink">The secure portal</strong> — private workspaces for
                    invited clients and approved employees: projects, the Playground, live sessions and governed collective
                    learning.
                  </span>
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <CtaLink href="/technology" variant="navy" size="md">
                  How it&apos;s built
                </CtaLink>
                <CtaLink href="/login" variant="outline-light" size="md" arrow={false}>
                  Sign in
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="industries-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-8">
            <SectionHeader id="industries-heading" eyebrow="Industries" title="Where Azentio works." />
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-6">
              <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                <MapPin aria-hidden="true" className="size-4 text-success" />
                Regions
              </p>
              <p className="text-sm text-muted-foreground">{REGIONS_LINE}.</p>
              <ul className="flex flex-wrap gap-1.5">
                {REGIONS_SERVED.map((r) => (
                  <li key={r} className="rounded-md border border-border bg-brand-light px-2 py-1 text-xs text-brand-ink">
                    {r}
                  </li>
                ))}
              </ul>
              <ExternalLink href={AZENTIO.presence} className="text-sm text-brand-navy">
                Our presence on azentio.com
              </ExternalLink>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <li key={ind.slug}>
                <Link
                  href={`/solutions/${ind.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-white p-5 transition-colors hover:border-brand-green/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="font-heading text-base font-semibold text-brand-ink">{ind.name}</span>
                  <span className="text-sm text-muted-foreground">{ind.tagline}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-navy">
                    Explore
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="recognition-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="recognition-heading"
            eyebrow="Recognition"
            title="2026 recognitions."
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
        </div>
      </section>

      <section aria-labelledby="company-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          <SectionHeader id="company-heading" eyebrow="Azentio" title="More about the company." />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COMPANY_LINKS.map(({ icon: Icon, label, text, href }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-5 transition-colors hover:border-brand-green/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Icon aria-hidden="true" className="size-5 text-success" />
                  <span className="font-heading text-base font-semibold text-brand-ink">{label}</span>
                  <span className="text-sm text-muted-foreground">{text}</span>
                  <span className="mt-auto text-xs text-brand-muted">
                    azentio.com<span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Looking for a role?{" "}
            <Link href="/careers" className="font-semibold text-brand-navy hover:underline">
              Careers at Azentio
            </Link>
          </p>
        </div>
      </section>

      <CTASection />
    </>
  );
}
