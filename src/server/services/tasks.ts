import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert } from "@/lib/authz/permissions";
import { visibleTasks } from "@/lib/authz/visibility";
import { isTaskOverdue, nextCompletedAt } from "@/components/portal/collab/metrics";
import { TASK_STATUS_LABEL } from "@/components/portal/collab/labels";
import type { CommentCreateInput, TaskCreateInput, TaskListFilters, TaskSort, TaskUpdateInput } from "@/components/portal/collab/schemas";
import { accessFor, canStillView, loadProject, PROJECT_ACCESS_SELECT, projectViewers, type ProjectAccessRecord } from "@/server/services/projects";
import { recordMentions, resolveMentions } from "@/server/services/mentions";

export const taskLink = (projectId: string, taskId: string) => `/portal/projects/${projectId}?tab=tasks&task=${taskId}`;

const TASK_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

function filterWhere(actor: AuthedActor, f: Partial<TaskListFilters>): Prisma.TaskWhereInput[] {
  const and: Prisma.TaskWhereInput[] = [];
  if (f.status === "OPEN") and.push({ status: { not: "DONE" } });
  else if (f.status) and.push({ status: f.status });
  if (f.priority) and.push({ priority: f.priority });
  if (f.assignee === "me") and.push({ assigneeId: actor.user.id });
  else if (f.assignee === "none") and.push({ assigneeId: null });
  else if (f.assignee) and.push({ assigneeId: f.assignee });
  if (f.overdue) and.push({ dueAt: { lt: new Date() }, status: { not: "DONE" } });
  if (f.q) {
    and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }] });
  }
  return and;
}

function orderFor(sort: TaskSort | undefined): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case "priority":
      return [{ priority: "desc" }, { dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "due":
      return [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { id: "asc" }];
    case "created":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "updated":
    default:
      return [{ updatedAt: "desc" }, { id: "desc" }];
  }
}

const withOverdue = <T extends { dueAt: Date | null; status: string }>(t: T, now = new Date()) => ({ ...t, isOverdue: isTaskOverdue(t, now) });

export async function listProjectTasks(actor: AuthedActor, projectId: string, filters: TaskListFilters) {
  await loadProject(actor, projectId);
  const rows = await db.task.findMany({
    where: { AND: [visibleTasks(actor), { projectId }, ...filterWhere(actor, filters)] },
    select: TASK_SELECT,
    orderBy: orderFor(filters.sort ?? "priority"),
    ...pageArgs(filters),
  });
  const page = toPage(rows, filters);
  const now = new Date();
  return { ...page, items: page.items.map((t) => withOverdue(t, now)) };
}
export type TaskRow = Awaited<ReturnType<typeof listProjectTasks>>["items"][number];

/** "My tasks": tasks assigned to the actor across every project they can still view. */
export async function listMyTasks(actor: AuthedActor, filters: TaskListFilters) {
  const rows = await db.task.findMany({
    where: { AND: [visibleTasks(actor), { assigneeId: actor.user.id }, ...filterWhere(actor, { ...filters, assignee: undefined })] },
    select: {
      ...TASK_SELECT,
      project: { select: { ...PROJECT_ACCESS_SELECT, status: true, organisation: { select: { id: true, name: true } } } },
    },
    orderBy: orderFor(filters.sort ?? "priority"),
    ...pageArgs(filters),
  });
  const page = toPage(rows, filters);
  const now = new Date();
  return {
    ...page,
    items: page.items.map(({ project, ...t }) => ({
      ...withOverdue(t, now),
      canContribute: accessFor(actor, project).contribute,
      project: { id: project.id, name: project.name, status: project.status, kind: project.kind, organisation: project.organisation },
    })),
  };
}
export type MyTaskRow = Awaited<ReturnType<typeof listMyTasks>>["items"][number];

/** Summary counts for the actor's assigned, visible, open tasks. */
export async function myTaskCounts(actor: AuthedActor) {
  const base: Prisma.TaskWhereInput = { AND: [visibleTasks(actor), { assigneeId: actor.user.id }, { status: { not: "DONE" } }] };
  const [open, overdue, urgent] = await Promise.all([
    db.task.count({ where: base }),
    db.task.count({ where: { AND: [base, { dueAt: { lt: new Date() } }] } }),
    db.task.count({ where: { AND: [base, { priority: "URGENT" }] } }),
  ]);
  return { open, overdue, urgent };
}

