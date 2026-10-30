import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppError } from "@/lib/api/errors";
import { learningPageActor } from "@/server/learning/guard";
import { getSharedDetail } from "@/server/services/shared-feed";
import { CONFIDENCE_LABELS, EVIDENCE_TYPE_LABELS, industryLabel, OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import { Notice, PageHeader } from "@/components/portal/page";
import { SharedBadge } from "@/components/portal/learning/badges";
import { formatDate } from "@/components/portal/learning/format";
import { SharedFeedback } from "@/components/portal/learning/shared-feedback";
import { BookmarkButton } from "@/components/portal/learning/bookmark-button";
import { SharedReportDialog } from "@/components/portal/learning/shared-report-dialog";
import { SharedComments } from "@/components/portal/learning/shared-comments";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared contribution" };

async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}

export default async function SharedContributionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await learningPageActor();
  const { id } = await params;
  const detail = await orNotFound(getSharedDetail(actor, id));
  const item = detail.item;

  const meta: [string, string][] = [
    ["Type", OBSERVATION_TYPE_LABELS[item.type]],
    ["Offering", item.offering?.name ?? "Not specified"],
    ["Industry", industryLabel(item.industry)],
    ["Region", item.region],
    ["Observation period", item.periodLabel],
    ["Evidence", EVIDENCE_TYPE_LABELS[item.evidenceType]],
    ["Confidence", CONFIDENCE_LABELS[item.confidence]],
    ["Attribution", item.attributionLabel ?? "Unattributed"],
    ["Published", formatDate(item.publishedAt)],
    ["Last updated", formatDate(item.updatedAt)],
  ];

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/portal/learning">
            <ArrowLeft aria-hidden /> Shared learning
          </Link>
        </Button>
      </div>
      <div className="border-t-4 border-t-brand-green pt-4">
        <PageHeader eyebrow={OBSERVATION_TYPE_LABELS[item.type]} title={item.title} actions={<SharedBadge />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid content-start gap-6">
          <article className="rounded-lg border border-l-4 border-l-brand-green bg-card p-5">
            <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-brand-ink">{item.body}</p>
            {item.topics.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
                {item.topics.map((t) => (
                  <li key={t}>
                    <Link
                      href={`/portal/learning?topic=${encodeURIComponent(t)}`}
                      className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-brand-ink hover:underline"
                    >
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2">
            {meta.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-brand-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <Notice title="About this shared copy">
            A moderator reviewed this de-identified copy before publication: geography is coarsened to a broad region and the period to a
            half-year. It describes one participant&apos;s observation — it is not a measure of market prevalence and does not establish
            causation. If the contributor withdraws it, it disappears from the feed, search, exports and AIRA immediately.
          </Notice>

          <SharedComments id={item.id} comments={detail.comments} canModerate={detail.canModerate} />
        </div>

        <aside className="grid content-start gap-4">
          <div className="grid gap-4 rounded-lg border bg-card p-4">
            <SharedFeedback id={item.id} counts={detail.feedback.counts} mine={detail.feedback.mine} />
          </div>
          <div className="grid gap-2 rounded-lg border bg-card p-4">
            <BookmarkButton sharedObservationId={item.id} bookmarkId={detail.bookmarkId} />
            <SharedReportDialog id={item.id} hasOpenReport={detail.hasOpenReport} />
          </div>
        </aside>
      </div>
    </div>
  );
}
