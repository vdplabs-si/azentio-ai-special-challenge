import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Audience, ContentStatus, ContentType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { Actor, AuthedActor } from "@/lib/authz/actor";
import { assert, can } from "@/lib/authz/permissions";
import { contentAudienceWhere } from "@/lib/authz/visibility";
import { audit } from "@/lib/audit";
import { AppError, conflict, notFound } from "@/lib/api/errors";
import { pageArgs, paginationSchema, toPage } from "@/lib/api/pagination";

/** Content types managed in the Knowledge & releases library. INSIGHT is website content (admin). */
export const LIBRARY_TYPES = ["KNOWLEDGE", "RELEASE_NOTE", "BRIEFING"] as const;
export type LibraryType = (typeof LIBRARY_TYPES)[number];
const AUDIENCES = ["PUBLIC", "EMPLOYEE", "CLIENT_ALL", "CLIENT_ORGS"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Validation ───────────────────────────────────────────────────────────

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const httpsUrl = z.preprocess(
  blankToNull,
  z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500).nullable().optional(),
);

const base = {
  type: z.enum(LIBRARY_TYPES),
  title: z.string().trim().min(3, "Use at least 3 characters.").max(200),
  slug: z.preprocess(
    blankToUndefined,
    z.string().trim().toLowerCase().max(120).regex(SLUG, "Use lower-case letters, numbers and single hyphens.").optional(),
  ),
  summary: z.string().trim().min(1, "Add a short summary.").max(600),
  body: z.string().trim().min(1, "Add the content body.").max(50_000),
  sourceUrl: httpsUrl,
  audience: z.enum(AUDIENCES).optional(),
  organisationId: z.preprocess(blankToNull, z.string().min(1).max(64).nullable().optional()),
  status: z.enum(STATUSES).optional(),
  reviewDueAt: z.preprocess(blankToNull, z.coerce.date().nullable().optional()),
};

export const contentCreateSchema = z.object(base);
export const contentUpdateSchema = z
  .object(base)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");

export const contentFeedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.preprocess(blankToNull, z.string().trim().max(1000).nullable().optional()),
});

export const contentListQuery = paginationSchema.extend({
  type: z.enum(LIBRARY_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
});

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;
export type ContentListQuery = z.infer<typeof contentListQuery>;

// ── Permissions ──────────────────────────────────────────────────────────

/** Employees author internal knowledge; content publishers author any library type/audience. */
export const canAuthorContent = (a: Actor) => Boolean(a.user) && (a.isEmployee || can.publishContent(a));

/**
 * Publisher scope. A CONTENT_PUBLISHER who is also a verified employee manages every library
 * item; a publisher without employee status is limited to PUBLIC and CLIENT_ALL items, so
 * employee-only content and other tenants' single-organisation briefings never reach them.
 */
const LIMITED_PUBLISHER_AUDIENCES: Audience[] = ["PUBLIC", "CLIENT_ALL"];
const isFullPublisher = (a: Actor) => can.publishContent(a) && a.isEmployee;

/** Non-published (or otherwise not audience-visible) library items the actor may still manage. */
function manageableWhere(actor: AuthedActor): Prisma.ContentItemWhereInput | null {
  if (can.publishContent(actor)) {
    return isFullPublisher(actor)
      ? { type: { in: [...LIBRARY_TYPES] } }
      : { type: { in: [...LIBRARY_TYPES] }, audience: { in: LIMITED_PUBLISHER_AUDIENCES } };
  }
  if (actor.isEmployee) return { type: "KNOWLEDGE", ownerId: actor.user.id };
  return null;
}

/** Visible (published, audience-filtered) OR manageable by the actor. */
function readableWhere(actor: AuthedActor): Prisma.ContentItemWhereInput {
  const manage = manageableWhere(actor);
  return manage ? { OR: [contentAudienceWhere(actor), manage] } : contentAudienceWhere(actor);
}

interface EditCheck {
  type: ContentType;
  audience: Audience;
  ownerId: string;
}

function canEditItem(actor: AuthedActor, item: EditCheck) {
  if (!(LIBRARY_TYPES as readonly string[]).includes(item.type)) return false;
  if (can.publishContent(actor)) return isFullPublisher(actor) || LIMITED_PUBLISHER_AUDIENCES.includes(item.audience);
  return actor.isEmployee && item.type === "KNOWLEDGE" && item.ownerId === actor.user.id;
}

const isOverdue = (reviewDueAt: Date | null, now: Date) => Boolean(reviewDueAt && reviewDueAt.getTime() < now.getTime());

// ── Reads ────────────────────────────────────────────────────────────────

const listSelect = {
  id: true,
  type: true,
  slug: true,
  title: true,
  summary: true,
  audience: true,
  status: true,
  reviewDueAt: true,
  publishedAt: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { name: true } },
  organisation: { select: { name: true } },
} satisfies Prisma.ContentItemSelect;

