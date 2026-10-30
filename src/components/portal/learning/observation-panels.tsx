import Link from "next/link";
import { Check, Eye, Minus } from "lucide-react";
import type { ModerationAction, ObservationStatus, SharedStatus } from "@/generated/prisma/enums";
import { SharedStatusBadge } from "@/components/portal/learning/badges";
import { formatDate, formatDateTime } from "@/components/portal/learning/format";

interface Consent {
  id: string;
  version: number;
  storeAndProcess: boolean;
  publishSharedVersion: boolean;
  attributeOrganisation: boolean;
  futureTraining: boolean;
  createdAt: string;
}
interface SharedCopy {
  id: string;
  version: number;
  status: SharedStatus;
  title: string;
  region: string;
  periodLabel: string;
  attributionLabel: string | null;
  publishedAt: string;
}
interface Decision {
  id: string;
  version: number;
  action: ModerationAction;
  publicReason: string;
  createdAt: string;
}
interface Version {
  version: number;
  createdAt: string;
}

export const DECISION_LABELS: Record<ModerationAction, string> = {
  RETURN_FOR_CLARIFICATION: "Clarification requested",
  PUBLISH: "Published as a reviewed shared copy",
  REJECT: "Not published",
  SUSPEND: "Temporarily unpublished during a review",
  REINSTATE: "Reinstated after review",
  REMOVE: "Removed after review",
};

const Yes = ({ on, label }: { on: boolean; label: string }) => (
  <span className="inline-flex items-center gap-1" title={label}>
    {on ? <Check className="size-3.5 text-success" aria-hidden /> : <Minus className="size-3.5 text-muted-foreground" aria-hidden />}
    <span className="sr-only">{on ? "Yes" : "No"}</span>
  </span>
);

