import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, MapPin, Minus } from "lucide-react";
import { moderatorPageActor, orNotFound } from "@/server/learning/guard";
import {
  CONFIDENCE_LABELS,
  EVIDENCE_TYPE_LABELS,
  industryLabel,
  OBSERVATION_TYPE_LABELS,
  REPORT_REASON_LABELS,
} from "@/server/learning/labels";
import { getReview } from "@/server/services/moderation";
import { Button } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/portal/page";
import { ObservationStatusBadge, SharedStatusBadge } from "@/components/portal/learning/badges";
import { formatDate, formatDateTime } from "@/components/portal/learning/format";
import { HighlightedText, SensitiveFlagList } from "@/components/portal/learning/sensitive-flags";
import { ModerationReview } from "@/components/portal/learning/moderation-review";
import { DECISION_LABELS } from "@/components/portal/learning/observation-panels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review contribution" };

const Flag = ({ on, label }: { on: boolean; label: string }) => (
  <li className="flex items-center gap-2">
    {on ? <Check className="size-4 text-success" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
    <span>
      {label}: <strong>{on ? "Yes" : "No"}</strong>
    </span>
  </li>
);

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await moderatorPageActor();
  const r = await orNotFound(getReview(actor, id));
  const s = r.source;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`Moderation · version ${s.version}`}
        title="Review contribution"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ObservationStatusBadge status={s.status} /> Submitted {formatDateTime(s.submittedAt)} by a member of {s.organisationName}
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/portal/moderation">Back to queue</Link>
          </Button>
        }
      />

      {r.ownContribution && (
        <Notice tone="warning" title="This is your own contribution">
          Another moderator must review it. You can view it, but you cannot make a decision.
        </Notice>
      )}
      {!r.canDecide && !r.ownContribution && (
        <Notice>No decision is pending — this contribution is {s.status.toLowerCase()}. The history below is read-only.</Notice>
      )}
      {r.liveCopy && s.status === "SUBMITTED" && (
        <Notice title={`Amendment to published version ${r.liveCopy.version}`}>
          The currently published copy stays visible until you publish this version (which supersedes it). Declining keeps the published copy as-is.
        </Notice>
      )}
      {r.openReports.length > 0 && (
        <Notice tone="warning" title={`${r.openReports.length} open report${r.openReports.length === 1 ? "" : "s"} on this contribution's shared copy`}>
          <Link className="underline" href="/portal/moderation/reports">
            Review reports
          </Link>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-5">
          <section className="rounded-lg border border-l-4 border-l-brand-navy bg-card p-5" aria-labelledby="source-heading">
            <p className="eyebrow !text-brand-navy">Private source — moderators only</p>
            <h2 id="source-heading" className="mt-2 text-lg font-semibold text-brand-ink">
              <HighlightedText text={s.title} flags={s.flags} field="title" />
            </h2>
            <div className="mt-3 text-sm leading-relaxed text-brand-ink">
              <HighlightedText text={s.body} flags={s.flags} field="body" />
            </div>
            <dl className="mt-5 grid gap-2 border-t pt-4 text-sm sm:grid-cols-2">
              {(
                [
                  ["Type", OBSERVATION_TYPE_LABELS[s.type]],
                  ["Offering", s.offering?.name ?? "—"],
                  ["Industry", industryLabel(s.industry)],
                  ["Region", s.region],
                  ["Period", `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`],
                  ["Evidence", EVIDENCE_TYPE_LABELS[s.evidenceType]],
                  ["Confidence", CONFIDENCE_LABELS[s.confidence]],
                  ["Topics", s.topics.join(", ") || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {s.links.length > 0 && (
              <div className="mt-4 border-t pt-4 text-sm">
                <p className="font-medium">Supporting links (never published)</p>
                <ul className="mt-1 grid gap-1">
                  {s.links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all underline">
                        {l} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <SensitiveFlagList flags={s.flags} audience="moderator" />

          {r.locationMentions.length > 0 && (
            <section className="rounded-lg border bg-card p-4 text-sm">
              <h3 className="flex items-center gap-2 font-semibold text-brand-ink">
                <MapPin className="size-4" aria-hidden /> Place names to consider redacting
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.locationMentions.map((m, i) => (
                  <li key={`${m.term}-${i}`} className="rounded-full border px-2 py-0.5 text-xs">
                    {m.term} → {m.region}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold text-brand-ink">Possible duplicates</h3>
            <p className="text-xs text-muted-foreground">Keyword similarity — verify manually. Scores are token overlap (0–1), not a judgement.</p>
            {r.duplicates.length === 0 ? (
              <p className="mt-2 text-muted-foreground">No similar published contributions found.</p>
            ) : (
              <ul className="mt-2 grid gap-1.5">
                {r.duplicates.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/portal/learning/${d.id}`} className="underline">
                      {d.title}
                    </Link>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{d.score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold text-brand-ink">Consent for version {s.version}</h3>
            {r.consent ? (
              <ul className="mt-2 grid gap-1">
                <Flag on={r.consent.storeAndProcess} label="(a) Store and process" />
                <Flag on={r.consent.publishSharedVersion} label="(b) Publish a reviewed shared version" />
                <Flag on={r.consent.attributeOrganisation} label="(c) Attribute organisation" />
                <Flag on={r.consent.futureTraining} label="(d) Future-training preference (no programme active)" />
                <li className="text-xs text-muted-foreground">Recorded {formatDateTime(r.consent.createdAt)}</li>
              </ul>
            ) : (
              <p className="mt-2 text-destructive">No consent recorded for this version — it cannot be published.</p>
            )}
          </section>

          {r.openReports.length > 0 && (
            <section className="rounded-lg border bg-card p-4 text-sm">
              <h3 className="font-semibold text-brand-ink">Open reports</h3>
              <ul className="mt-2 grid gap-2">
                {r.openReports.map((rep) => (
                  <li key={rep.id} className="rounded-md bg-muted p-2.5">
                    <p className="font-medium">{REPORT_REASON_LABELS[rep.reason]}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[0.85rem]">{rep.details}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(rep.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold text-brand-ink">Decision history</h3>
            {r.decisions.length === 0 ? (
              <p className="mt-2 text-muted-foreground">No decisions yet.</p>
            ) : (
              <ol className="mt-2 grid gap-2">
                {r.decisions.map((d) => (
                  <li key={d.id} className="rounded-md border p-2.5">
                    <p className="font-medium">
                      {DECISION_LABELS[d.action]} · v{d.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.moderatorName} · {formatDateTime(d.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      <span className="text-xs text-muted-foreground">Public: </span>
                      {d.publicReason}
                    </p>
                    {d.internalNote && (
                      <p className="mt-1 whitespace-pre-wrap">
                        <span className="text-xs text-muted-foreground">Internal: </span>
                        {d.internalNote}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {r.sharedCopies.length > 0 && (
              <ul className="mt-3 grid gap-1 border-t pt-3">
                {r.sharedCopies.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
                    Shared copy v{c.version} <SharedStatusBadge status={c.status} /> {formatDate(c.publishedAt)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <ModerationReview
          observationId={s.id}
          version={s.version}
          canDecide={r.canDecide}
          suggested={r.suggestedCopy}
          consentAllowsAttribution={Boolean(r.consent?.attributeOrganisation)}
          organisationName={s.organisationName}
          sourceFlagCount={s.flags.length}
          periodPreview={r.periodPreview}
          liveVersion={r.liveCopy?.version ?? null}
        />
      </div>
    </div>
  );
}
