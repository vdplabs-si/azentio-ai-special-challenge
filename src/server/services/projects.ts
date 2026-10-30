import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { MembershipRole, ProjectRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, conflict, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { ANONYMOUS, type Actor, type AuthedActor } from "@/lib/authz/actor";
import { assert, canContributeInOrg, isOrgAdmin, isOrgMember, orgRole, projectAccess } from "@/lib/authz/permissions";
import { visibleProjects, visibleTasks } from "@/lib/authz/visibility";
import { isProjectOverdue, progressOf } from "@/components/portal/collab/metrics";
import type { ProjectCreateInput, ProjectListFilters, ProjectUpdateInput } from "@/components/portal/collab/schemas";

// ── Shared access helpers (used by tasks, discussions, documents, mentions) ─────

export const PROJECT_ACCESS_SELECT = {
  id: true,
  name: true,
  kind: true,
  organisationId: true,
  visibility: true,
  ownerId: true,
  hackathonEventId: true,
  members: { select: { userId: true, role: true } },
} satisfies Prisma.ProjectSelect;

export type ProjectAccessRecord = Prisma.ProjectGetPayload<{ select: typeof PROJECT_ACCESS_SELECT }>;
export type ProjectAccess = ReturnType<typeof projectAccess>;

/**
 * projectAccess plus the module rule that hackathon team spaces are employee-only
 * (internal members without a verified employee identity get no access).
 */
export function accessFor(actor: Actor, project: ProjectAccessRecord): ProjectAccess {
  if (project.kind === "HACKATHON_TEAM" && !actor.isEmployee) return { view: false, contribute: false, manage: false };
  return projectAccess(actor, project);
}

/**
 * Load a project the actor may view, with their computed access. Invisible and missing
 * projects are indistinguishable (404) — anti-IDOR.
 */
export async function loadProject(actor: AuthedActor, projectId: string) {
  const project = await db.project.findFirst({
    where: { AND: [{ id: projectId }, visibleProjects(actor)] },
    select: PROJECT_ACCESS_SELECT,
  });
  if (!project) throw notFound("Project not found.");
  const access = accessFor(actor, project);
  if (!access.view) throw notFound("Project not found.");
  return { project, access };
}

/** A minimal Actor for another user, so the same projectAccess rules decide what *they* can see. */
function actorFor(userId: string, organisationId: string, role: MembershipRole): Actor {
  return {
    ...ANONYMOUS,
    user: { id: userId, email: "", name: "", title: null, image: null, emailVerified: true },
    memberships: [{ organisationId, role, organisation: { id: organisationId, name: "", slug: "", type: "CLIENT" } }],
  };
}

const PERSON_SELECT = { id: true, name: true, email: true, image: true } satisfies Prisma.UserSelect;
export type Person = Prisma.UserGetPayload<{ select: typeof PERSON_SELECT }>;

/**
 * Active users (ACTIVE org membership, ACTIVE account) who can view `project`, optionally
 * restricted to `userIds`. Used for assignees, mention resolution and pickers.
 */
export async function projectViewers(project: ProjectAccessRecord, userIds?: string[]) {
  if (userIds && userIds.length === 0) return [] as (Person & { orgRole: MembershipRole })[];
  const memberships = await db.membership.findMany({
    where: {
      organisationId: project.organisationId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    select: { role: true, user: { select: PERSON_SELECT } },
    orderBy: { user: { name: "asc" } },
    take: 2000,
  });
  return memberships
    .filter((m) => projectAccess(actorFor(m.user.id, project.organisationId, m.role), project).view)
    .map((m) => ({ ...m.user, orgRole: m.role }));
}

/** People who can view a project the actor can view (assignee and @mention pickers). */
export async function listProjectPeople(actor: AuthedActor, projectId: string) {
  const { project } = await loadProject(actor, projectId);
  return projectViewers(project);
}

/** Subset of `userIds` who can (still) view the project — use before notifying about its content. */
export async function canStillView(project: ProjectAccessRecord, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [] as string[];
  return (await projectViewers(project, unique)).map((u) => u.id);
}

/** Throws 422 unless `userId` is an ACTIVE member (with an ACTIVE account) of the organisation. */
export async function requireActiveOrgMember(organisationId: string, userId: string, field = "userId") {
  const m = await db.membership.findFirst({
    where: { organisationId, userId, status: "ACTIVE", user: { status: "ACTIVE" } },
    select: { role: true, user: { select: PERSON_SELECT } },
  });
  if (!m) throw new AppError("validation_failed", "That person is not an active member of this workspace.", { [field]: ["Choose an active member of this workspace."] });
  return m;
}

const sameInstant = (a: Date | null | undefined, b: Date | null | undefined) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

export const projectLink = (projectId: string) => `/portal/projects/${projectId}`;

// ── Listing & detail ──────────────────────────────────────────────────────────

const LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  visibility: true,
  kind: true,
  startsAt: true,
  dueAt: true,
  updatedAt: true,
  organisation: { select: { id: true, name: true, type: true } },
  owner: { select: { id: true, name: true } },
  hackathonEvent: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} satisfies Prisma.ProjectSelect;

/** Task totals, done counts and overdue counts for the given (already visible) projects. */
export async function projectTaskStats(actor: AuthedActor, projectIds: string[]) {
  const stats = new Map<string, { total: number; done: number; overdue: number }>();
  for (const id of projectIds) stats.set(id, { total: 0, done: 0, overdue: 0 });
  if (projectIds.length === 0) return stats;
  const scope: Prisma.TaskWhereInput = { AND: [visibleTasks(actor), { projectId: { in: projectIds } }] };
  const [byStatus, overdue] = await Promise.all([
    db.task.groupBy({ by: ["projectId", "status"], where: scope, _count: { _all: true } }),
    db.task.groupBy({
      by: ["projectId"],
      where: { AND: [scope, { dueAt: { lt: new Date() }, status: { not: "DONE" } }] },
      _count: { _all: true },
    }),
  ]);
  for (const row of byStatus) {
    const s = stats.get(row.projectId);
    if (!s) continue;
    s.total += row._count._all;
    if (row.status === "DONE") s.done += row._count._all;
  }
  for (const row of overdue) {
    const s = stats.get(row.projectId);
    if (s) s.overdue = row._count._all;
  }
  return stats;
}

export async function listProjects(actor: AuthedActor, filters: ProjectListFilters) {
  const and: Prisma.ProjectWhereInput[] = [visibleProjects(actor)];
  if (!actor.isEmployee) and.push({ kind: "STANDARD" });
  if (filters.workspaceId) and.push({ organisationId: filters.workspaceId });
  if (filters.status) and.push({ status: filters.status });
  if (filters.kind) and.push({ kind: filters.kind });
  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  const rows = await db.project.findMany({
    where: { AND: and },
    select: LIST_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...pageArgs(filters),
  });
  const page = toPage(rows, filters);
  const stats = await projectTaskStats(actor, page.items.map((p) => p.id));
  const now = new Date();
  return {
    ...page,
    items: page.items.map((p) => {
      const s = stats.get(p.id) ?? { total: 0, done: 0, overdue: 0 };
      return { ...p, progress: progressOf(s.total, s.done), overdueTasks: s.overdue, isOverdue: isProjectOverdue(p, now) };
    }),
  };
}
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>["items"][number];

export async function getProjectDetail(actor: AuthedActor, projectId: string) {
  const { access } = await loadProject(actor, projectId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      ...LIST_SELECT,
      createdAt: true,
      ownerId: true,
      organisationId: true,
      hackathonEventId: true,
      hackathonEvent: { select: { id: true, name: true, registrationOpen: true, endsAt: true } },
      members: {
        select: { role: true, createdAt: true, user: { select: PERSON_SELECT } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  const stats = (await projectTaskStats(actor, [projectId])).get(projectId)!;
  return {
    project: {
      ...project,
      progress: progressOf(stats.total, stats.done),
      overdueTasks: stats.overdue,
      isOverdue: isProjectOverdue(project),
    },
    access,
    myOrgRole: orgRole(actor, project.organisationId),
    myProjectRole: project.members.find((m) => m.user.id === actor.user.id)?.role ?? null,
    isOrgAdmin: isOrgAdmin(actor, project.organisationId),
  };
}
export type ProjectDetail = Awaited<ReturnType<typeof getProjectDetail>>;

// ── Mutations ────────────────────────────────────────────────────────────────

async function requireOpenEvent(eventId: string) {
  const event = await db.hackathonEvent.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Hackathon event not found.");
  if (!event.registrationOpen || event.endsAt < new Date()) throw conflict("Team registration for this event is closed.");
  return event;
}

export async function createProject(actor: AuthedActor, input: ProjectCreateInput) {
  const kind = input.kind ?? "STANDARD";
  let organisationId: string;
  let hackathonEventId: string | null = null;

  if (kind === "HACKATHON_TEAM") {
    // Hackathon team spaces are employee-only and always live in the internal organisation.
    if (!actor.isEmployee) throw notFound();
    const internal = actor.memberships.find((m) => m.organisation.type === "INTERNAL");
    if (!internal) throw notFound();
    if (!input.hackathonEventId) throw new AppError("validation_failed", "Choose a hackathon event.", { hackathonEventId: ["Choose a hackathon event."] });
    await requireOpenEvent(input.hackathonEventId);
    organisationId = internal.organisationId;
    hackathonEventId = input.hackathonEventId;
  } else {
    organisationId = input.workspaceId ?? actor.activeOrganisation?.organisationId ?? "";
    if (!organisationId || !isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  }
  assert(canContributeInOrg(actor, organisationId), "Viewers cannot create projects in this workspace.");

  const ownerId = kind === "HACKATHON_TEAM" ? actor.user.id : (input.ownerId ?? actor.user.id);
  if (ownerId !== actor.user.id) await requireActiveOrgMember(organisationId, ownerId, "ownerId");

  const project = await db.$transaction(async (tx) => {
    const members: { userId: string; role: ProjectRole }[] = [{ userId: ownerId, role: "MANAGER" }];
    if (ownerId !== actor.user.id) members.push({ userId: actor.user.id, role: "MANAGER" });
    const p = await tx.project.create({
      data: {
        organisationId,
        name: input.name,
        description: input.description ?? "",
        kind,
        status: input.status ?? (kind === "HACKATHON_TEAM" ? "ACTIVE" : "PLANNING"),
        visibility: kind === "HACKATHON_TEAM" ? "WORKSPACE" : (input.visibility ?? "WORKSPACE"),
        ownerId,
        hackathonEventId,
        startsAt: toDate(input.startsAt) ?? null,
        dueAt: toDate(input.dueAt) ?? null,
        members: { create: members },
      },
      select: { id: true, name: true, organisationId: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: kind === "HACKATHON_TEAM" ? "hackathon.team.create" : "project.create",
        entityType: "Project",
        entityId: p.id,
        organisationId,
        metadata: { projectId: p.id, kind, ...(hackathonEventId ? { hackathonEventId } : {}) },
      },
      tx,
    );
    if (ownerId !== actor.user.id) {
      await notify(
        {
          userId: ownerId,
          type: "project.owner",
          title: "You own a new project",
          body: `${actor.user.name} created “${p.name}” with you as the owner.`,
          link: projectLink(p.id),
        },
        tx,
      );
    }
    return p;
  });
  return project;
}

export async function updateProject(actor: AuthedActor, projectId: string, input: ProjectUpdateInput) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.manage, "Only project managers can change project settings.");

  const current = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { startsAt: true, dueAt: true, ownerId: true, name: true, description: true, status: true, visibility: true } });
  const startsAt = toDate(input.startsAt);
  const dueAt = toDate(input.dueAt);
  const effStart = startsAt === undefined ? current.startsAt : startsAt;
  const effDue = dueAt === undefined ? current.dueAt : dueAt;
  if (effStart && effDue && effStart > effDue) {
    throw new AppError("validation_failed", "The due date must be on or after the start date.", { dueAt: ["The due date must be on or after the start date."] });
  }
  if (project.kind === "HACKATHON_TEAM" && input.visibility === "PRIVATE") {
    throw new AppError("validation_failed", "Hackathon teams are visible to all employees.", { visibility: ["Hackathon teams stay workspace-visible."] });
  }
  const ownerChanged = input.ownerId !== undefined && input.ownerId !== current.ownerId;
  if (ownerChanged) await requireActiveOrgMember(project.organisationId, input.ownerId!, "ownerId");

  const data: Prisma.ProjectUncheckedUpdateInput = {};
  // Only record fields that actually change (the settings form submits every field).
  if (input.name !== undefined && input.name !== current.name) data.name = input.name;
  if (input.description !== undefined && input.description !== current.description) data.description = input.description;
  if (input.status !== undefined && input.status !== current.status) data.status = input.status;
  if (input.visibility !== undefined && input.visibility !== current.visibility) data.visibility = input.visibility;
  if (ownerChanged) data.ownerId = input.ownerId;
  if (startsAt !== undefined && !sameInstant(startsAt, current.startsAt)) data.startsAt = startsAt;
  if (dueAt !== undefined && !sameInstant(dueAt, current.dueAt)) data.dueAt = dueAt;
  if (Object.keys(data).length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data });
    if (ownerChanged) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: input.ownerId! } },
        update: { role: "MANAGER" },
        create: { projectId, userId: input.ownerId!, role: "MANAGER" },
      });
    }
    await audit(
      {
        actorId: actor.user.id,
        action: "project.update",
        entityType: "Project",
        entityId: projectId,
        organisationId: project.organisationId,
        metadata: { projectId, fields: Object.keys(data), ...(data.status ? { status: String(data.status) } : {}) },
      },
      tx,
    );
    if (ownerChanged && input.ownerId !== actor.user.id) {
      await notify(
        {
          userId: input.ownerId!,
          type: "project.owner",
          title: "Project ownership transferred",
          body: `${actor.user.name} made you the owner of “${input.name ?? current.name}”.`,
          link: projectLink(projectId),
        },
        tx,
      );
    }
  });
}

