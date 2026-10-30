import { CalendarDays, CirclePlay, LockKeyhole, Radio } from "lucide-react";
import { IDEAS_IN_MOTION, YOUTUBE_CHANNEL } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { EmptyState } from "@/components/site/empty-state";
import { ExternalLink } from "@/components/site/external-link";
import { hostLabel, safeExternalUrl, toVideoEmbed } from "@/components/site/embed";
import { formatDateShort, formatDateTime, isoDate } from "@/components/site/format";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { VideoPlayer } from "@/components/site/video-player";
import { pageMetadata } from "@/components/site/seo";
import { listPublicLiveSessions, type PublicLiveSession } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "azentio.ai Live",
  description: "Public azentio.ai Live sessions — upcoming conversations and recordings open to everyone.",
  path: "/live",
});

const liveCard = IDEAS_IN_MOTION.cards.find((c) => c.href === "/live");

function SessionMedia({ session, url }: { session: PublicLiveSession; url: string | null }) {
  const embed = toVideoEmbed(url);
  if (embed) return <VideoPlayer embed={embed} title={session.title} />;
  const link = safeExternalUrl(url);
  return link ? (
    <ExternalLink href={link} className="text-sm text-brand-navy">
      Open on {hostLabel(link)}
    </ExternalLink>
  ) : null;
}

export default async function LivePage() {
  const { upcoming, recordings } = await listPublicLiveSessions();

  return (
    <>
      <PageHero
        eyebrow="azentio.ai Live"
        title={liveCard?.title ?? "Conversations Where Intelligence Comes Alive."}
        description={<p>Live sessions open to everyone, and recordings once they are published.</p>}
      >
        <CtaLink href="/portal/live" variant="outline-dark">
          Employee &amp; client sessions
        </CtaLink>
      </PageHero>

      <section aria-labelledby="upcoming-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          <SectionHeader id="upcoming-heading" eyebrow="Schedule" title="Live now and upcoming" />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No public sessions are scheduled right now."
              description="New public sessions will be listed here as soon as they are scheduled."
            />
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {upcoming.map((s) => {
                const isLive = s.status === "LIVE";
                return (
                  <li key={s.id}>
                    <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                            Live now
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-success">
                            Scheduled
                          </span>
                        )}
                        <time dateTime={isoDate(s.startsAt)} className="text-sm font-medium text-brand-ink">
                          {formatDateTime(s.startsAt)}
                        </time>
                      </div>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xl font-semibold text-brand-ink">{s.title}</h3>
                        <p className="text-sm whitespace-pre-line text-muted-foreground">{s.description}</p>
                      </div>
                      {isLive ? (
                        <SessionMedia session={s} url={s.streamUrl} />
                      ) : s.streamUrl ? (
                        <p className="text-xs text-brand-muted">The stream link will be available here when the session starts.</p>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="recordings-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          <SectionHeader id="recordings-heading" eyebrow="On demand" title="Recordings" />
          {recordings.length === 0 ? (
            <EmptyState
              icon={CirclePlay}
              title="No recordings have been published yet."
              description="Recordings of public sessions appear here after they end."
            >
              <CtaLink href={YOUTUBE_CHANNEL} variant="outline-light" size="md" external>
                Azentio on YouTube
              </CtaLink>
            </EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recordings.map((s) => (
                <li key={s.id}>
                  <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-4">
                    <SessionMedia session={s} url={s.recordingUrl} />
                    <div className="flex flex-col gap-2 px-1 pb-1">
                      <time dateTime={isoDate(s.startsAt)} className="text-xs font-medium text-brand-muted">
                        Recorded {formatDateShort(s.startsAt)}
                      </time>
                      <h3 className="text-lg font-semibold text-brand-ink">{s.title}</h3>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-heading font-semibold text-brand-ink">Employee and client sessions</p>
                <p className="text-sm text-muted-foreground">
                  Briefings for employees or for client organisations are never listed here. They are available in the
                  portal after you sign in.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CtaLink href="/login" variant="navy" size="md">
                Sign in
              </CtaLink>
              <CtaLink href="/portal/live" variant="outline-light" size="md" arrow={false}>
                <Radio aria-hidden="true" />
                Portal live sessions
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
