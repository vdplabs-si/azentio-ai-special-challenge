import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ExperimentStatus, IdeaStatus, ObservationStatus, Priority, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import type { AuthedActor } from "@/lib/authz/actor";
import { db } from "@/lib/db";
import { can } from "@/lib/authz/permissions";
import {
  entitledOfferings,
  liveSessionWhere,
  memberOrgIds,
  visibleAnnouncements,
  visibleDiscussions,
  visibleDocuments,
  visibleIdeas,
  visibleObservations,
  visibleProjects,
  visibleTasks,
} from "@/lib/authz/visibility";
import { scenarioWhere } from "@/server/services/playground";
import { canReviewExperiments } from "@/server/services/experiments";
import { unreadCount } from "@/server/services/notifications";

/**
 * Persona-aware dashboard data. Every number here is a live count or list computed under
 * the same visibility builders as the underlying pages — nothing is hardcoded or sampled.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const OPEN_PROJECT: ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD"];
const CLOSED_IDEA: IdeaStatus[] = ["RELEASED", "NOT_PROCEEDING"];
/** Collaboration entity types whose org-level audit events appear in "recent activity". */
const ACTIVITY_TYPES = ["Project", "Task", "Discussion", "Document", "Announcement"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type Persona = "employee" | "client" | "member";

export interface DashboardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | null;
  project: { id: string; name: string };
  overdue: boolean;
  dueSoon: boolean;
}

export interface DashboardProject {
  id: string;
  name: string;
  status: ProjectStatus;
  organisationName: string;
  dueAt: Date | null;
  done: number;
  total: number;
}

export interface ActivityItem {
  id: string;
  createdAt: Date;
  actorName: string;
  byMe: boolean;
  verb: string;
  entityLabel: string;
  entityName: string | null;
  href: string | null;
}

export interface PendingAction {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: "warning" | "info";
}

function startOfToday(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Tasks & projects (both personas) ──────────────────────────────────────

async function myTasks(actor: AuthedActor, now: Date) {
  const soon = new Date(now.getTime() + 7 * DAY_MS);
  const open: Prisma.TaskWhereInput = { AND: [visibleTasks(actor), { assigneeId: actor.user.id, status: { not: "DONE" } }] };
  const [openCount, overdueCount, dueSoonCount, rows] = await Promise.all([
    db.task.count({ where: open }),
    db.task.count({ where: { AND: [open, { dueAt: { lt: now } }] } }),
    db.task.count({ where: { AND: [open, { dueAt: { gte: now, lte: soon } }] } }),
    db.task.findMany({
      where: open,
      select: { id: true, title: true, status: true, priority: true, dueAt: true, project: { select: { id: true, name: true } } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: 60,
    }),
  ]);
  const items: DashboardTask[] = rows
    .map((t) => ({
      ...t,
      overdue: t.dueAt !== null && t.dueAt < now,
      dueSoon: t.dueAt !== null && t.dueAt >= now && t.dueAt <= soon,
    }))
    .sort((a, b) => {
      // Overdue first, then priority, then earliest due date (undated last).
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      const ad = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, 8);
  return { openCount, overdueCount, dueSoonCount, items };
}

async function projectProgress(actor: AuthedActor, kind: "STANDARD" | "HACKATHON_TEAM", take: number) {
  const where: Prisma.ProjectWhereInput = { AND: [visibleProjects(actor), { kind, status: { in: OPEN_PROJECT } }] };
  const [count, rows] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        dueAt: true,
        organisation: { select: { name: true } },
        hackathonEvent: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take,
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [totals, done] = ids.length
    ? await Promise.all([
        db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _count: { _all: true } }),
        db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: "DONE" }, _count: { _all: true } }),
      ])
    : [[], []];
  const totalBy = new Map(totals.map((t) => [t.projectId, t._count._all]));
  const doneBy = new Map(done.map((t) => [t.projectId, t._count._all]));
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    dueAt: r.dueAt,
    organisationName: r.organisation.name,
    eventName: r.hackathonEvent?.name ?? null,
    done: doneBy.get(r.id) ?? 0,
    total: totalBy.get(r.id) ?? 0,
  }));
  return { count, items };
}