export async function deleteProject(actor: AuthedActor, projectId: string) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.manage, "Only project managers can delete a project.");
  await db.$transaction(async (tx) => {
    await tx.project.delete({ where: { id: projectId } });
    await audit(
      {
        actorId: actor.user.id,
        action: "project.delete",
        entityType: "Project",
        entityId: projectId,
        organisationId: project.organisationId,
        metadata: { projectId, kind: project.kind },
      },
      tx,
    );
  });
}

// ── Project members ───────────────────────────────────────────────────────────

export async function listProjectMembers(actor: AuthedActor, projectId: string) {
  const { project, access } = await loadProject(actor, projectId);
  const members = await db.projectMember.findMany({
    where: { projectId },
    select: { role: true, createdAt: true, user: { select: PERSON_SELECT } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return { members, ownerId: project.ownerId, access };
}

export async function addProjectMember(actor: AuthedActor, projectId: string, input: { userId: string; role: ProjectRole }) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.manage, "Only project managers can add members.");
  await requireActiveOrgMember(project.organisationId, input.userId);
  if (project.members.some((m) => m.userId === input.userId)) throw conflict("That person is already a project member.");
  const full = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
  await db.$transaction(async (tx) => {
    await tx.projectMember.create({ data: { projectId, userId: input.userId, role: input.role } });
    await audit(
      {
        actorId: actor.user.id,
        action: "project.member.add",
        entityType: "ProjectMember",
        entityId: input.userId,
        organisationId: project.organisationId,
        metadata: { projectId, userId: input.userId, role: input.role },
      },
      tx,
    );
    if (input.userId !== actor.user.id) {
      await notify(
        {
          userId: input.userId,
          type: "project.member_added",
          title: "Added to a project",
          body: `${actor.user.name} added you to “${full.name}” as ${input.role.toLowerCase()}.`,
          link: projectLink(projectId),
        },
        tx,
      );
    }
  });
}

export async function updateProjectMember(actor: AuthedActor, projectId: string, userId: string, role: ProjectRole) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.manage, "Only project managers can change member roles.");
  const existing = project.members.find((m) => m.userId === userId);
  if (!existing) throw notFound("Project member not found.");
  if (userId === project.ownerId && role !== "MANAGER") throw conflict("The project owner is always a manager. Transfer ownership first.");
  if (existing.role === role) return;
  await db.$transaction(async (tx) => {
    await tx.projectMember.update({ where: { projectId_userId: { projectId, userId } }, data: { role } });
    await audit(
      {
        actorId: actor.user.id,
        action: "project.member.update",
        entityType: "ProjectMember",
        entityId: userId,
        organisationId: project.organisationId,
        metadata: { projectId, userId, from: existing.role, to: role },
      },
      tx,
    );
    if (userId !== actor.user.id) {
      await notify(
        {
          userId,
          type: "project.member_role",
          title: "Project role changed",
          body: `${actor.user.name} changed your role in “${project.name}” to ${role.toLowerCase()}.`,
          link: projectLink(projectId),
        },
        tx,
      );
    }
  });
}

