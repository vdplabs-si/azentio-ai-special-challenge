import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Pencil } from "lucide-react";
import { AppError } from "@/lib/api/errors";
import { learningPageActor } from "@/server/learning/guard";
import { getIdea } from "@/server/services/ideas";
import { IDEA_STATUS_LABELS, IDEA_VISIBILITY_LABELS, PRIORITY_LABELS } from "@/server/learning/labels";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Chip, IdeaStatusBadge } from "@/components/portal/learning/badges";
import { SharedCard } from "@/components/portal/learning/shared-card";
import { formatDate, formatDateTime } from "@/components/portal/learning/format";
import { IdeaStatusForm } from "@/components/portal/learning/idea-status-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Improvement idea" };

async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-brand-ink">{children}</dd>
    </div>
  );
}

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await learningPageActor();
  const { id } = await params;
  const data = await orNotFound(getIdea(actor, id));

  const back = (
    <div>
      <Button asChild variant="ghost" size="sm">
        <Link href="/portal/ideas">
          <ArrowLeft aria-hidden /> Improvement ideas
        </Link>
      </Button>
    </div>
  );

  if (data.audience === "participant") {
    const idea = data.idea;
    return (
      <div className="grid gap-6">
        {back}
        <PageHeader eyebrow="Improvement idea" title={idea.title} actions={<IdeaStatusBadge status={idea.status} />} />
        <section className="grid gap-4 rounded-lg border bg-card p-5">
          <div>
            <p className="font-medium text-brand-ink">{idea.statusLabel}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{idea.statusExplanation}</p>
          </div>
          {idea.publicStatusNote && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest update from the product team</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink">{idea.publicStatusNote}</p>
            </div>
          )}
          <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <Field label="Offering">{idea.offering.name}</Field>
            <Field label="Owner">
              {idea.ownerName} · {idea.team}
            </Field>
            <Field label="Theme">{idea.themeTitle ?? "—"}</Field>
            <Field label="Last update">{formatDate(idea.updatedAt)}</Field>
          </dl>
        </section>
        <Notice>
          Statuses describe the product team&apos;s current thinking. “{IDEA_STATUS_LABELS.UNDER_REVIEW}” is not a delivery commitment, and plans
          can change.
        </Notice>
      </div>
    );
  }

  const idea = data.idea;
  return (
    <div className="grid gap-6">
      {back}
      <PageHeader
        eyebrow="Improvement idea"
        title={idea.title}
        actions={
          <>
            <IdeaStatusBadge status={idea.status} />
            <Chip tone={idea.visibility === "INTERNAL" ? "neutral" : "success"}>{IDEA_VISIBILITY_LABELS[idea.visibility]}</Chip>
            {data.canManage && (
              <Button asChild variant="outline">
                <Link href={`/portal/ideas/${idea.id}/edit`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          <section className="grid gap-4 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problem statement</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink">{idea.problemStatement}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed outcome</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink">{idea.proposedOutcome}</p>
            </div>
            <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <Field label="Offering">{idea.offering.name}</Field>
              <Field label="Owner">
                {idea.ownerName} · {idea.team}
              </Field>
              <Field label="Theme">
                {idea.theme ? (
                  <Link href={`/portal/themes/${idea.theme.id}`} className="hover:underline">
                    {idea.theme.title}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Priority (internal)">{PRIORITY_LABELS[idea.priority]}</Field>
              <Field label="Created">
                {formatDate(idea.createdAt)} by {idea.createdBy}
              </Field>
              <Field label="Last update">{formatDate(idea.updatedAt)}</Field>
            </dl>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Public status note</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink">{idea.publicStatusNote || "No public note yet."}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {idea.visibility === "SHARED_WITH_PARTICIPANTS" ? "Visible to participants." : "Not visible outside Azentio while the idea is internal."}
            </p>
          </section>

          <section className="rounded-lg border border-brand-navy/20 bg-brand-light p-5">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-navy">
              <Lock className="size-3.5" aria-hidden /> Internal notes — never shown to clients
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink">{idea.internalNotes || "No internal notes."}</p>
          </section>

          <section aria-labelledby="idea-evidence-h" className="grid gap-3">
            <h2 id="idea-evidence-h" className="text-lg font-semibold text-brand-ink">
              Supporting contributions
            </h2>
            {idea.evidence.length === 0 ? (
              <EmptyState title="No published evidence linked" description="Linked contributions that are withdrawn or unpublished no longer appear here." />
            ) : (
              idea.evidence.map((e) => <SharedCard key={e.id} item={e} compact />)
            )}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          {data.canManage && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-ink">Change status</h2>
              <IdeaStatusForm key={idea.status} ideaId={idea.id} current={idea.status} publicStatusNote={idea.publicStatusNote} visibility={idea.visibility} />
            </section>
          )}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold text-brand-ink">Status history</h2>
            {idea.statusChanges.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No status changes recorded.</p>
            ) : (
              <ol className="mt-3 grid gap-3 border-l pl-4">
                {idea.statusChanges.map((s) => (
                  <li key={s.id} className="relative text-sm">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-brand-navy" aria-hidden />
                    <p className="text-brand-ink">
                      {s.fromStatus ? `${IDEA_STATUS_LABELS[s.fromStatus]} → ` : ""}
                      <span className="font-medium">{IDEA_STATUS_LABELS[s.toStatus]}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)} · {s.changedBy}
                    </p>
                    {s.note && <p className="mt-1 whitespace-pre-wrap text-xs text-brand-ink">{s.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
