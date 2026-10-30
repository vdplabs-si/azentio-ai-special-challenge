import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, History } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { paginationSchema } from "@/lib/api/pagination";
import { getRun, getScenarioBySlug, listRuns } from "@/server/services/playground";
import { Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { SyntheticLabel } from "@/components/portal/playground/synthetic-label";
import { ScenarioWorkbench, type WorkbenchRun } from "@/components/portal/playground/scenario-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Playground scenario" };

const when = (d: Date) => format(d, "d MMM yyyy, HH:mm");

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ run?: string; cursor?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireUser();

  // Invisible scenarios (not entitled, employee-only, unknown) are indistinguishable from missing ones.
  const scenario = await getScenarioBySlug(actor, slug);
  if (!scenario) notFound();

  const runId = typeof sp.run === "string" ? sp.run : undefined;
  const page = paginationSchema.safeParse({ cursor: sp.cursor, limit: 10 });
  const [selected, runs] = await Promise.all([
    runId ? getRun(actor, runId) : Promise.resolve(null),
    listRuns(actor, scenario.slug, page.success ? page.data : { limit: 10 }),
  ]);
  if (runId && (!selected || selected.scenario.slug !== scenario.slug)) notFound();

  const org = actor.activeOrganisation;
  const canRun = scenario.available && Boolean(org);
  const initialRun: WorkbenchRun | null = selected
    ? {
        id: selected.id,
        createdAtLabel: when(selected.createdAt),
        inputs: selected.inputs,
        outputs: selected.outputs,
        feedback: selected.feedback
          ? { usefulness: selected.feedback.usefulness, clarity: selected.feedback.clarity, trust: selected.feedback.trust, comment: selected.feedback.comment }
          : null,
      }
    : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={scenario.offering.name}
        title={scenario.name}
        description={scenario.description}
        actions={
          <Button asChild variant="outline">
            <Link href="/portal/playground">
              <ArrowLeft aria-hidden /> All demonstrations
            </Link>
          </Button>
        }
      />
      <SyntheticLabel />
      {scenario.audience === "EMPLOYEE" && (
        <Notice title="Internal prototype">
          This scenario is visible to verified Azentio employees only. It is not shown to client workspaces.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {scenario.available ? (
            <ScenarioWorkbench
              key={selected?.id ?? "new"}
              slug={scenario.slug}
              fields={scenario.fields}
              defaults={scenario.defaults}
              canRun={canRun}
              cannotRunReason={org ? undefined : "Select an active workspace first — runs are recorded in your active workspace."}
              initialRun={initialRun}
            />
          ) : (
            <Notice tone="warning" title="Demonstration unavailable">
              The engine for this scenario is not available on this deployment, so it cannot be run. No result is simulated in its
              place.
            </Notice>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-brand-muted" aria-hidden /> My previous runs
              </CardTitle>
              <CardDescription>{org ? `Only you can see these runs, in ${org.organisation.name}.` : "No active workspace."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {!runs || runs.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs of this scenario yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {runs.items.map((r) => {
                    const active = r.id === selected?.id;
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/portal/playground/${encodeURIComponent(scenario.slug)}?run=${encodeURIComponent(r.id)}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-md border px-3 py-2 text-sm transition-colors hover:border-brand-green/60",
                            active && "border-brand-green bg-brand-light",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            {when(r.createdAt)}
                            {r.hasFeedback && <Badge variant="secondary">Rated</Badge>}
                          </span>
                          <span className="mt-1 line-clamp-2 text-brand-ink">{r.summary}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {runs && (
                <Pager
                  basePath={`/portal/playground/${encodeURIComponent(scenario.slug)}`}
                  params={{ run: runId }}
                  cursor={page.success ? page.data.cursor : undefined}
                  nextCursor={runs.nextCursor}
                  label="runs"
                />
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>About this demonstration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-brand-ink">Offering:</span> {scenario.offering.name}
              </p>
              <p>
                <span className="font-medium text-brand-ink">Audience:</span>{" "}
                {scenario.audience === "EMPLOYEE" ? "Azentio employees only" : "Entitled client workspaces and employees"}
              </p>
              <p>
                Every run is deterministic: the same inputs always produce the same result, and each run stores its inputs so it can be
                reproduced. Results are illustrative and must not be used for credit or business decisions.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
