import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { FlaskConical, History } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { listMyRecentRuns, listScenarios, type ScenarioSummary } from "@/server/services/playground";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { SyntheticLabel } from "@/components/portal/playground/synthetic-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Playground" };

function groupByOffering(scenarios: ScenarioSummary[]) {
  const groups = new Map<string, { offering: ScenarioSummary["offering"]; items: ScenarioSummary[] }>();
  for (const s of scenarios) {
    const g = groups.get(s.offering.id) ?? { offering: s.offering, items: [] };
    g.items.push(s);
    groups.set(s.offering.id, g);
  }
  return [...groups.values()];
}

export default async function PlaygroundPage() {
  const actor = await requireUser();
  const [scenarios, recent] = await Promise.all([listScenarios(actor), listMyRecentRuns(actor, 8)]);
  const groups = groupByOffering(scenarios);
  const org = actor.activeOrganisation;
  const isClientWorkspace = org?.organisation.type === "CLIENT";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Innovation"
        title="Playground"
        description="Guided demonstrations of azentio.ai offerings. Choose a scenario, inspect and adjust its synthetic inputs, run it, review the evidence behind the result and tell us how useful it was."
      />
      <SyntheticLabel />

      {actor.isEmployee ? (
        <Notice title="Employee access">
          As a verified Azentio employee you can run every scenario, including internal prototypes. Clients only see scenarios for
          offerings their active workspace is entitled to.
        </Notice>
      ) : org ? (
        <Notice title={`Workspace: ${org.organisation.name}`}>
          Demonstrations shown here are those your active workspace is entitled to. Runs are saved in this workspace and are visible
          only to you.
        </Notice>
      ) : null}

      {scenarios.length === 0 ? (
        actor.isEmployee ? (
          <EmptyState
            icon={FlaskConical}
            title="No demonstration scenarios are loaded yet"
            description="Scenarios are loaded into this deployment from the Playground catalogue by an administrator. Once seeded they appear here for every employee."
          />
        ) : isClientWorkspace ? (
          <EmptyState
            icon={FlaskConical}
            title="No demonstrations are enabled for this workspace"
            description={`${org!.organisation.name} has no Playground entitlements yet. Azentio administrators enable product demonstrations for entitled client organisations — workspaces cannot enable products themselves. Contact your Azentio representative if you expected access.`}
          />
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="No demonstrations available"
            description="Playground demonstrations are available to verified Azentio employees and to client workspaces with an entitlement. Switch to an entitled client workspace, or complete employee verification."
          />
        )
      ) : (
        <div className="grid gap-8">
          {groups.map((g) => (
            <section key={g.offering.id} aria-labelledby={`offering-${g.offering.slug}`} className="grid gap-3">
              <div>
                <p className="eyebrow">{g.offering.category}</p>
                <h2 id={`offering-${g.offering.slug}`} className="mt-1 text-xl font-semibold text-brand-ink">
                  {g.offering.name}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.items.map((s) => (
                  <Card key={s.id} className="justify-between">
                    <CardHeader>
                      <div className="flex flex-wrap gap-1.5">
                        {s.audience === "EMPLOYEE" ? (
                          <Badge variant="outline" className="border-warning/50 text-warning">
                            Internal prototype
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{actor.isEmployee ? "Client demonstration" : "Entitled demonstration"}</Badge>
                        )}
                        {!s.available && <Badge variant="destructive">Unavailable</Badge>}
                      </div>
                      <CardTitle className="mt-2 text-brand-ink">{s.name}</CardTitle>
                      <CardDescription className="line-clamp-4">{s.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button asChild size="sm">
                        <Link href={`/portal/playground/${encodeURIComponent(s.slug)}`}>Open demonstration</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="recent-runs" className="grid gap-3">
        <h2 id="recent-runs" className="flex items-center gap-2 text-lg font-semibold text-brand-ink">
          <History className="size-4 text-brand-muted" aria-hidden /> My recent runs
          {org && <span className="text-sm font-normal text-muted-foreground">in {org.organisation.name}</span>}
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={History}
            title="No runs yet"
            description="Runs you make in this workspace appear here, with their stored inputs and results, so you can revisit and rate them."
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Scenario</TableHead>
                    <TableHead>Run</TableHead>
                    <TableHead>Result summary</TableHead>
                    <TableHead className="pr-4">Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 align-top">
                        <Link
                          className="font-medium text-brand-ink underline-offset-4 hover:underline"
                          href={`/portal/playground/${encodeURIComponent(r.scenario.slug)}?run=${encodeURIComponent(r.id)}`}
                        >
                          {r.scenario.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{r.scenario.offeringName}</p>
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">{format(r.createdAt, "d MMM yyyy, HH:mm")}</TableCell>
                      <TableCell className="max-w-md align-top whitespace-normal">
                        <p className="line-clamp-2 text-sm">{r.summary}</p>
                      </TableCell>
                      <TableCell className="pr-4 align-top">
                        {r.hasFeedback ? <Badge variant="secondary">Rated</Badge> : <span className="text-xs text-muted-foreground">Not rated</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
