import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { moderatorPageActor } from "@/server/learning/guard";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/server/learning/labels";
import { listReports, moderationCounts } from "@/server/services/moderation";
import { cn } from "@/lib/utils";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Chip, SharedStatusBadge } from "@/components/portal/learning/badges";
import { formatDateTime } from "@/components/portal/learning/format";
import { ModerationNav } from "@/components/portal/learning/moderation-nav";
import { ReportActions } from "@/components/portal/learning/moderation-report-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports · Moderation" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await moderatorPageActor();
  const sp = await searchParams;
  const status = sp.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  const [items, counts] = await Promise.all([listReports(actor, status), moderationCounts(actor)]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Learning moderation"
        title="Reports"
        description="Concerns raised by participants about shared copies. Suspend during investigation, then reinstate or remove. Reporters are never identified to contributors."
      />
      <ModerationNav active="reports" queue={counts.queue} reports={counts.reports} />

      <div className="flex gap-2 text-sm">
        {(["OPEN", "RESOLVED"] as const).map((s) => (
          <Link
            key={s}
            href={s === "OPEN" ? "/portal/moderation/reports" : "/portal/moderation/reports?status=RESOLVED"}
            aria-current={status === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", status === s ? "border-brand-navy bg-brand-navy text-white" : "hover:bg-muted")}
          >
            {s === "OPEN" ? "Open" : "Resolved"}
          </Link>
        ))}
      </div>

      <Notice>
        Contributors are told when their copy is suspended, reinstated or removed, with the message you provide — never who reported it. Decision
        notes stay with moderators.
      </Notice>

      {items.length === 0 ? (
        <EmptyState icon={Flag} title={status === "OPEN" ? "No open reports" : "No resolved reports yet"} />
      ) : (
        <ul className="grid gap-4">
          {items.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="warning">{REPORT_REASON_LABELS[r.reason]}</Chip>
                <Chip>{REPORT_STATUS_LABELS[r.status]}</Chip>
                <SharedStatusBadge status={r.shared.status} />
                {r.shared.openReports > 1 && r.status === "OPEN" && <Chip tone="info">{r.shared.openReports} open reports on this copy</Chip>}
                <span className="text-xs text-muted-foreground">Reported {formatDateTime(r.createdAt)}</span>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">Reporter&apos;s concern</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{r.details}</p>
              </div>
              <div className="rounded-md border border-l-4 border-l-brand-green p-3">
                <p className="text-xs text-muted-foreground">
                  Shared copy v{r.shared.version} · {r.shared.region} · {r.shared.periodLabel} · {r.shared.attributionLabel ?? "Unattributed"}
                </p>
                <p className="mt-1 font-semibold text-brand-ink">{r.shared.title}</p>
                <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm">{r.shared.body}</p>
                <Link href={`/portal/moderation/${r.shared.observationId}`} className="mt-2 inline-block text-xs underline">
                  Open source review and history
                </Link>
              </div>
              {r.decisionNote && (
                <p className="whitespace-pre-wrap text-sm">
                  <span className="text-xs text-muted-foreground">Decision note: </span>
                  {r.decisionNote}
                </p>
              )}
              <ReportActions reportId={r.id} sharedStatus={r.shared.status} reportStatus={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