/** Managers remove members; any member may remove themselves (leave). The owner cannot be removed. */
export async function removeProjectMember(actor: AuthedActor, projectId: string, userId: string) {
  const { project, access } = await loadProject(actor, projectId);
  const self = userId === actor.user.id;
  assert(self || access.manage, "Only project managers can remove members.");
  if (!project.members.some((m) => m.userId === userId)) throw notFound("Project member not found.");
  if (userId === project.ownerId) throw conflict("The project owner cannot be removed. Transfer ownership first.");
  await db.$transaction(async (tx) => {
    await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    await audit(
      {
        actorId: actor.user.id,
        action: self ? "project.member.leave" : "project.member.remove",
        entityType: "ProjectMember",
        entityId: userId,
        organisationId: project.organisationId,
        metadata: { projectId, userId },
      },
      tx,
    );
    if (!self) {
      await notify(
        {
          userId,
          type: "project.member_removed",
          title: "Removed from a project",
          body: `${actor.user.name} removed you from “${project.name}”.`,
        },
        tx,
      );
    }
  });
}

// ── Activity ──────────────────────────────────────────────────────────────────

const SAFE_META_KEYS = ["from", "to", "role", "status", "fields", "kind", "mimeType", "sizeBytes"] as const;

export async function listProjectActivity(actor: AuthedActor, projectId: string, page: Pagination) {
  const { project } = await loadProject(actor, projectId);
  const rows = await db.auditEvent.findMany({
    where: {
      organisationId: project.organisationId,
      OR: [{ entityType: "Project", entityId: projectId }, { metadata: { path: ["projectId"], equals: projectId } }],
    },
    select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const { items, nextCursor } = toPage(rows, page);

  // Resolve current names live (titles are deliberately never copied into audit metadata).
  const meta = (m: unknown) => (m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
  const ids = (type: string) => [...new Set(items.filter((e) => e.entityType === type && e.entityId).map((e) => e.entityId!))];
  const taskIds = new Set(ids("Task"));
  for (const e of items) if (e.entityType === "TaskComment" && typeof meta(e.metadata).taskId === "string") taskIds.add(meta(e.metadata).taskId as string);
  const userIds = new Set<string>();
  for (const e of items) if (typeof meta(e.metadata).userId === "string") userIds.add(meta(e.metadata).userId as string);

  const [tasks, discussions, documents, users] = await Promise.all([
    taskIds.size ? db.task.findMany({ where: { id: { in: [...taskIds] }, projectId }, select: { id: true, title: true } }) : [],
    ids("Discussion").length ? db.discussion.findMany({ where: { id: { in: ids("Discussion") }, projectId }, select: { id: true, title: true } }) : [],
    ids("Document").length ? db.document.findMany({ where: { id: { in: ids("Document") }, projectId }, select: { id: true, filename: true } }) : [],
    userIds.size ? db.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }) : [],
  ]);
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const discussionTitle = new Map(discussions.map((d) => [d.id, d.title]));
  const docName = new Map(documents.map((d) => [d.id, d.filename]));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  return {
    nextCursor,
    items: items.map((e) => {
      const m = meta(e.metadata);
      let subject: string | null = null;
      if (e.entityType === "Task" && e.entityId) subject = taskTitle.get(e.entityId) ?? null;
      else if (e.entityType === "TaskComment" && typeof m.taskId === "string") subject = taskTitle.get(m.taskId) ?? null;
      else if (e.entityType === "Discussion" && e.entityId) subject = discussionTitle.get(e.entityId) ?? null;
      else if (e.entityType === "Document" && e.entityId) subject = docName.get(e.entityId) ?? null;
      else if (e.entityType === "ProjectMember" && typeof m.userId === "string") subject = userName.get(m.userId) ?? null;
      const details: Record<string, string> = {};
      for (const k of SAFE_META_KEYS) {
        const v = m[k];
        if (typeof v === "string" || typeof v === "number") details[k] = String(v);
        else if (Array.isArray(v)) details[k] = v.filter((x) => typeof x === "string").join(", ");
      }
      return { id: e.id, action: e.action, entityType: e.entityType, createdAt: e.createdAt, actor: e.actor, subject, details };
    }),
  };
}
export type ActivityItem = Awaited<ReturnType<typeof listProjectActivity>>["items"][number];

// ── Hackathon team spaces (employees only) ─────────────────────────────────────

export async function listHackathonEvents(actor: AuthedActor) {
  if (!actor.isEmployee) throw notFound();
  const events = await db.hackathonEvent.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      startsAt: true,
      endsAt: true,
      registrationOpen: true,
      teams: {
        where: { AND: [visibleProjects(actor), { kind: "HACKATHON_TEAM", organisation: { type: "INTERNAL" } }] },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          ownerId: true,
          owner: { select: { id: true, name: true } },
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });
  const now = new Date();
  return events.map((e) => ({
    ...e,
    open: e.registrationOpen && e.endsAt > now,
    teams: e.teams.map(({ members, ...t }) => ({
      ...t,
      memberCount: members.length,
      myRole: members.find((m) => m.userId === actor.user.id)?.role ?? null,
    })),
  }));
}
export type HackathonEventView = Awaited<ReturnType<typeof listHackathonEvents>>[number];

