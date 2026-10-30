import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { FeedbackKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { rateLimit } from "@/lib/api/rate-limit";
import { conflict, notFound } from "@/lib/api/errors";
import type { AuthedActor, Actor } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { contentAudienceWhere, sharedFeedWhere } from "@/lib/authz/visibility";
import { sharedSelect, sharedToCsv, toCommentDTO, toSharedDTO, type SharedDTO } from "@/server/learning/dto";
import { buildFacet, suppressIfBelow, type CohortValue, type FacetBucket } from "@/server/learning/cohort";
import { sharedFiltersSchema, type SharedFilters } from "@/server/learning/schemas";
import { industryLabel, OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import { assertParticipant, employeeProbeSelect, isEmployeeRecord, learningMinCohort, moderatorUserIds } from "@/server/learning/guard";

const FACET_ROW_CAP = 10_000;
const EXPORT_CAP = 5_000;

/** Translate validated filters into a Prisma where (always AND-ed with sharedFeedWhere). */
export function filterWhere(f: SharedFilters = {}): Prisma.SharedObservationWhereInput {
  const and: Prisma.SharedObservationWhereInput[] = [];
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { body: { contains: f.q, mode: "insensitive" } }] });
  if (f.offering) and.push({ offering: { slug: f.offering } });
  if (f.industry) and.push({ industry: f.industry });
  if (f.region) and.push({ region: f.region });
  if (f.type) and.push({ type: f.type });
  if (f.topic) and.push({ topics: { has: f.topic.toLowerCase() } });
  if (f.periodFrom) and.push({ periodStart: { gte: new Date(`${f.periodFrom}T00:00:00.000Z`) } });
  if (f.periodTo) and.push({ periodStart: { lte: new Date(`${f.periodTo}T23:59:59.999Z`) } });
  return and.length ? { AND: and } : {};
}

/** The single where clause used for records, counts, facets, saved searches and export. */
export const sharedWhere = (actor: Actor, f: SharedFilters = {}): Prisma.SharedObservationWhereInput => ({
  AND: [sharedFeedWhere(actor), filterWhere(f)],
});

/**
 * Live search over approved shared copies (used by AIRA and other modules).
 * Returns DTOs only — never the private source or tenant identifiers.
 */
export async function searchSharedObservations(
  actor: Actor,
  { q, limit = 10, filters }: { q?: string; limit?: number; filters?: SharedFilters } = {},
): Promise<{ items: SharedDTO[]; total: number }> {
  const f = sharedFiltersSchema.parse({ ...(filters ?? {}), ...(q ? { q } : {}) });
  const where = sharedWhere(actor, f);
  const take = Math.min(Math.max(1, Math.floor(limit)), 50);
  const [rows, total] = await Promise.all([
    db.sharedObservation.findMany({ where, select: sharedSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take }),
    db.sharedObservation.count({ where }),
  ]);
  return { items: rows.map(toSharedDTO), total };
}

export interface SharedFacets {
  type: FacetBucket[];
  region: FacetBucket[];
  industry: FacetBucket[];
  offering: FacetBucket[];
  topic: FacetBucket[];
  /** Distinct contributing organisations across the whole result set (suppressed below the minimum). */
  organisations: CohortValue;
  minCohort: number;
}

/** Facet counts computed with the SAME where clause; buckets below the cohort minimum are suppressed. */
export async function sharedFacets(actor: Actor, f: SharedFilters): Promise<SharedFacets> {
  const min = learningMinCohort();
  const rows = await db.sharedObservation.findMany({
    where: sharedWhere(actor, f),
    take: FACET_ROW_CAP,
    // Organisation ids are read server-side only to count DISTINCT contributors; they never leave this function.
    select: { type: true, region: true, industry: true, topics: true, offering: { select: { slug: true, name: true } }, source: { select: { organisationId: true } } },
  });
  const offeringNames = new Map<string, string>();
  for (const r of rows) if (r.offering) offeringNames.set(r.offering.slug, r.offering.name);
  const facet = (keys: (r: (typeof rows)[number]) => string[], label?: (v: string) => string) =>
    buildFacet(rows.map((r) => ({ keys: keys(r), org: r.source.organisationId })), min, label);
  const orgs = suppressIfBelow(new Set(rows.map((r) => r.source.organisationId)).size, min);
  return {
    type: facet((r) => [r.type], (v) => OBSERVATION_TYPE_LABELS[v as keyof typeof OBSERVATION_TYPE_LABELS] ?? v),
    region: facet((r) => [r.region]),
    industry: facet((r) => [r.industry], industryLabel),
    offering: facet((r) => (r.offering ? [r.offering.slug] : []), (v) => offeringNames.get(v) ?? v),
    topic: facet((r) => r.topics).slice(0, 30),
    organisations: orgs,
    minCohort: min,
  };
}