export async function listContent(actor: AuthedActor, q: ContentListQuery) {
  const now = new Date();
  const where: Prisma.ContentItemWhereInput = {
    AND: [
      { type: q.type ? q.type : { in: [...LIBRARY_TYPES] } },
      readableWhere(actor),
      ...(q.status ? [{ status: q.status }] : []),
      ...(q.q
        ? [{ OR: [{ title: { contains: q.q, mode: "insensitive" as const } }, { summary: { contains: q.q, mode: "insensitive" as const } }] }]
        : []),
    ],
  };
  const rows = await db.contentItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: listSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((r) => ({
      id: r.id,
      type: r.type,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      status: r.status,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
      reviewDueAt: r.type === "KNOWLEDGE" ? r.reviewDueAt : null,
      reviewOverdue: r.type === "KNOWLEDGE" && isOverdue(r.reviewDueAt, now),
      // Audience, owner and org targeting are internal metadata — employees only.
      audience: actor.isEmployee ? r.audience : null,
      ownerName: actor.isEmployee ? r.owner.name : null,
      organisationName: actor.isEmployee ? (r.organisation?.name ?? null) : null,
      canEdit: canEditItem(actor, r),
    })),
  };
}

const detailSelect = {
  ...listSelect,
  body: true,
  sourceUrl: true,
  organisationId: true,
  createdAt: true,
} satisfies Prisma.ContentItemSelect;

async function detail(actor: AuthedActor, key: { id: string } | { slug: string }) {
  const item = await db.contentItem.findFirst({ where: { AND: [key, readableWhere(actor)] }, select: detailSelect });
  if (!item) return null;
  const now = new Date();
  const editable = canEditItem(actor, item);
  const showStats = editable || item.ownerId === actor.user.id;
  const [mine, stats, comments] = await Promise.all([
    db.contentFeedback.findUnique({
      where: { contentItemId_userId: { contentItemId: item.id, userId: actor.user.id } },
      select: { helpful: true, comment: true, createdAt: true },
    }),
    showStats ? db.contentFeedback.groupBy({ by: ["helpful"], where: { contentItemId: item.id }, _count: { _all: true } }) : null,
    showStats
      ? db.contentFeedback.findMany({
          where: { contentItemId: item.id, comment: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, helpful: true, comment: true, createdAt: true },
        })
      : null,
  ]);
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    body: item.body,
    sourceUrl: item.sourceUrl && item.sourceUrl.startsWith("https://") ? item.sourceUrl : null,
    status: item.status,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    reviewDueAt: item.type === "KNOWLEDGE" ? item.reviewDueAt : null,
    reviewOverdue: item.type === "KNOWLEDGE" && isOverdue(item.reviewDueAt, now),
    audience: actor.isEmployee ? item.audience : null,
    ownerName: actor.isEmployee ? item.owner.name : null,
    organisationName: actor.isEmployee ? (item.organisation?.name ?? null) : null,
    /** Raw editable fields — only populated for editors. */
    editable: editable
      ? { audience: item.audience, organisationId: item.organisationId, reviewDueAt: item.reviewDueAt, sourceUrl: item.sourceUrl }
      : null,
    canEdit: editable,
    canGiveFeedback: item.status === "PUBLISHED",
    myFeedback: mine,
    feedbackSummary: stats
      ? {
          helpful: stats.find((s) => s.helpful)?._count._all ?? 0,
          notHelpful: stats.find((s) => !s.helpful)?._count._all ?? 0,
          comments: comments ?? [],
        }
      : null,
  };
}

