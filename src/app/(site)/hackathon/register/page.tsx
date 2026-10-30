import { CalendarDays, LockKeyhole, Trophy, Users } from "lucide-react";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { EmptyState } from "@/components/site/empty-state";
import { formatDateRange, formatDateShort, isoDate } from "@/components/site/format";
import { HackathonForm } from "@/components/site/forms/hackathon-form";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";
import { listOpenHackathonEvents } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Hackathons",
  description: "Register interest in an open azentio.ai hackathon — for employees, clients, partners and students.",
  path: "/hackathon/register",
});

type Props = { searchParams: Promise<{ event?: string | string[] }> };

export default async function HackathonRegisterPage({ searchParams }: Props) {
  const [{ event }, events] = await Promise.all([searchParams, listOpenHackathonEvents()]);
  const requested = Array.isArray(event) ? event[0] : event;
  const preselected = events.find((e) => e.slug === requested || e.id === requested)?.id;

  return (
    <>
      <PageHero
        eyebrow="Hackathons"
        title="Build what's next, together."
        description={
          <p>
            Innovation challenges and working sessions where employees, clients, partners and students turn ambitious
            ideas into working prototypes. Register your interest in an open hackathon below.
          </p>
        }
        art="orbit"
      />

      <section aria-labelledby="events-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          <SectionHeader id="events-heading" eyebrow="Open for registration" title="Current hackathons" />
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hackathon is open for registration right now"
              description="New hackathons are listed here as soon as registration opens. Meanwhile, explore the AI Lab or tell us about an idea."
            >
              <CtaLink href="/lab" variant="navy" size="md">
                Visit the AI Lab
              </CtaLink>
              <CtaLink href="/connect" variant="outline-light" size="md" arrow={false}>
                Start a conversation
              </CtaLink>
            </EmptyState>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {events.map((e) => (
                <li key={e.id}>
                  <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-success">
                      <Trophy aria-hidden="true" className="size-4" />
                      <span>
                        <time dateTime={isoDate(e.startsAt)}>{formatDateShort(e.startsAt)}</time>
                        {formatDateShort(e.startsAt) !== formatDateShort(e.endsAt) ? (
                          <>
                            {" – "}
                            <time dateTime={isoDate(e.endsAt)}>{formatDateShort(e.endsAt)}</time>
                          </>
                        ) : null}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-brand-ink">{e.name}</h3>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{e.description}</p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {events.length ? (
        <section aria-labelledby="register-heading" className="bg-brand-light py-16 sm:py-20">
          <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
            <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
              <h2 id="register-heading" className="mb-6 text-2xl font-semibold text-brand-ink">
                Register your interest
              </h2>
              <HackathonForm
                defaultEventId={preselected}
                events={events.map((e) => ({ id: e.id, name: e.name, dates: formatDateRange(e.startsAt, e.endsAt) }))}
              />
            </div>
            <aside aria-label="About registration" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-6 text-sm">
                <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                  <Users aria-hidden="true" className="size-4 text-success" />
                  How registration works
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground marker:text-success">
                  <li>One registration per email address for each hackathon.</li>
                  <li>Registrations are reviewed by the organisers in the azentio.ai portal.</li>
                  <li>No automatic email is sent; you get a reference on screen.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-6 text-sm">
                <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                  <LockKeyhole aria-hidden="true" className="size-4 text-success" />
                  Azentio employees
                </p>
                <p className="text-muted-foreground">After registering, sign in to the portal to form or join a team.</p>
                <CtaLink href="/login" variant="outline-light" size="md" className="w-fit">
                  Sign in
                </CtaLink>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <CTASection secondary={{ label: "Visit the AI Lab", href: "/lab" }} />
    </>
  );
}
