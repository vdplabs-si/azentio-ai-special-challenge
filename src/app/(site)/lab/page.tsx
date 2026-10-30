import Link from "next/link";
import { Beaker, Database, FlaskConical, LockKeyhole, Trophy, UserCheck } from "lucide-react";
import { AI_OFFERINGS } from "@/content/catalogue";
import { LAB } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "AI Lab",
  description:
    "The azentio.ai AI Lab: rapid prototyping, a Playground with synthetic data, tracked experiments and hackathons for employees, clients and partners.",
  path: "/lab",
});

const PORTAL_AREAS = [
  {
    icon: FlaskConical,
    title: "Playground",
    who: "Employees, and client workspaces entitled to an offering",
    text: "Guided scenarios for azentio.ai offerings that run on synthetic data only — never customer data — so teams can see how a recommendation is formed and share feedback on it.",
  },
  {
    icon: Beaker,
    title: "Experiments",
    who: "Azentio employees",
    text: "Employees submit experiments with a hypothesis and an approach, optionally linked to an offering. Each one is reviewed, then accepted or archived with feedback.",
  },
  {
    icon: Trophy,
    title: "Hackathons",
    who: "Registration is open to everyone; teams work in the portal",
    text: "Anyone can register interest in an open hackathon on this site. Employee teams are organised as projects in the portal.",
  },
];

export default function LabPage() {
  const sandbox = AI_OFFERINGS.filter((o) => o.sandbox);
  return (
    <>
      <PageHero eyebrow={LAB.eyebrow} title={LAB.title} description={<p>{LAB.lead}</p>} art="orbit">
        <CtaLink href="/login" variant="green">
          Sign in to the portal
        </CtaLink>
        <CtaLink href="/hackathon/register" variant="outline-dark">
          Join a hackathon
        </CtaLink>
      </PageHero>

      <section aria-labelledby="inside-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader id="inside-heading" eyebrow="Inside the lab" title="How ideas become working intelligence." />
          <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {LAB.pillars.map((p, i) => (
              <li key={p.title} className="flex flex-col gap-3 bg-white p-6">
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

      <section aria-labelledby="portal-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="portal-heading"
            eyebrow="In the azentio.ai portal"
            title="What employees and clients do after signing in."
            description="The Lab's hands-on spaces live in the secure portal, not on this public site."
          />
          <ul className="grid gap-5 lg:grid-cols-3">
            {PORTAL_AREAS.map(({ icon: Icon, title, who, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 0.05} className="h-full">
                  <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-6">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-brand-navy text-brand-green">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-semibold text-brand-ink">{title}</h3>
                      <p className="text-xs font-medium text-success">{who}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>

          <div className="grid gap-6 rounded-lg border border-border bg-white p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-brand-ink">
                <Database aria-hidden="true" className="size-5 text-success" />
                Playground scenarios
              </h3>
              <p className="text-sm text-muted-foreground">
                Scenarios exist for these offerings. Results are illustrative and generated from synthetic data.
              </p>
              <ul className="flex flex-wrap gap-2">
                {sandbox.map((o) => (
                  <li key={o.slug}>
                    <Link
                      href={`/products/${o.slug}`}
                      className="inline-flex rounded-md border border-border bg-brand-light px-2.5 py-1.5 text-sm text-brand-ink hover:border-brand-green/60"
                    >
                      {o.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-brand-light p-5 text-sm">
              <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                <LockKeyhole aria-hidden="true" className="size-4 text-success" />
                Who can get in
              </p>
              <ul className="flex flex-col gap-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <UserCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-navy" />
                  Employees: verified Azentio email, approved by an organiser.
                </li>
                <li className="flex items-start gap-2">
                  <UserCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-navy" />
                  Clients: by invitation to their organisation&apos;s workspace.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-2">
                <CtaLink href="/login" variant="navy" size="md">
                  Sign in
                </CtaLink>
                <CtaLink href="/portal/playground" variant="outline-light" size="md" arrow={false}>
                  Open the Playground
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection secondary={{ label: "Register for a hackathon", href: "/hackathon/register" }} />
    </>
  );
}
