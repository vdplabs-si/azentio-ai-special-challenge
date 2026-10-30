import Link from "next/link";
import type { Metadata } from "next";
import { CalendarRange, Plus, Shapes, Sparkles, TriangleAlert } from "lucide-react";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { listThemes, themeSuggestions, type ThemeSuggestion } from "@/server/services/themes";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { CohortText, ThemeStatusBadge } from "@/components/portal/learning/badges";
import { formatDate } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Themes" };

export default async function ThemesPage() {
  const actor = await learningPageActor();
  const canManage = can.manageThemes(actor);
  const [themes, suggestions] = await Promise.all([listThemes(actor), canManage ? themeSuggestions(actor) : Promise.resolve<ThemeSuggestion[]>([])]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Collective learning"
        title="Themes"
        description="Patterns curated by Azentio from approved shared contributions. Each theme links to its evidence; organisations are never identified and small samples are flagged."
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/portal/themes/new">
                <Plus aria-hidden /> New theme
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Notice title="How to read themes">
        A theme summarises what approved contributions describe. The number of contributions is not a measure of market prevalence and does
        not establish causation. Organisation counts are shown only when at least the minimum number of organisations contributed.
      </Notice>

      {themes.length === 0 ? (
        <EmptyState
          icon={Shapes}
          title={canManage ? "No themes yet" : "No published themes yet"}
          description={
            canManage
              ? "Create a theme from approved shared contributions, or start from a suggested grouping below."
              : "When Azentio publishes themes drawn from shared learning, they appear here."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {themes.map((t) => (
            <li key={t.id} className="flex flex-col rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-brand-ink">
                  <Link href={`/portal/themes/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>
                </h2>
                {canManage && <ThemeStatusBadge status={t.status} />}
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.summary}</p>
              {t.offerings.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Relevant offerings">
                  {t.offerings.map((o) => (
                    <li key={o.id} className="rounded-full border px-2 py-0.5 text-xs text-brand-ink">
                      {o.name}
                    </li>
                  ))}
                </ul>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Approved contributions</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-brand-ink">{t.metrics.contributions}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contributing organisations</dt>
                  <dd className="mt-0.5 text-brand-ink">
                    <CohortText value={t.metrics.organisations} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Observation period</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 text-brand-ink">
                    <CalendarRange className="size-3.5" aria-hidden /> {t.metrics.period?.label ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Latest update</dt>
                  <dd className="mt-0.5 text-brand-ink">{formatDate(t.metrics.latestUpdate)}</dd>
                </div>
              </dl>
              {t.metrics.smallSample && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warning">
                  <TriangleAlert className="size-3.5" aria-hidden /> Small sample — interpret with caution
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && <Suggestions items={suggestions} />}
    </div>
  );
}

function Suggestions({ items }: { items: ThemeSuggestion[] }) {
  return (
    <section aria-labelledby="suggestions-h" className="grid gap-4 border-t pt-6">
      <div>
        <h2 id="suggestions-h" className="flex items-center gap-2 text-lg font-semibold text-brand-ink">
          <Sparkles className="size-5 text-success" aria-hidden /> Suggested groupings (keyword similarity)
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Generated by keyword overlap — verify manually. Grouping size is not evidence of market prevalence or causation. Visible to theme
          managers only.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No suggested groupings"
          description="Suggestions appear when several approved shared contributions share topics or keywords."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((g, i) => {
            const params = new URLSearchParams({ evidence: g.members.map((m) => m.id).join(","), title: g.label });
            return (
              <li key={`${g.label}-${i}`} className="rounded-lg border border-dashed bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-brand-ink">{g.label}</h3>
                  <span className="text-xs text-muted-foreground" title="Mean pairwise keyword similarity (0–1)">
                    Similarity {g.cohesion.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.contributions} contributions · <CohortText value={g.organisations} />
                </p>
                {g.sharedTopics.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Shared topics">
                    {g.sharedTopics.map((t) => (
                      <li key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs text-brand-ink">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="mt-3 grid gap-1 text-sm">
                  {g.members.slice(0, 8).map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-2">
                      <Link href={`/portal/learning/${m.id}`} className="truncate text-brand-ink hover:underline">
                        {m.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.periodLabel}</span>
                    </li>
                  ))}
                  {g.members.length > 8 && <li className="text-xs text-muted-foreground">…and {g.members.length - 8} more</li>}
                </ul>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/portal/themes/new?${params.toString()}`}>
                    <Plus aria-hidden /> Create theme from this grouping
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
