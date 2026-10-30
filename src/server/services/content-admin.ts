import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, can } from "@/lib/authz/permissions";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { pageArgs, paginationSchema, toPage, type Pagination } from "@/lib/api/pagination";
import { audit } from "@/lib/audit";

/**
 * Website content administration for CONTENT_PUBLISHER: homepage banners, public media
 * assets and public INSIGHT articles. No identity administration and no private content
 * access is implied by this role. Every mutation is audited (metadata never carries bodies).
 */

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";

const httpsUrl = z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500);

/** Site-relative path ("/connect") or an https URL — never protocol-relative or javascript: links. */
const linkHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || httpsUrl.safeParse(v).success,
    "Use a site path starting with / or an https:// URL.",
  );

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

export const contentListQuery = paginationSchema;

function windowError(startsAt: Date | null | undefined, endsAt: Date | null | undefined) {
  if (startsAt && endsAt && endsAt <= startsAt) {
    return badRequest("The end must be after the start.", { endsAt: ["The end must be after the start."] });
  }
  return null;
}

// ───────────────────────────── Banners ─────────────────────────────

const bannerBase = z.object({
  message: z.string().trim().min(3).max(280),
  linkLabel: nullableText(60),
  linkHref: linkHref.nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  active: z.boolean(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
});
export const bannerCreateSchema = bannerBase.extend({
  active: z.boolean().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});
export const bannerPatchSchema = bannerBase.partial();

const bannerSelect = {
  id: true,
  message: true,
  linkLabel: true,
  linkHref: true,
  active: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.BannerSelect;

export async function listBanners(actor: AuthedActor, page: Pagination) {
  assert(can.publishContent(actor));
  const rows = await db.banner.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: bannerSelect,
    ...pageArgs(page),
  });
  return toPage(rows, page);
}

function linkPairError(label: string | null | undefined, href: string | null | undefined) {
  if (label && !href) return badRequest("Add a link for the link label.", { linkHref: ["Add a link for the link label."] });
  return null;
}

export async function createBanner(actor: AuthedActor, input: z.infer<typeof bannerCreateSchema>) {
  assert(can.publishContent(actor));
  const err = windowError(input.startsAt, input.endsAt) ?? linkPairError(input.linkLabel, input.linkHref);
  if (err) throw err;
  const banner = await db.$transaction(async (tx) => {
    const created = await tx.banner.create({
      data: {
        message: input.message,
        linkLabel: input.linkLabel ?? null,
        linkHref: input.linkHref ?? null,
        active: input.active ?? false,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdById: actor.user.id,
      },
      select: bannerSelect,
    });
    await audit(
      { actorId: actor.user.id, action: "banner.create", entityType: "Banner", entityId: created.id, metadata: { active: created.active } },
      tx,
    );
    return created;
  });
  return { banner };
}

export async function updateBanner(actor: AuthedActor, id: string, input: z.infer<typeof bannerPatchSchema>) {
  assert(can.publishContent(actor));
  const current = await db.banner.findUnique({ where: { id }, select: { id: true, startsAt: true, endsAt: true, linkLabel: true, linkHref: true, active: true } });
  if (!current) throw notFound();
  const merged = {
    startsAt: input.startsAt === undefined ? current.startsAt : input.startsAt,
    endsAt: input.endsAt === undefined ? current.endsAt : input.endsAt,
    linkLabel: input.linkLabel === undefined ? current.linkLabel : input.linkLabel,
    linkHref: input.linkHref === undefined ? current.linkHref : input.linkHref,
  };
  const err = windowError(merged.startsAt, merged.endsAt) ?? linkPairError(merged.linkLabel, merged.linkHref);
  if (err) throw err;
  const fields = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  const action =
    input.active === true && !current.active ? "banner.activate" : input.active === false && current.active ? "banner.deactivate" : "banner.update";
  const banner = await db.$transaction(async (tx) => {
    const updated = await tx.banner.update({ where: { id }, data: input, select: bannerSelect });
    await audit({ actorId: actor.user.id, action, entityType: "Banner", entityId: id, metadata: { fields } }, tx);
    return updated;
  });
  return { banner };
}

export async function deleteBanner(actor: AuthedActor, id: string) {
  assert(can.publishContent(actor));
  const current = await db.banner.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound();
  await db.$transaction(async (tx) => {
    await tx.banner.delete({ where: { id } });
    await audit({ actorId: actor.user.id, action: "banner.delete", entityType: "Banner", entityId: id }, tx);
  });
  return { ok: true };
}

// ───────────────────────────── Media assets ─────────────────────────────

/** Media audiences a publisher may choose (CLIENT_ORGS is not supported for media). */
export const MEDIA_AUDIENCES = ["PUBLIC", "EMPLOYEE", "CLIENT_ALL"] as const;

const mediaBase = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000),
  url: httpsUrl,
  audience: z.enum(MEDIA_AUDIENCES),
  published: z.boolean(),
});
export const mediaCreateSchema = mediaBase.extend({
  description: z.string().trim().max(2000).optional(),
  published: z.boolean().optional(),
});
export const mediaPatchSchema = mediaBase.partial();

const mediaSelect = {
  id: true,
  title: true,
  description: true,
  url: true,
  audience: true,
  published: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.MediaAssetSelect;

export async function listMedia(actor: AuthedActor, page: Pagination) {
  assert(can.publishContent(actor));
  const rows = await db.mediaAsset.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: mediaSelect,
    ...pageArgs(page),
  });
  return toPage(rows, page);
}

