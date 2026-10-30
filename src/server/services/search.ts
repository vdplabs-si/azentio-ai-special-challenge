import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthedActor } from "@/lib/authz/actor";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  contentAudienceWhere,
  liveSessionWhere,
  memberOrgIds,
  sharedFeedWhere,
  visibleDocuments,
  visibleIdeas,
  visibleObservations,
  visibleProjects,
  visibleTasks,
  visibleThemes,
} from "@/lib/authz/visibility";

/**
 * Global portal search. Each resource type is queried under its own visibility builder,
 * with explicit `select`s so private fields (e.g. SharedObservation.sourceObservationId,
 * idea internal notes/priority) can never leak into results.
 */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Keep searches under 100 characters."),
});

export const SEARCH_GROUPS = [
  "projects",
  "tasks",
  "documents",
  "observations",
  "shared",
  "themes",
  "ideas",
  "content",
  "sessions",
] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export interface SearchHit {
  id: string;
  title: string;
  href: string;
  meta: string[];
}

const PER_GROUP = 8;

const has = (q: string) => ({ contains: q, mode: "insensitive" as const });

function label(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export async function search(actor: AuthedActor, rawQuery: string) {
  const { q } = searchQuerySchema.parse({ q: rawQuery });
  await rateLimit(`search:${actor.user.id}`, 30, 60);
  const me = actor.user.id;
  const employee = actor.isEmployee;

  // Observations: own or explicitly org-shared sources only (title match), intersected with
  // the canonical private-source rule. Moderator/support access is not a search surface.
  const ownOrOrg: Prisma.ObservationWhereInput = {
    OR: [{ authorId: me }, { orgVisible: true, organisationId: { in: memberOrgIds(actor) } }],
  };

  const [projects, tasks, documents, observations, shared, themes, ideas, content, sessions] = await Promise.all([
    db.project.findMany({
      where: { AND: [visibleProjects(actor), { OR: [{ name: has(q) }, { description: has(q) }] }] },
      select: { id: true, name: true, status: true, kind: true, organisation: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.task.findMany({
      where: { AND: [visibleTasks(actor), { title: has(q) }] },
      select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.document.findMany({
      where: { AND: [visibleDocuments(actor), { filename: has(q) }] },
      select: { id: true, filename: true, projectId: true, organisationId: true, createdAt: true, project: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.observation.findMany({
      where: { AND: [visibleObservations(actor), ownOrOrg, { title: has(q) }] },
      select: { id: true, title: true, status: true, authorId: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.sharedObservation.findMany({
      where: { AND: [sharedFeedWhere(actor), { OR: [{ title: has(q) }, { body: has(q) }, { topics: { has: q.toLowerCase() } }] }] },
      // Explicit allow-list: NEVER select sourceObservationId or attribution internals.
      select: { id: true, title: true, type: true, periodLabel: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.theme.findMany({
      where: { AND: [visibleThemes(actor), { OR: [{ title: has(q) }, { summary: has(q) }] }] },
      select: { id: true, title: true, status: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.improvementIdea.findMany({
      where: { AND: [visibleIdeas(actor), employee ? { OR: [{ title: has(q) }, { problemStatement: has(q) }] } : { title: has(q) }] },
      // Clients get title/status only; employees additionally see the offering name.
      select: { id: true, title: true, status: true, ...(employee ? { offering: { select: { name: true } } } : {}) },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.contentItem.findMany({
      where: { AND: [contentAudienceWhere(actor), { OR: [{ title: has(q) }, { summary: has(q) }] }] },
      select: { id: true, slug: true, title: true, type: true, publishedAt: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      take: PER_GROUP,
    }),
    db.liveSession.findMany({
      where: { AND: [liveSessionWhere(actor), { OR: [{ title: has(q) }, { description: has(q) }] }] },
      select: { id: true, title: true, status: true, startsAt: true },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      take: PER_GROUP,
    }),
  ]);

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const groups: Record<SearchGroup, SearchHit[]> = {
    projects: projects.map((p) => ({
      id: p.id,
      title: p.name,
      href: `/portal/projects/${p.id}`,
      meta: [p.organisation.name, label(p.status), ...(p.kind === "HACKATHON_TEAM" ? ["Hackathon team"] : [])],
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      href: `/portal/projects/${t.projectId}?tab=tasks&task=${t.id}`,
      meta: [t.project.name, label(t.status)],
    })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.filename,
      href: d.projectId ? `/portal/projects/${d.projectId}?tab=documents` : `/portal/workspaces/${d.organisationId}?tab=documents`,
      meta: [d.project?.name ?? "Workspace document", `Uploaded ${fmtDate(d.createdAt)}`],
    })),
    observations: observations.map((o) => ({
      id: o.id,
      title: o.title,
      href: `/portal/observations/${o.id}`,
      meta: [o.authorId === me ? "Your contribution" : "Shared within your organisation", label(o.status)],
    })),
    shared: shared.map((s) => ({
      id: s.id,
      title: s.title,
      href: `/portal/learning/${s.id}`,
      meta: [label(s.type), s.periodLabel],
    })),
    themes: themes.map((t) => ({
      id: t.id,
      title: t.title,
      href: `/portal/themes/${t.id}`,
      meta: employee ? [label(t.status)] : [],
    })),
    ideas: ideas.map((i) => {
      const offering = (i as { offering?: { name: string } }).offering;
      return { id: i.id, title: i.title, href: `/portal/ideas/${i.id}`, meta: [label(i.status), ...(offering ? [offering.name] : [])] };
    }),
    content: content.map((c) => ({
      id: c.id,
      title: c.title,
      href: `/portal/knowledge/${c.slug}`,
      meta: [label(c.type), ...(c.publishedAt ? [`Published ${fmtDate(c.publishedAt)}`] : [])],
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      href: `/portal/live/${s.id}`,
      meta: [label(s.status), fmtDate(s.startsAt)],
    })),
  };
  const total = SEARCH_GROUPS.reduce((n, g) => n + groups[g].length, 0);
  return { query: q, groups, total, perGroupLimit: PER_GROUP };
}

export type SearchResult = Awaited<ReturnType<typeof search>>;
