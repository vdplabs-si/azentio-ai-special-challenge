import "server-only";
import { AppError } from "@/lib/api/errors";
import Link from "next/link";
import { ArrowLeft, MessageSquare, MessagesSquare, Pin } from "lucide-react";
import type { AuthedActor } from "@/lib/authz/actor";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Notice } from "@/components/portal/page";
import { TasksPanel } from "@/components/portal/collab/tasks-panel";
import { ActivityFeed } from "@/components/portal/collab/activity-feed";
import { DeleteDiscussionButton, DiscussionThread, NewDiscussionDialog } from "@/components/portal/collab/discussion-actions";
import { UploadDocumentButton } from "@/components/portal/collab/documents-actions";
import { DocumentsTable } from "@/components/portal/collab/documents-table";
import {
  AddProjectMemberDialog,
  DeleteProjectButton,
  ProjectMemberActions,
  ProjectSettingsForm,
} from "@/components/portal/collab/project-actions";
import { CursorPager, Person, PersonAvatar, RelativeTime, RichText, SectionHeading, ToneBadge } from "@/components/portal/collab/ui";
import { MEMBERSHIP_ROLE_LABEL, PROJECT_ROLE_LABEL } from "@/components/portal/collab/labels";
import { taskListQuery } from "@/components/portal/collab/schemas";
import { formatDate, formatDateTime } from "@/components/portal/collab/dates";
import { hrefWith, param, type SearchParamsRecord } from "@/components/portal/collab/url";
import { listProjectActivity, listProjectMembers, listProjectPeople, type ProjectDetail } from "@/server/services/projects";
import { listProjectTasks } from "@/server/services/tasks";
import { getDiscussion, listDiscussions } from "@/server/services/discussions";
import { listProjectDocuments } from "@/server/services/documents";
import { activePeople } from "@/server/services/workspaces";

type Ctx = { actor: AuthedActor; detail: ProjectDetail; sp: SearchParamsRecord; basePath: string };
const cursorOf = (sp: SearchParamsRecord) => {
  const c = param(sp, "cursor");
  return c && c.length <= 64 ? c : undefined;
};
const toPeople = (rows: { id: string; name: string; email: string; image: string | null }[]) =>
  rows.map((p) => ({ id: p.id, name: p.name, email: p.email, image: p.image }));

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function TasksTab({ actor, detail, sp }: Ctx) {
  const projectId = detail.project.id;
  const view = param(sp, "view") === "list" ? "list" : "board";
  const parsed = taskListQuery.safeParse({
    status: view === "list" ? param(sp, "status") || undefined : undefined,
    priority: param(sp, "priority") || undefined,
    assignee: param(sp, "assignee") || undefined,
    overdue: param(sp, "overdue") || undefined,
    q: param(sp, "q") || undefined,
    sort: "priority",
    limit: 200,
  });
  const filters = parsed.success ? parsed.data : { limit: 200 };
  const [tasks, people] = await Promise.all([listProjectTasks(actor, projectId, filters), listProjectPeople(actor, projectId)]);
  return (
    <TasksPanel
      projectId={projectId}
      tasks={tasks.items}
      view={view}
      people={toPeople(people)}
      canContribute={detail.access.contribute}
      initialTaskId={param(sp, "task")?.slice(0, 64)}
      truncated={tasks.nextCursor !== null}
      currentUserId={actor.user.id}
    />
  );
}

// ── Discussions ────────────────────────────────────────────────────────────────