async function loadTask(actor: AuthedActor, taskId: string) {
  const task = await db.task.findFirst({
    where: { AND: [{ id: taskId }, visibleTasks(actor)] },
    select: { ...TASK_SELECT, assigneeId: true, project: { select: PROJECT_ACCESS_SELECT } },
  });
  if (!task) throw notFound("Task not found.");
  const access = accessFor(actor, task.project);
  if (!access.view) throw notFound("Task not found.");
  return { task, access };
}

export async function getTask(actor: AuthedActor, taskId: string) {
  const { task, access } = await loadTask(actor, taskId);
  const { project, ...rest } = task;
  return { task: withOverdue(rest), project: { id: project.id, name: project.name, organisationId: project.organisationId }, access };
}

async function requireAssignable(project: ProjectAccessRecord, assigneeId: string) {
  const [viewer] = await projectViewers(project, [assigneeId]);
  if (!viewer) {
    throw new AppError("validation_failed", "Tasks can only be assigned to active workspace members who can view this project.", {
      assigneeId: ["Choose someone who can view this project."],
    });
  }
  return viewer;
}

const sameInstant = (a: Date | null | undefined, b: Date | null | undefined) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

export async function createTask(actor: AuthedActor, projectId: string, input: TaskCreateInput) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.contribute, "You cannot add tasks to this project.");
  if (input.assigneeId) await requireAssignable(project, input.assigneeId);
  const status = input.status ?? "TODO";
  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        projectId,
        title: input.title,
        description: input.description ?? "",
        status,
        priority: input.priority ?? "MEDIUM",
        assigneeId: input.assigneeId ?? null,
        createdById: actor.user.id,
        dueAt: toDate(input.dueAt) ?? null,
        completedAt: nextCompletedAt(status, null),
      },
      select: { id: true, title: true },
    });
    await audit(
      { actorId: actor.user.id, action: "task.create", entityType: "Task", entityId: task.id, organisationId: project.organisationId, metadata: { projectId, status } },
      tx,
    );
    if (input.assigneeId && input.assigneeId !== actor.user.id) {
      await notify(
        {
          userId: input.assigneeId,
          type: "task.assigned",
          title: "New task assigned to you",
          body: `${actor.user.name} assigned you “${task.title}” in ${project.name}.`,
          link: taskLink(projectId, task.id),
        },
        tx,
      );
    }
    return task;
  });
}

export async function updateTask(actor: AuthedActor, taskId: string, input: TaskUpdateInput) {
  const { task, access } = await loadTask(actor, taskId);
  assert(access.contribute, "You cannot edit tasks in this project.");
  const project = task.project;
  const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== task.assigneeId;
  if (assigneeChanged && input.assigneeId) await requireAssignable(project, input.assigneeId);
  const statusChanged = input.status !== undefined && input.status !== task.status;

  const data: Prisma.TaskUncheckedUpdateInput = {};
  // Only record fields that actually change (forms submit every field).
  if (input.title !== undefined && input.title !== task.title) data.title = input.title;
  if (input.description !== undefined && input.description !== task.description) data.description = input.description;
  if (input.priority !== undefined && input.priority !== task.priority) data.priority = input.priority;
  if (input.dueAt !== undefined && !sameInstant(toDate(input.dueAt), task.dueAt)) data.dueAt = toDate(input.dueAt);
  if (assigneeChanged) data.assigneeId = input.assigneeId;
  if (statusChanged) {
    data.status = input.status;
    data.completedAt = nextCompletedAt(input.status!, task.completedAt);
  }
  if (Object.keys(data).length === 0) return;

  const title = input.title ?? task.title;
  const currentAssignee = assigneeChanged ? input.assigneeId : task.assigneeId;
  // Status changes by someone else notify the assignee (unless they were just assigned) — only if they can still view it.
  const notifyStatus =
    statusChanged && currentAssignee && currentAssignee !== actor.user.id && !assigneeChanged
      ? (await canStillView(project, [currentAssignee])).length > 0
      : false;
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data });
    await audit(
      {
        actorId: actor.user.id,
        action: statusChanged && Object.keys(data).length <= 2 ? "task.status_change" : "task.update",
        entityType: "Task",
        entityId: taskId,
        organisationId: project.organisationId,
        metadata: {
          projectId: project.id,
          fields: Object.keys(data).filter((k) => k !== "completedAt"),
          ...(statusChanged ? { from: task.status, to: input.status! } : {}),
        },
      },
      tx,
    );
    if (assigneeChanged && input.assigneeId && input.assigneeId !== actor.user.id) {
      await notify(
        {
          userId: input.assigneeId,
          type: "task.assigned",
          title: "Task assigned to you",
          body: `${actor.user.name} assigned you “${title}” in ${project.name}.`,
          link: taskLink(project.id, taskId),
        },
        tx,
      );
    }
    if (notifyStatus && currentAssignee) {
      await notify(
        {
          userId: currentAssignee,
          type: "task.status_changed",
          title: "Task status changed",
          body: `${actor.user.name} moved “${title}” to ${TASK_STATUS_LABEL[input.status!] ?? input.status}.`,
          link: taskLink(project.id, taskId),
        },
        tx,
      );
    }
  });
}