/** Paginated approved feed + facets for /portal/learning and GET /api/v1/shared-observations. */
export async function listSharedFeed(actor: AuthedActor, query: SharedFilters & { page: number; pageSize: number }) {
  assertParticipant(actor);
  const { page, pageSize, ...filters } = query;
  const where = sharedWhere(actor, filters);
  const [rows, total, facets] = await Promise.all([
    db.sharedObservation.findMany({
      where,
      select: sharedSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.sharedObservation.count({ where }),
    sharedFacets(actor, filters),
  ]);
  return { items: rows.map(toSharedDTO), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), facets };
}

async function loadVisibleShared(actor: AuthedActor, id: string) {
  assertParticipant(actor);
  const row = await db.sharedObservation.findFirst({ where: { AND: [{ id }, sharedFeedWhere(actor)] }, select: sharedSelect });
  if (!row) throw notFound();
  return row;
}

async function feedbackCounts(sharedObservationId: string) {
  const groups = await db.observationFeedback.groupBy({ by: ["kind"], where: { sharedObservationId }, _count: { _all: true } });
  const counts: Record<FeedbackKind, number> = { USEFUL: 0, NEEDS_EVIDENCE: 0 };
  for (const g of groups) counts[g.kind] = g._count._all;
  return counts;
}

/** Shared copy detail: DTO + aggregate feedback, the viewer's own feedback/bookmark and comments. */
export async function getSharedDetail(actor: AuthedActor, id: string) {
  const row = await loadVisibleShared(actor, id);
  const [counts, mine, bookmark, comments, myOpenReport] = await Promise.all([
    feedbackCounts(id),
    db.observationFeedback.findUnique({ where: { sharedObservationId_userId: { sharedObservationId: id, userId: actor.user.id } }, select: { kind: true } }),
    db.bookmark.findUnique({ where: { userId_sharedObservationId: { userId: actor.user.id, sharedObservationId: id } }, select: { id: true } }),
    listComments(actor, id),
    db.contributionReport.count({ where: { sharedObservationId: id, reporterId: actor.user.id, status: "OPEN" } }),
  ]);
  return {
    item: toSharedDTO(row),
    feedback: { counts, mine: mine?.kind ?? null },
    bookmarkId: bookmark?.id ?? null,
    comments,
    hasOpenReport: myOpenReport > 0,
    canModerate: can.moderateLearning(actor),
  };
}
export type SharedDetail = Awaited<ReturnType<typeof getSharedDetail>>;

/** CSV export with the same visibility and filters as the feed — DTO fields only. */
export async function exportSharedCsv(actor: AuthedActor, filters: SharedFilters) {
  assertParticipant(actor);
  await rateLimit(`learning:export:${actor.user.id}`, 20, 3600);
  const rows = await db.sharedObservation.findMany({
    where: sharedWhere(actor, filters),
    select: sharedSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: EXPORT_CAP,
  });
  const items = rows.map(toSharedDTO);
  await audit({
    actorId: actor.user.id,
    action: "shared_observation.export",
    entityType: "SharedObservation",
    metadata: { count: items.length, filters: JSON.parse(JSON.stringify(filters)) as Prisma.InputJsonValue },
  });
  return { csv: sharedToCsv(items), count: items.length, truncated: items.length === EXPORT_CAP };
}

// ── Reports ──────────────────────────────────────────────────────────────

/** Any learning participant can report a shared copy. The reporter is never disclosed to the contributor. */
export async function reportShared(actor: AuthedActor, id: string, input: { reason: Prisma.ContributionReportCreateInput["reason"]; details: string }) {
  await loadVisibleShared(actor, id);
  await rateLimit(`learning:report:${actor.user.id}`, 10, 3600);
  const existing = await db.contributionReport.count({ where: { sharedObservationId: id, reporterId: actor.user.id, status: "OPEN" } });
  if (existing) throw conflict("You have already reported this contribution. Moderators are reviewing it.");
  const moderators = await moderatorUserIds(actor.user.id);
  const report = await db.$transaction(async (tx) => {
    const r = await tx.contributionReport.create({
      data: { sharedObservationId: id, reporterId: actor.user.id, reason: input.reason, details: input.details },
      select: { id: true, status: true, createdAt: true },
    });
    await audit(
      { actorId: actor.user.id, action: "shared_observation.report", entityType: "ContributionReport", entityId: r.id, metadata: { sharedObservationId: id, reason: input.reason } },
      tx,
    );
    await notifyMany(
      moderators.map((userId) => ({
        userId,
        type: "learning.report",
        title: "A shared contribution was reported",
        body: `Reason: ${input.reason.toLowerCase()}. Review it in the moderation reports queue.`,
        link: "/portal/moderation/reports",
      })),
      tx,
    );
    return r;
  });
  return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
}

// ── Comments ─────────────────────────────────────────────────────────────

export async function listComments(actor: AuthedActor, sharedObservationId: string) {
  assertParticipant(actor);
  const moderator = can.moderateLearning(actor);
  const rows = await db.sharedObservationComment.findMany({
    where: {
      sharedObservationId,
      sharedObservation: sharedFeedWhere(actor),
      ...(moderator ? {} : { status: "VISIBLE" as const }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, body: true, createdAt: true, status: true, authorId: true, author: { select: employeeProbeSelect } },
  });
  return rows.map((r) =>
    toCommentDTO(
      { id: r.id, body: r.body, createdAt: r.createdAt, authorId: r.authorId, authorIsEmployee: isEmployeeRecord(r.author), hidden: r.status === "HIDDEN" },
      actor.user.id,
      moderator,
    ),
  );
}

export async function addComment(actor: AuthedActor, sharedObservationId: string, body: string) {
  await loadVisibleShared(actor, sharedObservationId);
  await rateLimit(`learning:comment:${actor.user.id}`, 30, 600);
  const source = await db.sharedObservation.findUnique({ where: { id: sharedObservationId }, select: { source: { select: { authorId: true, id: true } } } });
  const created = await db.$transaction(async (tx) => {
    const c = await tx.sharedObservationComment.create({
      data: { sharedObservationId, authorId: actor.user.id, body },
      select: { id: true, body: true, createdAt: true, status: true, authorId: true },
    });
    await audit(
      { actorId: actor.user.id, action: "shared_comment.create", entityType: "SharedObservationComment", entityId: c.id, metadata: { sharedObservationId } },
      tx,
    );
    // Close the loop for the contributor without revealing who commented.
    if (source && source.source.authorId !== actor.user.id) {
      await notify(
        {
          userId: source.source.authorId,
          type: "learning.comment",
          title: "New comment on your shared contribution",
          body: "A participant commented on the shared copy of your contribution.",
          link: `/portal/learning/${sharedObservationId}`,
        },
        tx,
      );
    }
    return c;
  });
  return toCommentDTO({ ...created, authorIsEmployee: actor.isEmployee, hidden: false }, actor.user.id, can.moderateLearning(actor));
}

// ── Feedback ─────────────────────────────────────────────────────────────

/** One quality signal per user (useful / needs evidence). Aggregates only — no rankings. */
export async function setFeedback(actor: AuthedActor, sharedObservationId: string, kind: FeedbackKind | null) {
  await loadVisibleShared(actor, sharedObservationId);
  const key = { sharedObservationId_userId: { sharedObservationId, userId: actor.user.id } };
  if (kind === null) await db.observationFeedback.deleteMany({ where: { sharedObservationId, userId: actor.user.id } });
  else await db.observationFeedback.upsert({ where: key, update: { kind }, create: { sharedObservationId, userId: actor.user.id, kind } });
  return { counts: await feedbackCounts(sharedObservationId), mine: kind };
}

// ── Saved searches ───────────────────────────────────────────────────────

const SAVED_SEARCH_MAX = 25;

/** Saved searches are re-run live under the same visibility rules (counts reflect withdrawals immediately). */
export async function listSavedSearches(actor: AuthedActor) {
  assertParticipant(actor);
  const rows = await db.savedSearch.findMany({ where: { userId: actor.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, query: true, createdAt: true } });
  return Promise.all(
    rows.map(async (r) => {
      const parsed = sharedFiltersSchema.safeParse(r.query ?? {});
      const filters = parsed.success ? parsed.data : {};
      return { id: r.id, name: r.name, filters, createdAt: r.createdAt.toISOString(), liveCount: await db.sharedObservation.count({ where: sharedWhere(actor, filters) }) };
    }),
  );
}
export type SavedSearchItem = Awaited<ReturnType<typeof listSavedSearches>>[number];

export async function createSavedSearch(actor: AuthedActor, input: { name: string; query: SharedFilters }) {
  assertParticipant(actor);
  const count = await db.savedSearch.count({ where: { userId: actor.user.id } });
  if (count >= SAVED_SEARCH_MAX) throw conflict(`You can keep up to ${SAVED_SEARCH_MAX} saved searches. Delete one first.`);
  const query = JSON.parse(JSON.stringify(input.query)) as Prisma.InputJsonValue;
  const s = await db.savedSearch.create({ data: { userId: actor.user.id, name: input.name, query }, select: { id: true, name: true, createdAt: true } });
  return { ...s, createdAt: s.createdAt.toISOString() };
}

export async function deleteSavedSearch(actor: AuthedActor, id: string) {
  const res = await db.savedSearch.deleteMany({ where: { id, userId: actor.user.id } });
  if (res.count === 0) throw notFound();
}

// ── Bookmarks ────────────────────────────────────────────────────────────

/** Bookmarks whose target is still visible right now (withdrawn copies drop out immediately). */
export async function listBookmarks(actor: AuthedActor) {
  assertParticipant(actor);
  const rows = await db.bookmark.findMany({
    where: {
      userId: actor.user.id,
      OR: [{ sharedObservation: sharedFeedWhere(actor) }, { contentItem: contentAudienceWhere(actor) }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      sharedObservation: { select: sharedSelect },
      contentItem: { select: { id: true, slug: true, title: true, type: true, summary: true } },
    },
  });
  return rows.map((b) => ({
    id: b.id,
    createdAt: b.createdAt.toISOString(),
    shared: b.sharedObservation ? toSharedDTO(b.sharedObservation) : null,
    content: b.contentItem,
  }));
}
export type BookmarkItem = Awaited<ReturnType<typeof listBookmarks>>[number];

export async function createBookmark(actor: AuthedActor, input: { sharedObservationId?: string; contentItemId?: string }) {
  assertParticipant(actor);
  if (input.sharedObservationId) {
    await loadVisibleShared(actor, input.sharedObservationId);
    const existing = await db.bookmark.findUnique({
      where: { userId_sharedObservationId: { userId: actor.user.id, sharedObservationId: input.sharedObservationId } },
      select: { id: true },
    });
    if (existing) return existing;
    return db.bookmark.create({ data: { userId: actor.user.id, sharedObservationId: input.sharedObservationId }, select: { id: true } });
  }
  const content = await db.contentItem.findFirst({ where: { AND: [{ id: input.contentItemId }, contentAudienceWhere(actor)] }, select: { id: true } });
  if (!content) throw notFound();
  const existing = await db.bookmark.findUnique({ where: { userId_contentItemId: { userId: actor.user.id, contentItemId: content.id } }, select: { id: true } });
  if (existing) return existing;
  return db.bookmark.create({ data: { userId: actor.user.id, contentItemId: content.id }, select: { id: true } });
}

export async function deleteBookmark(actor: AuthedActor, id: string) {
  const res = await db.bookmark.deleteMany({ where: { id, userId: actor.user.id } });
  if (res.count === 0) throw notFound();
}

/** Minimal summaries of specific shared copies, limited to those currently visible (PUBLISHED). */
export async function getSharedSummariesByIds(actor: AuthedActor, ids: readonly string[]) {
  assertParticipant(actor);
  const unique = [...new Set(ids)].filter((id) => id && id.length <= 64).slice(0, 100);
  if (!unique.length) return [];
  return db.sharedObservation.findMany({
    where: { AND: [sharedFeedWhere(actor), { id: { in: unique } }] },
    select: { id: true, title: true, periodLabel: true, region: true, type: true },
  });
}

/** Lightweight picker results for theme/idea evidence (PUBLISHED shared copies only). */
export async function pickSharedEvidence(actor: AuthedActor, q: string | undefined, take = 20) {
  const { items } = await searchSharedObservations(actor, { q, limit: take });
  return items.map((i) => ({ id: i.id, title: i.title, periodLabel: i.periodLabel, region: i.region, type: i.type }));
}