async function loadTeam(actor: AuthedActor, projectId: string) {
  if (!actor.isEmployee) throw notFound();
  const { project, access } = await loadProject(actor, projectId);
  if (project.kind !== "HACKATHON_TEAM") throw notFound("Team not found.");
  return { project, access };
}

export async function joinTeam(actor: AuthedActor, projectId: string) {
  const { project } = await loadTeam(actor, projectId);
  assert(canContributeInOrg(actor, project.organisationId), "Your internal role does not allow joining teams.");
  if (project.hackathonEventId) await requireOpenEvent(project.hackathonEventId);
  if (project.members.some((m) => m.userId === actor.user.id)) throw conflict("You are already on this team.");
  await db.$transaction(async (tx) => {
    await tx.projectMember.create({ data: { projectId, userId: actor.user.id, role: "CONTRIBUTOR" } });
    await audit(
      {
        actorId: actor.user.id,
        action: "hackathon.team.join",
        entityType: "ProjectMember",
        entityId: actor.user.id,
        organisationId: project.organisationId,
        metadata: { projectId, userId: actor.user.id, role: "CONTRIBUTOR" },
      },
      tx,
    );
    if (project.ownerId !== actor.user.id) {
      await notify(
        {
          userId: project.ownerId,
          type: "hackathon.team_joined",
          title: "New team member",
          body: `${actor.user.name} joined your hackathon team “${project.name}”.`,
          link: projectLink(projectId),
        },
        tx,
      );
    }
  });
}

export async function leaveTeam(actor: AuthedActor, projectId: string) {
  await loadTeam(actor, projectId);
  await removeProjectMember(actor, projectId, actor.user.id);
}

/** Unique-constraint violation helper for callers that race on unique keys. */
export const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
