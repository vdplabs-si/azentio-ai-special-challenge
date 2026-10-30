import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, Pencil } from "lucide-react";
import { AppError } from "@/lib/api/errors";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { getTheme } from "@/server/services/themes";
import { CONFIDENCE_LABELS } from "@/server/learning/labels";
import { EmptyState, Notice, PageHeader, StatTile } from "@/components/portal/page";
import { CohortText, IdeaStatusBadge, ThemeStatusBadge } from "@/components/portal/learning/badges";
import { SharedCard } from "@/components/portal/learning/shared-card";
import { formatDate } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Theme" };

async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}

export default async function ThemePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await learningPageActor();
  const { id } = await params;
  const t = await orNotFound(getTheme(actor, id));
  const m = t.metrics;
  const canCreateIdea = actor.isEmployee && can.manageIdeas(actor);
  const mix = (["HIGH", "MEDIUM", "LOW"] as const).map((c) => ({ c, n: m.confidenceMix[c] }));
  const total = Math.max(1, m.contributions);

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/portal/themes">
            <ArrowLeft aria-hidden /> Themes
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Theme"
        title={t.title}
        actions={
          <>
            {t.canManage && <ThemeStatusBadge status={t.status} />}
            {canCreateIdea && (
              <Button asChild variant="outline">
                <Link href={`/portal/ideas/new?theme=${t.id}`}>
                  <Lightbulb aria-hidden /> New idea from theme
                </Link>
              </Button>
            )}
            {t.canManage && (
              <Button asChild>
                <Link href={`/portal/themes/${t.id}/edit`}>
                  <Pencil aria-hidden /> Edit theme
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Approved contributions" value={m.contributions} hint="Currently published shared copies" />
        <StatTile label="Contributing organisations" value={<CohortText value={m.organisations} />} hint="Distinct organisations; repeats count once" />
        <StatTile label="Observation period" value={m.period?.label ?? "—"} hint="Span of the linked evidence" />
        <StatTile label="Latest update" value={formatDate(m.latestUpdate)} />
      </div>

      {m.smallSample && (
        <Notice tone="warning" title="Small sample — interpret with caution">
          This theme draws on few contributions or fewer than {m.organisations.min} organisations. Treat it as an early signal, not a
          conclusion.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">{t.summary}</p>
            <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Limitations</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">{t.limitations || "No limitations recorded."}</p>
          </section>

          <section aria-labelledby="evidence-h" className="grid gap-3">
            <h2 id="evidence-h" className="text-lg font-semibold text-brand-ink">
              Supporting approved contributions
            </h2>
            {t.evidence.length === 0 ? (
              <EmptyState title="No published evidence" description="Linked contributions that are withdrawn or unpublished no longer appear or count here." />
            ) : (
              t.evidence.map((e) => <SharedCard key={e.item.id} item={e.item} compact />)
            )}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relevant offerings</h2>
            {t.offerings.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None linked.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm text-brand-ink">
                {t.offerings.map((o) => (
                  <li key={o.id}>{o.name}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence mix</h2>
            <ul className="mt-2 grid gap-2 text-sm">
              {mix.map(({ c, n }) => (
                <li key={c}>
                  <div className="flex justify-between text-brand-ink">
                    <span>{CONFIDENCE_LABELS[c]}</span>
                    <span className="tabular-nums">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                    <div className="h-1.5 rounded-full bg-brand-navy" style={{ width: `${(n / total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Improvement ideas</h2>
            {t.ideas.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No linked ideas yet.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-sm">
                {t.ideas.map((i) => (
                  <li key={i.id} className="grid gap-1">
                    <Link href={`/portal/ideas/${i.id}`} className="text-brand-ink hover:underline">
                      {i.title}
                    </Link>
                    <IdeaStatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Notice title="Privacy and interpretation">
            Contributing organisations are never identified. Popularity is not market prevalence, and co-occurring observations do not
            establish causation.
          </Notice>
          {t.createdBy && <p className="text-xs text-muted-foreground">Curated by {t.createdBy} · created {formatDate(t.createdAt)}</p>}
        </aside>
      </div>
    </div>
  );
}