export async function DiscussionsTab({ actor, detail, sp, basePath }: Ctx) {
  const projectId = detail.project.id;
  const discussionId = param(sp, "discussion");
  if (discussionId) {
    const [found, people] = await Promise.all([
      getDiscussion(actor, discussionId.slice(0, 64)).catch((e: unknown) => {
        if (e instanceof AppError && e.code === "not_found") return null;
        throw e;
      }),
      listProjectPeople(actor, projectId),
    ]);
    if (!found || found.discussion.projectId !== projectId) {
      return (
        <EmptyState
          icon={MessagesSquare}
          title="Discussion not found"
          description="It may have been deleted."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}?tab=discussions`}>All discussions</Link>
            </Button>
          }
        />
      );
    }
    const { discussion: d, canReply, canDelete } = found;
    return (
      <article className="grid max-w-3xl gap-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`${basePath}?tab=discussions`}>
              <ArrowLeft aria-hidden /> All discussions
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <PersonAvatar name={d.author.name} image={d.author.image} size="default" />
            <div>
              <h2 className="text-xl font-semibold text-brand-ink">{d.title}</h2>
              <p className="text-xs text-muted-foreground">
                {d.author.name} · {formatDateTime(d.createdAt)}
              </p>
            </div>
          </div>
          {canDelete && <DeleteDiscussionButton discussionId={d.id} projectId={projectId} title={d.title} />}
        </header>
        <RichText body={d.body} className="rounded-lg border bg-card p-4" />
        <section aria-label="Replies">
          <h3 className="mb-4 text-sm font-semibold text-brand-ink">
            {d.replies.length} {d.replies.length === 1 ? "reply" : "replies"}
          </h3>
          <DiscussionThread discussionId={d.id} replies={d.replies} people={toPeople(people)} canReply={canReply} />
        </section>
      </article>
    );
  }

  const cursor = cursorOf(sp);
  const [page, people] = await Promise.all([
    listDiscussions(actor, projectId, { limit: 20, cursor }),
    detail.access.contribute ? listProjectPeople(actor, projectId) : Promise.resolve([]),
  ]);
  return (
    <section>
      <SectionHeading
        title="Discussions"
        description="Threaded conversations visible to everyone who can view this project."
        actions={detail.access.contribute ? <NewDiscussionDialog projectId={projectId} people={toPeople(people)} /> : undefined}
      />
      {page.items.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No discussions yet" description={detail.access.contribute ? "Start a discussion to share context or decisions." : undefined} />
      ) : (
        <ul className="grid gap-3">
          {page.items.map((d) => (
            <li key={d.id}>
              <Link
                href={`${basePath}?tab=discussions&discussion=${d.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-medium text-brand-ink">
                    {d.pinned && <Pin className="size-4 text-brand-green" aria-label="Pinned" />}
                    {d.title}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="size-3.5" aria-hidden /> {d._count.replies}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.excerpt}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.author.name} · <RelativeTime value={d.createdAt} />
                  {d.lastReplyAt && (
                    <>
                      {" "}· last reply <RelativeTime value={d.lastReplyAt} />
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Documents ──────────────────────────────────────────────────────────────────

export async function DocumentsTab({ actor, detail, sp, basePath }: Ctx) {
  const projectId = detail.project.id;
  const cursor = cursorOf(sp);
  const page = await listProjectDocuments(actor, projectId, { limit: 50, cursor });
  return (
    <section>
      <SectionHeading
        title="Documents"
        description="Stored privately in this workspace. Downloads are authorised on every request."
        actions={page.canUpload ? <UploadDocumentButton workspaceId={detail.project.organisationId} projectId={projectId} maxMb={env().MAX_UPLOAD_MB} /> : undefined}
      />
      <DocumentsTable documents={page.items} emptyHint={page.canUpload ? "Upload specifications, data extracts or presentations for this project." : "Files shared in this project will appear here."} />
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Members ────────────────────────────────────────────────────────────────────

export async function MembersTab({ actor, detail }: Ctx) {
  const { project, access } = detail;
  const [{ members, ownerId }, people] = await Promise.all([
    listProjectMembers(actor, project.id),
    access.manage ? activePeople(actor, project.organisationId) : Promise.resolve([]),
  ]);
  const memberIds = new Set(members.map((m) => m.user.id));
  const candidates = people.filter((p) => !memberIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, email: p.email }));
  const orgRoleById = new Map(people.map((p) => [p.id, p.orgRole]));
  return (
    <section>
      <SectionHeading
        title="Project members"
        description={
          project.visibility === "PRIVATE"
            ? "This project is private: only these members, the owner and workspace admins can view it."
            : "Every active workspace member can view this project; members below have explicit project roles."
        }
        actions={access.manage ? <AddProjectMemberDialog projectId={project.id} candidates={candidates} /> : undefined}
      />
      {members.length === 0 ? (
        <EmptyState title="No project members" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Project role</TableHead>
                {access.manage && <TableHead className="hidden md:table-cell">Workspace role</TableHead>}
                <TableHead className="hidden md:table-cell">Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const self = m.user.id === actor.user.id;
                const orgRole = orgRoleById.get(m.user.id);
                return (
                  <TableRow key={m.user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Person name={m.user.name} email={m.user.email} image={m.user.image} />
                        {m.user.id === ownerId && <ToneBadge tone="brand">Owner</ToneBadge>}
                        {self && <ToneBadge tone="info">You</ToneBadge>}
                      </div>
                    </TableCell>
                    <TableCell>{PROJECT_ROLE_LABEL[m.role]}</TableCell>
                    {access.manage && (
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {orgRole ? MEMBERSHIP_ROLE_LABEL[orgRole] : <span className="text-warning">No active workspace access</span>}
                      </TableCell>
                    )}
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(m.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <ProjectMemberActions
                        projectId={project.id}
                        member={{ userId: m.user.id, name: m.user.name, role: m.role }}
                        canManage={access.manage}
                        isSelf={self}
                        isOwner={m.user.id === ownerId}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

// ── Activity ───────────────────────────────────────────────────────────────────

export async function ActivityTab({ actor, detail }: Ctx) {
  const page = await listProjectActivity(actor, detail.project.id, { limit: 30 });
  return (
    <section>
      <SectionHeading title="Activity" description="An audit-backed history of changes to this project, newest first." />
      <ActivityFeed projectId={detail.project.id} initial={page.items} initialCursor={page.nextCursor} />
    </section>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────

export async function SettingsTab({ actor, detail }: Ctx) {
  const { project } = detail;
  const people = await activePeople(actor, project.organisationId);
  return (
    <div className="grid gap-10">
      <section>
        <SectionHeading title="Project settings" description="Only project managers, the owner and workspace admins can change these." />
        <ProjectSettingsForm
          project={{
            id: project.id,
            organisationId: project.organisationId,
            name: project.name,
            description: project.description,
            status: project.status,
            visibility: project.visibility,
            kind: project.kind,
            ownerId: project.ownerId,
            startsAt: project.startsAt,
            dueAt: project.dueAt,
          }}
          people={people.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        />
      </section>
      <section className="rounded-lg border border-destructive/30 p-5">
        <h2 className="text-lg font-semibold text-brand-ink">Danger zone</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">Delete this project and all of its tasks, comments, discussions and documents.</p>
          <DeleteProjectButton projectId={project.id} name={project.name} redirectTo={project.kind === "HACKATHON_TEAM" ? "/portal/hackathon" : "/portal/projects"} />
        </div>
      </section>
      {project.kind === "HACKATHON_TEAM" && <Notice>Hackathon teams always stay visible to every employee.</Notice>}
    </div>
  );
}
