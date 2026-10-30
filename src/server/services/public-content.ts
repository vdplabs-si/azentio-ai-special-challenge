import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ANONYMOUS } from "@/lib/authz/actor";
import { contentAudienceWhere, liveSessionWhere, mediaAudienceWhere } from "@/lib/authz/visibility";
import { AppError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { notifyMany } from "@/lib/notify";

/**
 * Read helpers for the public website. Every query is evaluated as the ANONYMOUS actor and
 * additionally pins `audience: "PUBLIC"`, so a signed-in visitor browsing the public site never
 * sees employee or client content here, and nothing becomes public by fallback.
 * Selects are explicit so internal fields (owners, organisation IDs) never reach public pages.
 */

// ───────────────────────────── Banner ─────────────────────────────

export async function getActiveBanner() {
  const now = new Date();
  return db.banner.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, message: true, linkLabel: true, linkHref: true },
  });
}

export type PublicBanner = NonNullable<Awaited<ReturnType<typeof getActiveBanner>>>;

// ───────────────────────────── Media ─────────────────────────────

const mediaWhere = (): Prisma.MediaAssetWhereInput => ({
  AND: [mediaAudienceWhere(ANONYMOUS), { audience: "PUBLIC", published: true }],
});

export function listPublicMedia(take = 60) {
  return db.mediaAsset.findMany({
    where: mediaWhere(),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, title: true, description: true, url: true, createdAt: true },
  });
}

export type PublicMedia = Awaited<ReturnType<typeof listPublicMedia>>[number];

// ───────────────────────────── Insights ─────────────────────────────

const insightWhere = (): Prisma.ContentItemWhereInput => ({
  AND: [contentAudienceWhere(ANONYMOUS), { type: "INSIGHT", audience: "PUBLIC", status: "PUBLISHED" }],
});

const insightListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.ContentItemSelect;

export function listPublicInsights(take = 50) {
  return db.contentItem.findMany({
    where: insightWhere(),
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take,
    select: insightListSelect,
  });
}

export type PublicInsightSummary = Awaited<ReturnType<typeof listPublicInsights>>[number];

/** One public, published insight by slug, or null. Cached per request (metadata + page). */
export const getPublicInsight = cache(async (slug: string) => {
  if (!slug || slug.length > 200) return null;
  return db.contentItem.findFirst({
    where: { AND: [insightWhere(), { slug }] },
    select: { ...insightListSelect, body: true, sourceUrl: true },
  });
});

// ───────────────────────────── Live sessions ─────────────────────────────

const liveSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  status: true,
  streamUrl: true,
  recordingUrl: true,
} satisfies Prisma.LiveSessionSelect;

export async function listPublicLiveSessions() {
  const now = new Date();
  const base: Prisma.LiveSessionWhereInput[] = [liveSessionWhere(ANONYMOUS), { audience: "PUBLIC" }];
  const [upcoming, recordings] = await Promise.all([
    db.liveSession.findMany({
      where: {
        AND: [
          ...base,
          {
            OR: [
              { status: "LIVE" },
              { status: "SCHEDULED", OR: [{ startsAt: { gte: now } }, { endsAt: { gt: now } }] },
            ],
          },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 30,
      select: liveSelect,
    }),
    db.liveSession.findMany({
      where: { AND: [...base, { status: "ENDED", recordingUrl: { not: null } }] },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: 30,
      select: liveSelect,
    }),
  ]);
  return { upcoming, recordings };
}

export type PublicLiveSession = Awaited<ReturnType<typeof listPublicLiveSessions>>["upcoming"][number];

// ───────────────────────────── Hackathons ─────────────────────────────

/** An event is open when registration is switched on and it has not yet ended. */
export const openHackathonWhere = (now = new Date()): Prisma.HackathonEventWhereInput => ({
  registrationOpen: true,
  endsAt: { gt: now },
});

export function listOpenHackathonEvents() {
  return db.hackathonEvent.findMany({
    where: openHackathonWhere(),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 20,
    select: { id: true, slug: true, name: true, description: true, startsAt: true, endsAt: true },
  });
}

export type OpenHackathonEvent = Awaited<ReturnType<typeof listOpenHackathonEvents>>[number];

/** Slugs for the sitemap (public, published insights only). */
export function listPublicInsightSlugs() {
  return db.contentItem.findMany({ where: insightWhere(), select: { slug: true, updatedAt: true }, take: 5000 });
}

// ───────────────────────────── Public intake helpers (contact + hackathon APIs) ─────────────────────────────

const MAX_PUBLIC_BODY_BYTES = 32_000;

/**
 * Read a public form's JSON body with a size cap. Malformed JSON → 400, oversized → 413.
 * (We read the body ourselves rather than via parseBody so the honeypot can be checked first.)
 */
export async function readPublicJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_PUBLIC_BODY_BYTES) throw new AppError("payload_too_large", "Request is too large.");
  const text = await req.text();
  if (text.length > MAX_PUBLIC_BODY_BYTES) throw new AppError("payload_too_large", "Request is too large.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("bad_request", "Request body must be valid JSON.");
  }
}

/** True when the hidden "website" field was filled in — almost certainly an automated submission. */
export function honeypotTriggered(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const value = (raw as Record<string, unknown>).website;
  return typeof value === "string" ? value.trim().length > 0 : value != null && value !== false;
}

/**
 * In-app notification to every active portal / super admin. Best-effort: the submission is
 * already committed, so a notification failure is logged rather than failing the visitor's request.
 */
export async function notifyPortalAdmins(input: { type: string; title: string; body: string; link: string }) {
  try {
    const admins = await db.user.findMany({
      where: {
        status: "ACTIVE",
        roleGrants: { some: { revokedAt: null, role: { in: ["PORTAL_ADMIN", "SUPER_ADMIN"] } } },
      },
      select: { id: true },
    });
    await notifyMany(admins.map((a) => ({ userId: a.id, ...input })));
    return admins.length;
  } catch (error) {
    log.error("Failed to notify portal admins", { type: input.type, error });
    return 0;
  }
}