// ── Recent activity ───────────────────────────────────────────────────────

const VERBS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  archive: "archived",
  restore: "restored",
  publish: "published",
  upload: "uploaded",
  download: "downloaded",
  comment: "commented on",
  reply: "replied to",
  assign: "assigned",
  complete: "completed",
  status: "changed the status of",
  join: "joined",
  leave: "left",
  pin: "pinned",
  unpin: "unpinned",
  member_add: "added a member to",
  member_remove: "removed a member from",
  member_update: "changed a member role in",
  invite: "sent an invitation for",
  submit: "submitted",
  withdraw: "withdrew",
  run: "ran",
  feedback: "gave feedback on",
  grant: "granted",
  revoke: "revoked",
  approve: "approved",
  reject: "rejected",
  request: "requested",
  review: "reviewed",
  cancel: "cancelled",
};

function humaniseVerb(action: string) {
  const parts = action.split(".");
  const last = parts[parts.length - 1] ?? action;
  const key = parts.length > 2 ? parts.slice(1).join("_") : last;
  return VERBS[key] ?? VERBS[last] ?? last.replace(/[_-]+/g, " ");
}

function humaniseEntity(entityType: string) {
  const spaced = entityType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return /^[aeiou]/.test(spaced) ? `an ${spaced}` : `a ${spaced}`;
}

