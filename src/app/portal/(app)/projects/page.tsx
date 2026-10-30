import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban, Lock } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { canContributeInOrg } from "@/lib/authz/permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/portal/page";
import { FilterBar } from "@/components/portal/collab/filter-bar";
import { NewProjectDialog } from "@/components/portal/collab/project-actions";
import { CursorPager, DueDate, EnumBadge, ProgressMeter, ToneBadge } from "@/components/portal/collab/ui";
import { KIND_LABEL, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/components/portal/collab/labels";
import { PROJECT_KINDS, PROJECT_STATUSES, projectListQuery } from "@/components/portal/collab/schemas";
import { hrefWith, param, type SearchParamsRecord } from "@/components/portal/collab/url";
import { listProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const [actor, sp] = await Promise.all([requireUser(), searchParams]);
  const parsed = projectListQuery.safeParse({
    workspaceId: param(sp, "workspaceId") || undefined,
    status: param(sp, "status") || undefined,
    kind: param(sp, "kind") || undefined,
    q: param(sp, "q") || undefined,
    cursor: param(sp, "cursor") || undefined,
    limit: 25,
  });
  const filters = parsed.success ? parsed.data : { limit: 25 };
  const page = await listProjects(actor, filters);
  const filtered = Boolean(filters.workspaceId || filters.status || filters.kind || filters.q);
  const creatable = actor.memberships
    .filter((m) => canContributeInOrg(actor, m.organisationId))
    .map((m) => ({ id: m.organisationId, name: m.organisation.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collaboration"
        title="Projects"
        description="Projects you can see across your workspaces. Progress is computed from completed tasks."
        actions={<NewProjectDialog workspaces={creatable} defaultWorkspaceId={actor.activeOrganisation?.organisationId ?? null} />}
      />
      <FilterBar
        searchPlaceholder="Search projects"
        filters={[
          ...(actor.memberships.length > 1
            ? [{ key: "workspaceId", label: "Workspace", allLabel: "All workspaces", options: actor.memberships.map((m) => ({ value: m.organisationId, label: m.organisation.name })) }]
            : []),
          { key: "status", label: "Status", allLabel: "All statuses", options: PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s]! })) },
          ...(actor.isEmployee ? [{ key: "kind", label: "Kind", allLabel: "All kinds", options: PROJECT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k]! })) }] : []),
        ]}
      />
      {page.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={filtered ? "Try clearing the filters." : creatable.length ? "Create a project to start organising work." : "Projects shared with you will appear here."}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="min-w-40">Progress</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Overdue tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-80">
                    <Link href={`/portal/projects/${p.id}`} className="font-medium text-brand-ink hover:underline">
                      {p.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{p.organisation.name}</span>
                      {p.visibility === "PRIVATE" && (
                        <span className="inline-flex items-center gap-0.5">
                          · <Lock className="size-3" aria-hidden /> Private
                        </span>
                      )}
                      {p.kind === "HACKATHON_TEAM" && <ToneBadge tone="info">{p.hackathonEvent?.name ?? "Hackathon team"}</ToneBadge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <EnumBadge value={p.status} labels={PROJECT_STATUS_LABEL} tones={PROJECT_STATUS_TONE} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{p.owner.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <DueDate dueAt={p.dueAt} overdue={p.isOverdue} />
                  </TableCell>
                  <TableCell>
                    <ProgressMeter {...p.progress} />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {p.overdueTasks > 0 ? <span className="font-semibold text-destructive">{p.overdueTasks}</span> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CursorPager
        isFirstPage={!filters.cursor}
        firstHref={hrefWith("/portal/projects", sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith("/portal/projects", sp, { cursor: page.nextCursor }) : null}
      />
    </div>
  );
}
