import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { learningPageActor, orNotFound } from "@/server/learning/guard";
import {
  CONFIDENCE_LABELS,
  EVIDENCE_TYPE_LABELS,
  industryLabel,
  OBSERVATION_STATUS_LABELS,
  OBSERVATION_TYPE_LABELS,
} from "@/server/learning/labels";
import { getObservationDetail } from "@/server/services/observations";
import { Button } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/portal/page";
import { ObservationStatusBadge, PrivateBadge } from "@/components/portal/learning/badges";
import { formatDate } from "@/components/portal/learning/format";
import { HighlightedText, SensitiveFlagList } from "@/components/portal/learning/sensitive-flags";
import { ObservationActions } from "@/components/portal/learning/observation-actions";
import { DECISION_LABELS, ObservationTimeline, VisibilityPanel } from "@/components/portal/learning/observation-panels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Observation" };

export default async function ObservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await learningPageActor();
  const o = await orNotFound(getObservationDetail(actor, id));
  const author = o.author;
  const flags = author?.sensitiveFlags ?? [];
  const latestDecision = author?.decisions.at(-1);
  const liveCopy = author?.sharedCopies.find((s) => s.status === "PUBLISHED" || s.status === "SUSPENDED");
  const latestConsent = author?.consents.filter((c) => c.publishSharedVersion).at(-1);

  const meta: [string, React.ReactNode][] = [
    ["Type", OBSERVATION_TYPE_LABELS[o.type]],
    ["Offering", o.offering?.name ?? "Not specific to an offering"],
    ["Industry", industryLabel(o.industry)],
    ["Region", o.region],
    ["Observation period", `${formatDate(o.periodStart)} – ${formatDate(o.periodEnd)}`],
    ["Evidence", EVIDENCE_TYPE_LABELS[o.evidenceType]],
    ["Confidence", CONFIDENCE_LABELS[o.confidence]],
    ["Version", `v${o.version}`],
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`${o.organisationName} · ${o.viewerRole === "author" ? "your contribution" : `by ${o.authorName}`}`}
        title={o.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ObservationStatusBadge status={o.status} />
            <span>Updated {formatDate(o.updatedAt)}</span>
          </span>
        }
        actions={<PrivateBadge />}
      />

      {o.viewerRole === "moderator" && (
        <Notice title="You are viewing a submitted private source as a learning moderator">
          Review and publishing decisions happen in the moderation workspace.{" "}
          <Link className="underline" href={`/portal/moderation/${o.id}`}>
            Open the review
          </Link>
        </Notice>
      )}
      {o.viewerRole === "org_member" && (
        <Notice>
          {o.authorName} shared this observation within {o.organisationName}. It is read-only and is not visible to other organisations.
        </Notice>
      )}
      {o.viewerRole === "support" && (
        <Notice tone="warning" title="Support access">
          You are viewing this private source under a time-boxed support-access grant. Access is audited.
        </Notice>
      )}

      {author && o.status === "RETURNED" && latestDecision?.action === "RETURN_FOR_CLARIFICATION" && (
        <Notice tone="warning" title="A moderator asked for clarification">
          <span className="whitespace-pre-wrap">{latestDecision.publicReason}</span>
        </Notice>
      )}
      {author && (o.status === "REJECTED" || o.status === "SUSPENDED") && latestDecision && (
        <Notice tone="warning" title={DECISION_LABELS[latestDecision.action]}>
          <span className="whitespace-pre-wrap">{latestDecision.publicReason}</span>
        </Notice>
      )}
      {author && o.status === "SUBMITTED" && liveCopy && (
        <Notice>
          Version {o.version} is awaiting review. Your previously approved shared copy (v{liveCopy.version}) stays visible unchanged until a moderator
          publishes the new version.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          <section className="rounded-lg border border-l-4 border-l-brand-navy bg-card p-5" aria-label="Private source">
            <p className="eyebrow !text-brand-navy">Private source</p>
            <div className="mt-3 text-sm leading-relaxed text-brand-ink">
              <HighlightedText text={o.body} flags={flags} field="body" />
            </div>
            {o.topics.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
                {o.topics.map((t) => (
                  <li key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs text-brand-ink">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
              {meta.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-brand-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {o.links.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium">Supporting links (private — never copied to the shared version)</p>
                <ul className="mt-1.5 grid gap-1 text-sm">
                  {o.links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-brand-ink underline">
                        {l} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {author && (
            <VisibilityPanel
              status={o.status}
              orgVisible={o.orgVisible}
              organisationName={o.organisationName}
              submittedAt={o.submittedAt}
              versions={author.versions}
              consents={author.consents}
              sharedCopies={author.sharedCopies}
            />
          )}
        </div>

        <aside className="grid content-start gap-4">
          {author ? (
            <>
              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold text-brand-ink">Actions</h2>
                <p className="mt-1 text-xs text-muted-foreground">Status: {OBSERVATION_STATUS_LABELS[o.status]}</p>
                <div className="mt-3">
                  <ObservationActions
                    id={o.id}
                    actions={author.actions}
                    orgVisible={o.orgVisible}
                    organisationName={o.organisationName}
                    hasSharedCopy={Boolean(liveCopy)}
                    consentDefaults={latestConsent ? { attributeOrganisation: latestConsent.attributeOrganisation, futureTraining: latestConsent.futureTraining } : null}
                  />
                </div>
              </section>
              <section className="rounded-lg border bg-card p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                  <ShieldCheck className="size-4" aria-hidden /> Automated scan
                </h2>
                <SensitiveFlagList flags={flags} audience="author" className="mt-2" />
              </section>
              <ObservationTimeline createdAt={o.createdAt} versions={author.versions} decisions={author.decisions} consents={author.consents} />
            </>
          ) : (
            <Button asChild variant="outline">
              <Link href="/portal/observations?tab=org">Back to organisation observations</Link>
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