/** Any content item the actor may read (incl. INSIGHT/PUBLIC), or null → 404. */
export const getContentBySlug = (actor: AuthedActor, slug: string) => detail(actor, { slug });
export const getContentById = (actor: AuthedActor, id: string) => detail(actor, { id });
export type ContentDetail = NonNullable<Awaited<ReturnType<typeof getContentBySlug>>>;

/** Client organisations for CLIENT_ORGS briefings (employee content publishers only). */
export async function listBriefingOrganisations(actor: AuthedActor) {
  if (!isFullPublisher(actor)) return [];
  return db.organisation.findMany({ where: { type: "CLIENT", status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ── Mutations ────────────────────────────────────────────────────────────

function fieldError(field: string, message: string) {
  return new AppError("validation_failed", message, { [field]: [message] });
}

const DEFAULT_AUDIENCE: Record<LibraryType, Audience> = {
  KNOWLEDGE: "EMPLOYEE",
  RELEASE_NOTE: "CLIENT_ALL",
  BRIEFING: "CLIENT_ALL",
};

interface Resolved {
  type: LibraryType;
  audience: Audience;
  organisationId: string | null;
}

/** Enforce who may target which type/audience; returns the effective targeting. */
async function resolveTargeting(actor: AuthedActor, type: LibraryType, audience: Audience | undefined, organisationId: string | null | undefined): Promise<Resolved> {
  if (!can.publishContent(actor)) {
    assert(actor.isEmployee, "Only employees and content publishers can author library content.");
    assert(type === "KNOWLEDGE", "Employees can author internal knowledge articles only.");
    if (audience && audience !== "EMPLOYEE") throw fieldError("audience", "Internal knowledge is visible to employees only.");
    return { type, audience: "EMPLOYEE", organisationId: null };
  }
  const effective = audience ?? DEFAULT_AUDIENCE[type];
  if (!isFullPublisher(actor) && !LIMITED_PUBLISHER_AUDIENCES.includes(effective)) {
    throw fieldError("audience", "Only verified employees can target employee-only or single-organisation audiences.");
  }
  if (type === "BRIEFING" && effective !== "CLIENT_ALL" && effective !== "CLIENT_ORGS") {
    throw fieldError("audience", "Client briefings must target all clients or a specific client organisation.");
  }
  if (effective !== "CLIENT_ORGS") return { type, audience: effective, organisationId: null };
  if (!organisationId) throw fieldError("organisationId", "Choose the client organisation for this item.");
  const org = await db.organisation.count({ where: { id: organisationId, type: "CLIENT" } });
  if (!org) throw fieldError("organisationId", "Choose an existing client organisation.");
  return { type, audience: effective, organisationId };
}

function slugify(title: string) {
  const s = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${s || "item"}-${randomBytes(3).toString("hex")}`;
}

const STATUS_ACTION: Record<ContentStatus, string> = {
  PUBLISHED: "content.publish",
  DRAFT: "content.unpublish",
  ARCHIVED: "content.archive",
};

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function createContent(actor: AuthedActor, input: ContentCreateInput) {
  assert(canAuthorContent(actor), "You cannot author library content.");
  const t = await resolveTargeting(actor, input.type, input.audience, input.organisationId);
  const status: ContentStatus = input.status ?? "DRAFT";
  const slug = input.slug ?? slugify(input.title);
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          type: t.type,
          slug,
          title: input.title,
          summary: input.summary,
          body: input.body,
          sourceUrl: input.sourceUrl ?? null,
          audience: t.audience,
          organisationId: t.organisationId,
          status,
          ownerId: actor.user.id,
          reviewDueAt: t.type === "KNOWLEDGE" ? (input.reviewDueAt ?? null) : null,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
        },
        select: { id: true, slug: true },
      });
      await audit(
        {
          actorId: actor.user.id,
          action: "content.create",
          entityType: "ContentItem",
          entityId: created.id,
          organisationId: t.organisationId,
          metadata: { type: t.type, audience: t.audience, status },
        },
        tx,
      );
      return created;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("That slug is already in use. Choose another.");
    throw e;
  }
}

export async function updateContent(actor: AuthedActor, id: string, input: ContentUpdateInput) {
  const item = await db.contentItem.findFirst({
    where: { AND: [{ id, type: { in: [...LIBRARY_TYPES] } }, readableWhere(actor)] },
    select: { id: true, type: true, audience: true, organisationId: true, ownerId: true, status: true, publishedAt: true },
  });
  if (!item) throw notFound();
  assert(canEditItem(actor, item), "You cannot edit this item.");
  const publisher = can.publishContent(actor);
  if (!publisher && input.type !== undefined && input.type !== item.type) {
    throw fieldError("type", "Only content publishers can change the content type.");
  }

  const type = (input.type ?? item.type) as LibraryType;
  const targetingTouched = input.type !== undefined || input.audience !== undefined || input.organisationId !== undefined;
  const t = targetingTouched
    ? await resolveTargeting(
        actor,
        type,
        input.audience ?? item.audience,
        input.organisationId !== undefined ? input.organisationId : item.organisationId,
      )
    : { type, audience: item.audience, organisationId: item.organisationId };

  const data: Prisma.ContentItemUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.body !== undefined) data.body = input.body;
  if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
  if (targetingTouched) {
    data.type = t.type;
    data.audience = t.audience;
    data.organisationId = t.organisationId;
  }
  if (t.type !== "KNOWLEDGE") data.reviewDueAt = null;
  else if (input.reviewDueAt !== undefined) data.reviewDueAt = input.reviewDueAt;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "PUBLISHED" && !item.publishedAt) data.publishedAt = new Date();
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.contentItem.update({ where: { id }, data });
      await audit(
        {
          actorId: actor.user.id,
          action: input.status && input.status !== item.status ? STATUS_ACTION[input.status] : "content.update",
          entityType: "ContentItem",
          entityId: id,
          organisationId: t.organisationId,
          metadata: {
            fields: Object.keys(input).filter((k) => input[k as keyof ContentUpdateInput] !== undefined),
            type: t.type,
            audience: t.audience,
            ...(input.status ? { status: input.status, previousStatus: item.status } : {}),
          },
        },
        tx,
      );
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("That slug is already in use. Choose another.");
    throw e;
  }
  return { id };
}

/** One helpful/not-helpful vote (+ optional comment) per user on visible, published items. */
export async function upsertContentFeedback(actor: AuthedActor, id: string, input: z.infer<typeof contentFeedbackSchema>) {
  const item = await db.contentItem.findFirst({ where: { AND: [{ id }, contentAudienceWhere(actor)] }, select: { id: true } });
  if (!item) throw notFound();
  return db.contentFeedback.upsert({
    where: { contentItemId_userId: { contentItemId: id, userId: actor.user.id } },
    create: { contentItemId: id, userId: actor.user.id, helpful: input.helpful, comment: input.comment ?? null },
    update: { helpful: input.helpful, comment: input.comment ?? null },
    select: { helpful: true, comment: true, createdAt: true },
  });
}