/** "Who can see this and how it may be used" — private source vs shared copy, attribution and consent history (PDF §09). */
export function VisibilityPanel({
  status,
  orgVisible,
  organisationName,
  submittedAt,
  versions,
  consents,
  sharedCopies,
}: {
  status: ObservationStatus;
  orgVisible: boolean;
  organisationName: string;
  submittedAt: string | null;
  versions: Version[];
  consents: Consent[];
  sharedCopies: SharedCopy[];
}) {
  const live = sharedCopies.find((s) => s.status === "PUBLISHED" || s.status === "SUSPENDED");
  const versionNumbers = [...new Set([...versions.map((v) => v.version), ...consents.map((c) => c.version)])].sort((a, b) => b - a);
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5" aria-labelledby="visibility-heading">
      <h2 id="visibility-heading" className="flex items-center gap-2 text-base font-semibold text-brand-ink">
        <Eye className="size-4" aria-hidden /> Who can see this and how it may be used
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-l-4 border-l-brand-navy p-3 text-sm">
          <p className="font-semibold text-brand-ink">Private source (this record)</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[0.85rem] text-muted-foreground">
            <li>You, as the author.</li>
            <li>{orgVisible ? `Active members of ${organisationName} (read-only).` : `Not visible to other members of ${organisationName}.`}</li>
            <li>
              {submittedAt
                ? "Azentio learning moderators, for review (since you first submitted it)."
                : "Not visible to moderators — it has never been submitted."}
            </li>
            <li>Never visible to other client organisations. Links stay here and are never copied.</li>
          </ul>
        </div>
        <div className="rounded-md border border-l-4 border-l-brand-green p-3 text-sm">
          <p className="font-semibold text-brand-ink">Shared copy (approved participants)</p>
          {live ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[0.85rem] text-muted-foreground">
              <li>
                Version {live.version} — <SharedStatusBadge status={live.status} />
              </li>
              <li>Moderator-reviewed text, region coarsened to {live.region}, period shown as {live.periodLabel}.</li>
              <li>{live.attributionLabel ? `Attributed to ${live.attributionLabel}.` : "Unattributed — your organisation is not named."}</li>
              <li>Your name, organisation ID, links, consent and moderator notes are never included.</li>
              {live.status === "PUBLISHED" && (
                <li>
                  <Link className="text-brand-ink underline" href={`/portal/learning/${live.id}`}>
                    View the shared copy
                  </Link>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-1.5 text-[0.85rem] text-muted-foreground">
              {status === "SUBMITTED" || status === "RETURNED"
                ? "No shared copy yet — nothing is visible to other organisations until a moderator publishes a reviewed copy."
                : "No shared copy is visible to other organisations."}
            </p>
          )}
        </div>
      </div>

      {versionNumbers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="mb-2 text-left text-xs text-muted-foreground">
              Consent history (append-only). (a) store &amp; process · (b) publish reviewed copy · (c) attribute organisation · (d) future-training
              preference — no training programme is active.
            </caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">Version</th>
                <th className="py-1.5 pr-3 font-medium">Recorded</th>
                <th className="py-1.5 pr-3 font-medium">(a)</th>
                <th className="py-1.5 pr-3 font-medium">(b)</th>
                <th className="py-1.5 pr-3 font-medium">(c)</th>
                <th className="py-1.5 pr-3 font-medium">(d)</th>
                <th className="py-1.5 font-medium">Shared copy</th>
              </tr>
            </thead>
            <tbody>
              {versionNumbers.flatMap((v) => {
                const rows = consents.filter((c) => c.version === v).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                const copy = sharedCopies.find((s) => s.version === v);
                if (rows.length === 0) {
                  return [
                    <tr key={`v${v}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">v{v}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground" colSpan={5}>
                        No consent recorded
                      </td>
                      <td className="py-1.5">{copy ? <SharedStatusBadge status={copy.status} /> : "—"}</td>
                    </tr>,
                  ];
                }
                return rows.map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{i === 0 ? `v${v}` : ""}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                      {!c.publishSharedVersion && <span className="ml-1 text-xs">(withdrawal recorded)</span>}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Yes on={c.storeAndProcess} label="Store and process" />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Yes on={c.publishSharedVersion} label="Publish reviewed copy" />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Yes on={c.attributeOrganisation} label="Attribute organisation" />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Yes on={c.futureTraining} label="Future training preference" />
                    </td>
                    <td className="py-1.5">{i === 0 && copy ? <SharedStatusBadge status={copy.status} /> : i === 0 ? "—" : ""}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Chronological timeline for the author: versions, moderator decisions (public reasons only) and withdrawals. */
export function ObservationTimeline({
  createdAt,
  versions,
  decisions,
  consents,
}: {
  createdAt: string;
  versions: Version[];
  decisions: Decision[];
  consents: Consent[];
}) {
  const events = [
    { at: createdAt, title: "Created as a private draft", detail: null as string | null, tone: "neutral" },
    ...versions.map((v) => ({ at: v.createdAt, title: `Version ${v.version} submitted for review`, detail: null, tone: "info" })),
    ...decisions.map((d) => ({ at: d.createdAt, title: `${DECISION_LABELS[d.action]} (v${d.version})`, detail: d.publicReason, tone: d.action === "PUBLISH" || d.action === "REINSTATE" ? "success" : "warning" })),
    ...consents.filter((c) => !c.publishSharedVersion).map((c) => ({ at: c.createdAt, title: "Withdrawn by you", detail: null, tone: "neutral" })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section className="rounded-lg border bg-card p-5" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="text-base font-semibold text-brand-ink">
        Timeline
      </h2>
      <ol className="mt-3 grid gap-3 border-l pl-4">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[1.3rem] top-1.5 size-2.5 rounded-full ${e.tone === "success" ? "bg-success" : e.tone === "warning" ? "bg-warning" : e.tone === "info" ? "bg-brand-navy" : "bg-brand-muted"}`}
            />
            <p className="text-sm font-medium text-brand-ink">{e.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(e.at)}</p>
            {e.detail && <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">{e.detail}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
