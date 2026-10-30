import { CirclePlay, Radio } from "lucide-react";
import { MEDIA_TEASER, YOUTUBE_CHANNEL } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { CtaLink } from "@/components/site/cta-link";
import { EmptyState } from "@/components/site/empty-state";
import { ExternalLink } from "@/components/site/external-link";
import { hostLabel, safeExternalUrl, toVideoEmbed } from "@/components/site/embed";
import { formatDate, isoDate } from "@/components/site/format";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { VideoPlayer } from "@/components/site/video-player";
import { pageMetadata } from "@/components/site/seo";
import { listPublicMedia } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Media & videos",
  description: "Approved azentio.ai product showcases and videos, plus Azentio's official YouTube channel.",
  path: "/media",
});

export default async function MediaPage() {
  const rows = await listPublicMedia();
  // Only items with a safe embed or a safe https link are shown.
  const media = rows
    .map((m) => {
      const embed = toVideoEmbed(m.url);
      return { ...m, embed, link: embed ? null : safeExternalUrl(m.url) };
    })
    .filter((m) => m.embed || m.link);

  return (
    <>
      <PageHero
        eyebrow={MEDIA_TEASER.eyebrow}
        title={
          <>
            {MEDIA_TEASER.title} <span className="text-brand-green">{MEDIA_TEASER.emphasis}</span>
          </>
        }
        description={<p>{MEDIA_TEASER.description}</p>}
      >
        <CtaLink href={YOUTUBE_CHANNEL} variant="outline-dark" external>
          Azentio on YouTube
        </CtaLink>
      </PageHero>

      <section aria-labelledby="videos-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="videos-heading"
            eyebrow="Media & videos"
            title="Product showcases"
            description="Videos approved for public viewing. Players load from YouTube or Vimeo only when you press play."
          />

          {media.length === 0 ? (
            <EmptyState
              icon={CirclePlay}
              title="No videos have been published here yet."
              description="When the team publishes a public video it will appear on this page. In the meantime, Azentio's official channel has product and company videos."
            >
              <CtaLink href={YOUTUBE_CHANNEL} variant="navy" size="md" external>
                Visit Azentio on YouTube
              </CtaLink>
              <CtaLink href="/live" variant="outline-light" size="md">
                azentio.ai Live
              </CtaLink>
            </EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {media.map(({ embed, link, ...m }) => {
                return (
                  <li key={m.id}>
                    <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-white p-4">
                      {embed ? (
                        <VideoPlayer embed={embed} title={m.title} />
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-lg bg-brand-navy text-slate-300">
                          <CirclePlay aria-hidden="true" className="size-8 text-brand-green" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
                        <h3 className="text-lg font-semibold text-brand-ink">{m.title}</h3>
                        <p className="text-sm text-muted-foreground">{m.description}</p>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-brand-muted">
                          <time dateTime={isoDate(m.createdAt)}>{formatDate(m.createdAt)}</time>
                          {link ? (
                            <ExternalLink href={link} className="text-sm text-brand-navy">
                              Watch on {hostLabel(link)}
                            </ExternalLink>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Radio aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-heading font-semibold text-brand-ink">More from Azentio</p>
                <p className="text-sm text-muted-foreground">
                  Company news, product videos and events on the official channel:{" "}
                  <ExternalLink href={YOUTUBE_CHANNEL} className="text-brand-navy">
                    youtube.com/@azentiosoftware
                  </ExternalLink>
                </p>
              </div>
            </div>
            <CtaLink href="/live" variant="outline-light" size="md">
              Live sessions
            </CtaLink>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