async function recentActivity(actor: AuthedActor): Promise<ActivityItem[]> {
  const me = actor.user.id;
  const orgIds = memberOrgIds(actor);
  const events = await db.auditEvent.findMany({
    where: {
      OR: [
        { actorId: me },
        ...(orgIds.length ? [{ organisationId: { in: orgIds }, entityType: { in: [...ACTIVITY_TYPES] } }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 40,
    select: { id: true, action: true, entityType: true, entityId: true, organisationId: true, createdAt: true, actorId: true, actor: { select: { name: true } } },
  });

  // Resolve entity names ONLY through the visibility builders. Org-level events about
  // entities the actor cannot see (e.g. a PRIVATE project) are dropped entirely.
  const idsOf = (t: ActivityType) => [...new Set(events.filter((e) => e.entityType === t && e.entityId).map((e) => e.entityId!))];
  const [projects, tasks, discussions, documents, announcements] = await Promise.all([
    idsOf("Project").length
      ? db.project.findMany({ where: { AND: [visibleProjects(actor), { id: { in: idsOf("Project") } }] }, select: { id: true, name: true } })
      : [],
    idsOf("Task").length
      ? db.task.findMany({ where: { AND: [visibleTasks(actor), { id: { in: idsOf("Task") } }] }, select: { id: true, title: true, projectId: true } })
      : [],
    idsOf("Discussion").length
      ? db.discussion.findMany({
          where: { AND: [visibleDiscussions(actor), { id: { in: idsOf("Discussion") } }] },
          select: { id: true, title: true, projectId: true },
        })
      : [],
    idsOf("Document").length
      ? db.document.findMany({
          where: { AND: [visibleDocuments(actor), { id: { in: idsOf("Document") } }] },
          select: { id: true, filename: true, projectId: true, organisationId: true },
        })
      : [],
    idsOf("Announcement").length
      ? db.announcement.findMany({
          where: { AND: [visibleAnnouncements(actor), { id: { in: idsOf("Announcement") } }] },
          select: { id: true, title: true, organisationId: true },
        })
      : [],
  ]);
  const resolved = new Map<string, { name: string; href: string }>();
  for (const p of projects) resolved.set(`Project:${p.id}`, { name: p.name, href: `/portal/projects/${p.id}` });
  for (const t of tasks) resolved.set(`Task:${t.id}`, { name: t.title, href: `/portal/projects/${t.projectId}?tab=tasks&task=${t.id}` });
  for (const d of discussions)
    resolved.set(`Discussion:${d.id}`, { name: d.title, href: `/portal/projects/${d.projectId}?tab=discussions&discussion=${d.id}` });
  for (const d of documents)
    resolved.set(`Document:${d.id}`, {
      name: d.filename,
      href: d.projectId ? `/portal/projects/${d.projectId}?tab=documents` : `/portal/workspaces/${d.organisationId}?tab=documents`,
    });
  for (const a of announcements) resolved.set(`Announcement:${a.id}`, { name: a.title, href: `/portal/workspaces/${a.organisationId}` });

  const items: ActivityItem[] = [];
  for (const e of events) {
    const byMe = e.actorId === me;
    const isCollab = (ACTIVITY_TYPES as readonly string[]).includes(e.entityType);
    const entity = isCollab && e.entityId ? resolved.get(`${e.entityType}:${e.entityId}`) : undefined;
    if (!byMe && !entity) continue; // someone else's event about something I cannot see
    items.push({
      id: e.id,
      createdAt: e.createdAt,
      actorName: byMe ? "You" : (e.actor?.name ?? "A former user"),
      byMe,
      verb: humaniseVerb(e.action),
      entityLabel: humaniseEntity(e.entityType),
      entityName: entity?.name ?? null,
      href: entity?.href ?? null,
    });
    if (items.length >= 10) break;
  }
  return items;
}

// ── Collective learning ───────────────────────────────────────────────────

async function myContributionCounts(actor: AuthedActor) {
  const groups = await db.observation.groupBy({
    by: ["status"],
    where: { AND: [visibleObservations(actor), { authorId: actor.user.id }] },
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ status: g.status as ObservationStatus, count: g._count._all }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function returnedContributions(actor: AuthedActor) {
  const where: Prisma.ObservationWhereInput = { AND: [visibleObservations(actor), { authorId: actor.user.id, status: "RETURNED" }] };
  const [count, items] = await Promise.all([
    db.observation.count({ where }),
    db.observation.findMany({ where, select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 3 }),
  ]);
  return { count, items };
}

async function moderationBacklog(actor: AuthedActor) {
  if (!can.moderateLearning(actor)) return null;
  const [submitted, openReports] = await Promise.all([
    db.observation.count({ where: { AND: [visibleObservations(actor), { status: "SUBMITTED" }] } }),
    db.contributionReport.count({ where: { status: "OPEN" } }),
  ]);
  return { submitted, openReports };
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function getDashboard(actor: AuthedActor) {
  const now = new Date();
  const me = actor.user.id;
  const persona: Persona = actor.isEmployee ? "employee" : actor.memberships.some((m) => m.organisation.type === "CLIENT") ? "client" : "member";
  const participant = can.accessLearning(actor);
  const adminOrgs = actor.memberships.filter((m) => m.role === "OWNER" || m.role === "ADMIN");

  const [tasks, projects, activity, unread, invitations, contributions, returned, upcomingSessions, scenarioCount, scenarios] =
    await Promise.all([
      myTasks(actor, now),
      projectProgress(actor, "STANDARD", 6),
      recentActivity(actor),
      unreadCount(actor),
      adminOrgs.length
        ? db.invitation.groupBy({
            by: ["organisationId"],
            where: { organisationId: { in: adminOrgs.map((m) => m.organisationId) }, status: "PENDING", expiresAt: { gt: now } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      participant ? myContributionCounts(actor) : Promise.resolve([]),
      participant ? returnedContributions(actor) : Promise.resolve({ count: 0, items: [] }),
      db.liveSession.findMany({
        where: { AND: [liveSessionWhere(actor), { OR: [{ status: "LIVE" }, { status: "SCHEDULED", startsAt: { gte: startOfToday(now) } }] }] },
        select: { id: true, title: true, startsAt: true, status: true, audience: true },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: 4,
      }),
      db.playgroundScenario.count({ where: scenarioWhere(actor) }),
      db.playgroundScenario.findMany({
        where: scenarioWhere(actor),
        select: { slug: true, name: true, audience: true, offering: { select: { name: true } } },
        orderBy: [{ offering: { sortOrder: "asc" } }, { name: "asc" }],
        take: 5,
      }),
    ]);

  const pendingInvitations = invitations
    .map((g) => ({
      organisationId: g.organisationId,
      organisationName: adminOrgs.find((m) => m.organisationId === g.organisationId)?.organisation.name ?? "Workspace",
      count: g._count._all,
    }))
    .filter((g) => g.count > 0);

  // Persona-specific blocks.
  let employee: Awaited<ReturnType<typeof employeeBlock>> | null = null;
  let client: Awaited<ReturnType<typeof clientBlock>> | null = null;
  if (persona === "employee") employee = await employeeBlock(actor, now);
  else client = await clientBlock(actor, participant);

  const pending: PendingAction[] = [];
  if (returned.count > 0)
    pending.push({
      key: "returned",
      label: returned.count === 1 ? "Contribution returned for clarification" : "Contributions returned for clarification",
      count: returned.count,
      href: returned.items.length === 1 ? `/portal/observations/${returned.items[0]!.id}` : "/portal/observations",
      tone: "warning",
    });
  for (const inv of pendingInvitations)
    pending.push({
      key: `inv:${inv.organisationId}`,
      label: `Pending invitations · ${inv.organisationName}`,
      count: inv.count,
      href: `/portal/workspaces/${inv.organisationId}?tab=invitations`,
      tone: "info",
    });
  if (employee?.moderation && employee.moderation.submitted + employee.moderation.openReports > 0)
    pending.push({
      key: "moderation",
      label: "Moderation backlog (submissions + open reports)",
      count: employee.moderation.submitted + employee.moderation.openReports,
      href: "/portal/moderation",
      tone: "warning",
    });
  if (employee?.experimentsAwaitingReview)
    pending.push({
      key: "experiments",
      label: "Experiments awaiting review",
      count: employee.experimentsAwaitingReview,
      href: "/portal/experiments?status=SUBMITTED",
      tone: "info",
    });
  if (unread > 0) pending.push({ key: "unread", label: "Unread notifications", count: unread, href: "/portal/notifications", tone: "info" });

  const summary = buildSummary({
    openTasks: tasks.openCount,
    overdue: tasks.overdueCount,
    dueSoon: tasks.dueSoonCount,
    activeProjects: projects.count,
    unread,
    returned: returned.count,
    invitations: pendingInvitations.reduce((s, i) => s + i.count, 0),
    moderation: employee?.moderation ? employee.moderation.submitted + employee.moderation.openReports : null,
    entitledOfferings: client ? client.offerings.length : null,
    upcomingSessions: upcomingSessions.length,
  });

  return {
    persona,
    now,
    summary,
    tasks,
    projects,
    activity,
    unread,
    pending,
    contributions,
    returned,
    upcomingSessions,
    scenarios: { count: scenarioCount, items: scenarios },
    employee,
    client,
    isParticipant: participant,
    userId: me,
  };
}

async function employeeBlock(actor: AuthedActor, now: Date) {
  const me = actor.user.id;
  const reviewer = canReviewExperiments(actor);
  const [assignedIdeas, assignedIdeaCount, hackathon, moderation, myExperiments, experimentsAwaitingReview, internalSessions] = await Promise.all([
    db.improvementIdea.findMany({
      where: { AND: [visibleIdeas(actor), { ownerId: me, status: { notIn: CLOSED_IDEA } }] },
      select: { id: true, title: true, status: true, priority: true, updatedAt: true, offering: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 5,
    }),
    db.improvementIdea.count({ where: { AND: [visibleIdeas(actor), { ownerId: me, status: { notIn: CLOSED_IDEA } }] } }),
    projectProgress(actor, "HACKATHON_TEAM", 4),
    moderationBacklog(actor),
    db.experiment.groupBy({ by: ["status"], where: { authorId: me }, _count: { _all: true } }),
    reviewer ? db.experiment.count({ where: { status: "SUBMITTED", authorId: { not: me } } }) : Promise.resolve(0),
    db.liveSession.count({
      where: { AND: [liveSessionWhere(actor), { audience: "EMPLOYEE" }, { OR: [{ status: "LIVE" }, { status: "SCHEDULED", startsAt: { gte: startOfToday(now) } }] }] },
    }),
  ]);
  const experiments = myExperiments.map((g) => ({ status: g.status as ExperimentStatus, count: g._count._all }));
  return {
    assignedIdeas,
    assignedIdeaCount,
    hackathon,
    moderation,
    experiments,
    experimentTotal: experiments.reduce((s, e) => s + e.count, 0),
    experimentsAwaitingReview,
    internalSessions,
  };
}

async function clientBlock(actor: AuthedActor, participant: boolean) {
  const org = actor.activeOrganisation;
  const [offerings, ideas] = await Promise.all([
    org && org.organisation.type === "CLIENT"
      ? db.offering.findMany({
          where: entitledOfferings(actor),
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            summary: true,
            sandbox: true,
            entitlements: { where: { organisationId: org.organisationId }, select: { expiresAt: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    participant
      ? db.improvementIdea.findMany({
          // Clients see only ideas shared with participants, and only audience-appropriate fields.
          where: visibleIdeas(actor),
          select: { id: true, title: true, status: true, publicStatusNote: true, updatedAt: true, offering: { select: { name: true } } },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: 5,
        })
      : Promise.resolve([]),
  ]);
  return {
    offerings: offerings.map(({ entitlements, ...o }) => ({ ...o, expiresAt: entitlements[0]?.expiresAt ?? null })),
    ideas,
  };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Deterministic one-paragraph summary built only from the computed counts. */
export function buildSummary(n: {
  openTasks: number;
  overdue: number;
  dueSoon: number;
  activeProjects: number;
  unread: number;
  returned: number;
  invitations: number;
  moderation: number | null;
  entitledOfferings: number | null;
  upcomingSessions: number;
}) {
  const parts: string[] = [];
  if (n.openTasks === 0) parts.push("You have no open tasks assigned to you");
  else {
    const detail: string[] = [];
    if (n.overdue) detail.push(`${n.overdue} overdue`);
    if (n.dueSoon) detail.push(`${n.dueSoon} due in the next 7 days`);
    parts.push(`You have ${plural(n.openTasks, "open task")}${detail.length ? ` (${detail.join(", ")})` : ""}`);
  }
  parts[0] += n.activeProjects ? ` across ${plural(n.activeProjects, "active project")} you can see.` : " and no active projects yet.";
  if (n.returned) parts.push(`${plural(n.returned, "contribution")} ${n.returned === 1 ? "needs" : "need"} amendment.`);
  if (n.invitations) parts.push(`${plural(n.invitations, "workspace invitation")} ${n.invitations === 1 ? "is" : "are"} pending.`);
  if (n.moderation !== null && n.moderation > 0) parts.push(`${plural(n.moderation, "item")} ${n.moderation === 1 ? "awaits" : "await"} moderation.`);
  if (n.entitledOfferings !== null)
    parts.push(
      n.entitledOfferings
        ? `Your active workspace is entitled to ${plural(n.entitledOfferings, "offering")}.`
        : "Your active workspace has no product entitlements yet.",
    );
  if (n.upcomingSessions) parts.push(`${plural(n.upcomingSessions, "live session")} ${n.upcomingSessions === 1 ? "is" : "are"} coming up.`);
  parts.push(n.unread ? `${plural(n.unread, "unread notification")}.` : "No unread notifications.");
  return parts.join(" ");
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
