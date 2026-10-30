import Link from "next/link";
import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatTile } from "@/components/portal/page";
import { FilterBar } from "@/components/portal/collab/filter-bar";
import { TaskStatusSelect } from "@/components/portal/collab/tasks-panel";
import { CursorPager, DueDate, EnumBadge } from "@/components/portal/collab/ui";
import { PRIORITY_LABEL, PRIORITY_TONE, TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/components/portal/collab/labels";
import { PRIORITIES, TASK_STATUSES, taskListQuery } from "@/components/portal/collab/schemas";
import { compareTasksByDue, compareTasksByPriority, DUE_BUCKET_LABEL, dueBucket, groupBy, type DueBucket } from "@/components/portal/collab/metrics";
import { hrefWith, oneOf, param, type SearchParamsRecord } from "@/components/portal/collab/url";
import { listMyTasks, myTaskCounts, type MyTaskRow } from "@/server/services/tasks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tasks" };

const GROUPS = ["priority", "due", "project", "none"] as const;
const SORTS = ["priority", "due", "updated"] as const;
const DUE_KEYS: DueBucket[] = ["overdue", "today", "week", "later", "none"];

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const [actor, sp] = await Promise.all([requireUser(), searchParams]);
  const statusParam = param(sp, "status") ?? "OPEN";
  const sort = oneOf(param(sp, "sort"), SORTS) ?? "priority";
  const group = oneOf(param(sp, "group"), GROUPS) ?? "priority";
  const parsed = taskListQuery.safeParse({
    status: statusParam === "ALL" ? undefined : statusParam,
    priority: param(sp, "priority") || undefined,
    overdue: param(sp, "overdue") || undefined,
    q: param(sp, "q") || undefined,
    cursor: param(sp, "cursor") || undefined,
    sort,
    limit: 100,
  });
  const filters = parsed.success ? parsed.data : { limit: 100, status: "OPEN" as const, sort };
  const [page, counts] = await Promise.all([listMyTasks(actor, filters), myTaskCounts(actor)]);

  const now = new Date();
  const sorted = [...page.items].sort(sort === "due" ? compareTasksByDue : sort === "priority" ? compareTasksByPriority : () => 0);
  let groups: { key: string; label: string; items: MyTaskRow[] }[];
  if (group === "priority") {
    groups = groupBy(sorted, (t) => t.priority, ["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((g) => ({ ...g, label: `${PRIORITY_LABEL[g.key]} priority` }));
  } else if (group === "due") {
    groups = groupBy(sorted, (t) => dueBucket(t, now), DUE_KEYS).map((g) => ({ ...g, label: DUE_BUCKET_LABEL[g.key] }));
  } else if (group === "project") {
    const projectIds = [...new Set(sorted.map((t) => t.project.id))];
    groups = groupBy(sorted, (t) => t.project.id, projectIds).map((g) => {
      const p = g.items[0]!.project;
      return { ...g, label: `${p.name} · ${p.organisation.name}` };
    });
  } else {
    groups = sorted.length ? [{ key: "all", label: "All tasks", items: sorted }] : [];
  }
  const filtered = statusParam !== "OPEN" || Boolean(filters.priority || filters.overdue || filters.q);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collaboration"
        title="My tasks"
        description="Tasks assigned to you across every project you can access, with overdue work highlighted."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open tasks" value={counts.open} href="/portal/tasks" />
        <StatTile label="Overdue" value={<span className={cn(counts.overdue > 0 && "text-destructive")}>{counts.overdue}</span>} href="/portal/tasks?overdue=1&group=due" />
        <StatTile label="Urgent" value={counts.urgent} href="/portal/tasks?priority=URGENT" />
      </div>
      <FilterBar
        searchPlaceholder="Search my tasks"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "OPEN", label: "Open (not done)" },
              { value: "ALL", label: "All statuses" },
              ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s]! })),
            ],
          },
          { key: "priority", label: "Priority", allLabel: "All priorities", options: PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p]! })) },
          { key: "overdue", label: "Due", allLabel: "Any due date", options: [{ value: "1", label: "Overdue only" }] },
          { key: "sort", label: "Sort", options: [{ value: "priority", label: "Sort: priority" }, { value: "due", label: "Sort: due date" }, { value: "updated", label: "Sort: recently updated" }] },
          {
            key: "group",
            label: "Group",
            options: [
              { value: "priority", label: "Group: priority" },
              { value: "due", label: "Group: due date" },
              { value: "project", label: "Group: project" },
              { value: "none", label: "No grouping" },
            ],
          },
        ]}
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filtered ? "No tasks match these filters" : "Nothing assigned to you"}
          description={filtered ? "Try clearing the filters." : "Tasks assigned to you in any project will appear here."}
        />
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", g.key === "overdue" ? "text-destructive" : "text-brand-ink")}>
                {g.label}
                <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{g.items.length}</span>
              </h2>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead className="hidden md:table-cell">Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Priority</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((t) => (
                      <TableRow key={t.id} className={cn(t.isOverdue && "bg-destructive/5")}>
                        <TableCell className="max-w-80">
                          <Link href={`/portal/projects/${t.project.id}?tab=tasks&task=${t.id}`} className="font-medium text-brand-ink hover:underline">
                            {t.title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground md:hidden">{t.project.name}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Link href={`/portal/projects/${t.project.id}`} className="hover:underline">
                            {t.project.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{t.project.organisation.name}</p>
                        </TableCell>
                        <TableCell>
                          {t.canContribute ? (
                            <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} />
                          ) : (
                            <EnumBadge value={t.status} labels={TASK_STATUS_LABEL} tones={TASK_STATUS_TONE} />
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <EnumBadge value={t.priority} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} />
                        </TableCell>
                        <TableCell>
                          <DueDate dueAt={t.dueAt} overdue={t.isOverdue} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}
      <CursorPager
        isFirstPage={!filters.cursor}
        firstHref={hrefWith("/portal/tasks", sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith("/portal/tasks", sp, { cursor: page.nextCursor }) : null}
      />
    </div>
  );
}
