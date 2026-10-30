import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, GitCompare, ShieldCheck } from "lucide-react";
import { moderatorPageActor } from "@/server/learning/guard";
import { OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import { moderationQueue } from "@/server/services/moderation";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Chip } from "@/components/portal/learning/badges";
import { formatDateTime, fromNow } from "@/components/portal/learning/format";
import { ModerationNav } from "@/components/portal/learning/moderation-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation" };

export default async function ModerationQueuePage() {
  const actor = await moderatorPageActor();
  const { items, openReports } = await moderationQueue(actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Learning moderation"
        title="Submission queue"
        description="Contributions proposed for community sharing, oldest first. You see private sources only once they are submitted — never unsubmitted drafts."
      />
      <ModerationNav active="queue" queue={items.length} reports={openReports} />
      <Notice>
        Publish only a redacted, de-identified shared copy. Public reasons are shown to the contributor; internal notes stay with moderators. You
        cannot review your own contributions.
      </Notice>

      {items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="The queue is empty" description="No contributions are waiting for review." />
      ) : (
        <ol className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide text-brand-ink">{OBSERVATION_TYPE_LABELS[item.type]}</span>
                <span>v{item.version}</span>
                {item.isAmendment && (
                  <Chip tone="info">
                    <GitCompare className="size-3" aria-hidden /> Amendment to a published copy
                  </Chip>
                )}
                {item.flagCount > 0 && (
                  <Chip tone="warning">
                    <AlertTriangle className="size-3" aria-hidden /> {item.flagCount} scan flag{item.flagCount === 1 ? "" : "s"}
                  </Chip>
                )}
                {item.ownContribution && <Chip>Your contribution — another moderator must review</Chip>}
              </div>
              <h2 className="mt-1.5 font-semibold text-brand-ink">
                <Link href={`/portal/moderation/${item.id}`} className="hover:underline focus-visible:underline focus-visible:outline-none">
                  {item.title}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.organisationName} · {item.region}
                {item.offering && <> · {item.offering}</>} · submitted <time dateTime={item.submittedAt} title={formatDateTime(item.submittedAt)}>{fromNow(item.submittedAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