export async function createMedia(actor: AuthedActor, input: z.infer<typeof mediaCreateSchema>) {
  assert(can.publishContent(actor));
  const media = await db.$transaction(async (tx) => {
    const created = await tx.mediaAsset.create({
      data: {
        title: input.title,
        description: input.description ?? "",
        url: input.url,
        audience: input.audience,
        published: input.published ?? false,
        createdById: actor.user.id,
      },
      select: mediaSelect,
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "media.create",
        entityType: "MediaAsset",
        entityId: created.id,
        metadata: { audience: created.audience, published: created.published },
      },
      tx,
    );
    return created;
  });
  return { media };
}

export async function updateMedia(actor: AuthedActor, id: string, input: z.infer<typeof mediaPatchSchema>) {
  assert(can.publishContent(actor));
  const current = await db.mediaAsset.findUnique({ where: { id }, select: { id: true, published: true, audience: true } });
  if (!current) throw notFound();
  const fields = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  const action =
    input.published === true && !current.published
      ? "media.publish"
      : input.published === false && current.published
        ? "media.unpublish"
        : "media.update";
  const media = await db.$transaction(async (tx) => {
    const updated = await tx.mediaAsset.update({ where: { id }, data: input, select: mediaSelect });
    await audit(
      {
        actorId: actor.user.id,
        action,
        entityType: "MediaAsset",
        entityId: id,
        metadata: { fields, ...(input.audience && input.audience !== current.audience ? { audience: { from: current.audience, to: input.audience } } : {}) },
      },
      tx,
    );
    return updated;
  });
  return { media };
}

export async function deleteMedia(actor: AuthedActor, id: string) {
  assert(can.publishContent(actor));
  const current = await db.mediaAsset.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound();
  await db.$transaction(async (tx) => {
    await tx.mediaAsset.delete({ where: { id } });
    await audit({ actorId: actor.user.id, action: "media.delete", entityType: "MediaAsset", entityId: id }, tx);
  });
  return { ok: true };
}

// ───────────────────────────── Public insights (ContentItem type INSIGHT) ─────────────────────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const insightBase = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().toLowerCase().max(120).regex(SLUG, "Use lower-case letters, numbers and single hyphens."),
  summary: z.string().trim().min(10).max(500),
  body: z.string().trim().min(1).max(20000),
  sourceUrl: httpsUrl.nullable().optional(),
  status: z.enum(CONTENT_STATUSES),
});
export const insightCreateSchema = insightBase.extend({ status: z.enum(CONTENT_STATUSES).optional() });
export const insightPatchSchema = insightBase.partial();

const insightSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  sourceUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { name: true } },
} satisfies Prisma.ContentItemSelect;

export async function listInsights(actor: AuthedActor, page: Pagination) {
  assert(can.publishContent(actor));
  const rows = await db.contentItem.findMany({
    where: { type: "INSIGHT" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: insightSelect,
    ...pageArgs(page),
  });
  return toPage(rows, page);
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const clash = await db.contentItem.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw conflict("Another content item already uses this slug.");
}

export async function createInsight(actor: AuthedActor, input: z.infer<typeof insightCreateSchema>) {
  assert(can.publishContent(actor));
  await assertSlugFree(input.slug);
  const status = input.status ?? "DRAFT";
  try {
    const insight = await db.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          type: "INSIGHT",
          audience: "PUBLIC",
          slug: input.slug,
          title: input.title,
          summary: input.summary,
          body: input.body,
          sourceUrl: input.sourceUrl ?? null,
          status,
          ownerId: actor.user.id,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
        },
        select: insightSelect,
      });
      await audit(
        {
          actorId: actor.user.id,
          action: "insight.create",
          entityType: "ContentItem",
          entityId: created.id,
          metadata: { slug: created.slug, status },
        },
        tx,
      );
      return created;
    });
    return { insight };
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Another content item already uses this slug.");
    throw e;
  }
}

export async function updateInsight(actor: AuthedActor, id: string, input: z.infer<typeof insightPatchSchema>) {
  assert(can.publishContent(actor));
  // Only INSIGHT items are editable here — knowledge/briefings/release notes have their own module.
  const current = await db.contentItem.findFirst({
    where: { id, type: "INSIGHT" },
    select: { id: true, slug: true, status: true, publishedAt: true },
  });
  if (!current) throw notFound();
  if (input.slug && input.slug !== current.slug) await assertSlugFree(input.slug, id);
  const fields = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  const publishing = input.status === "PUBLISHED" && current.status !== "PUBLISHED";
  const action = publishing
    ? "insight.publish"
    : input.status === "ARCHIVED" && current.status !== "ARCHIVED"
      ? "insight.archive"
      : input.status === "DRAFT" && current.status !== "DRAFT"
        ? "insight.unpublish"
        : "insight.update";
  try {
    const insight = await db.$transaction(async (tx) => {
      const updated = await tx.contentItem.update({
        where: { id },
        data: {
          ...input,
          ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl ?? null }),
          ...(publishing && !current.publishedAt ? { publishedAt: new Date() } : {}),
        },
        select: insightSelect,
      });
      await audit(
        {
          actorId: actor.user.id,
          action,
          entityType: "ContentItem",
          entityId: id,
          metadata: { fields, status: updated.status, slug: updated.slug },
        },
        tx,
      );
      return updated;
    });
    return { insight };
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Another content item already uses this slug.");
    throw e;
  }
}
