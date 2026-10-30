import { Briefcase, GraduationCap, Sparkles, Trophy, Users } from "lucide-react";
import { AZENTIO, CAREERS_INTRO } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { ExternalLink } from "@/components/site/external-link";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Careers",
  description: "Careers at Azentio: current openings, Azentio academy and the talent community are on azentio.com.",
  path: "/careers",
});

const PATHS = [
  {
    icon: Briefcase,
    title: "Current openings",
    text: "Open positions are published and kept up to date on Azentio's corporate careers page.",
    href: AZENTIO.careers,
    cta: "View careers on azentio.com",
  },
  {
    icon: GraduationCap,
    title: "Azentio academy",
    text: "Learning and talent-transformation programmes run by Azentio.",
    href: AZENTIO.academy,
    cta: "Explore Azentio academy",
  },
  {
    icon: Users,
    title: "Talent community",
    text: "Get updates on job opportunities, news, open positions and recruiting events.",
    href: AZENTIO.talentCommunity,
    cta: "Join the talent community",
  },
  {
    icon: Sparkles,
    title: "Internships",
    text: "Azestar, Azentio's flagship internship programme, gives students hands-on work with the latest technologies.",
    href: AZENTIO.careers,
    cta: "About Azestar on azentio.com",
  },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="Careers"
        title="Shape the future with Azentio."
        description={
          <p>
            {CAREERS_INTRO}{" "}
            <span className="text-slate-400">— azentio.com/careers</span>
          </p>
        }
      >
        <CtaLink href={AZENTIO.careers} variant="green" external>
          Current openings
        </CtaLink>
      </PageHero>

      <section aria-labelledby="paths-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="paths-heading"
            eyebrow="Join Azentio"
            title="Roles are listed on azentio.com."
            description="azentio.ai does not host job listings, so you always see the current, official openings."
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PATHS.map(({ icon: Icon, title, text, href, cta }) => (
              <li key={title}>
                <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-6">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-brand-navy text-brand-green">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-xl font-semibold text-brand-ink">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                  <ExternalLink href={href} className="mt-auto text-sm text-brand-navy">
                    {cta}
                  </ExternalLink>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="build-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page grid gap-8 rounded-lg lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <SectionHeader
            id="build-heading"
            eyebrow="Build with us"
            title="Want to see how we work first?"
            description="Register interest in an open azentio.ai hackathon — students, partners, clients and employees are all welcome to apply."
          />
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6">
            <Trophy aria-hidden="true" className="size-6 text-success" />
            <p className="text-sm text-muted-foreground">
              Hackathons are listed when registration is open. If none is open right now, check back or follow Azentio on
              social media for announcements.
            </p>
            <div className="flex flex-wrap gap-2">
              <CtaLink href="/hackathon/register" variant="navy" size="md">
                Hackathons
              </CtaLink>
              <CtaLink href="/lab" variant="outline-light" size="md" arrow={false}>
                AI Lab
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="Not a job enquiry?"
        title="Talk to us about azentio.ai."
        primary={{ label: "Start a Conversation", href: "/connect" }}
      />
    </>
  );
}