export async function deleteTask(actor: AuthedActor, taskId: string) {
  const { task, access } = await loadTask(actor, taskId);
  assert(access.contribute, "You cannot delete tasks in this project.");
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await audit(
      { actorId: actor.user.id, action: "task.delete", entityType: "Task", entityId: taskId, organisationId: task.project.organisationId, metadata: { projectId: task.project.id } },
      tx,
    );
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────

const COMMENT_SELECT = {
  id: true,
  body: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.TaskCommentSelect;

/** Top-level comments (oldest first) with one level of replies. Inherits the task's audience. */
export async function listComments(actor: AuthedActor, taskId: string, page: Pagination) {
  const { access } = await loadTask(actor, taskId);
  const rows = await db.taskComment.findMany({
    where: { taskId, parentId: null },
    select: { ...COMMENT_SELECT, replies: { select: COMMENT_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...pageArgs(page),
  });
  return { ...toPage(rows, page), canComment: access.contribute };
}
export type CommentThread = Awaited<ReturnType<typeof listComments>>["items"][number];

export async function createComment(actor: AuthedActor, taskId: string, input: CommentCreateInput) {
  const { task, access } = await loadTask(actor, taskId);
  assert(access.contribute, "You cannot comment on tasks in this project.");
  await rateLimit(`comment:${actor.user.id}`, 30, 60);
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await db.taskComment.findFirst({ where: { id: input.parentId, taskId }, select: { id: true, parentId: true } });
    if (!parent) throw new AppError("validation_failed", "The comment you replied to no longer exists.", { parentId: ["Not found."] });
    parentId = parent.parentId ?? parent.id; // one reply level: replies to replies attach to the thread root
  }
  const { body, userIds } = await resolveMentions(task.project, input.body, actor.user.id);
  const link = taskLink(task.project.id, taskId);
  const notifyAssignee =
    task.assigneeId && task.assigneeId !== actor.user.id && !userIds.includes(task.assigneeId)
      ? (await canStillView(task.project, [task.assigneeId])).length > 0
      : false;
  return db.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({ data: { taskId, authorId: actor.user.id, parentId, body }, select: COMMENT_SELECT });
    await audit(
      {
        actorId: actor.user.id,
        action: "task.comment.create",
        entityType: "TaskComment",
        entityId: comment.id,
        organisationId: task.project.organisationId,
        metadata: { projectId: task.project.id, taskId },
      },
      tx,
    );
    await recordMentions({ userIds, sourceType: "task_comment", sourceId: comment.id, authorName: actor.user.name, context: `a comment on “${task.title}”`, link }, tx);
    if (notifyAssignee && task.assigneeId) {
      await notify(
        { userId: task.assigneeId, type: "task.comment", title: "New comment on your task", body: `${actor.user.name} commented on “${task.title}”.`, link },
        tx,
      );
    }
    return comment;
  });
}
