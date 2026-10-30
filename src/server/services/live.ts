import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Audience, LiveSessionStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, audienceAllows, can } from "@/lib/authz/permissions";
import { liveSessionWhere } from "@/lib/authz/visibility";
import { audit } from "@/lib/audit";
import { AppError, notFound } from "@/lib/api/errors";
import { pageArgs, paginationSchema, toPage } from "@/lib/api/pagination";

// ── Validation ───────────────────────────────────────────────────────────

const AUDIENCES = ["PUBLIC", "EMPLOYEE", "CLIENT_ALL", "CLIENT_ORGS"] as const;
const EDITABLE_STATUSES = ["SCHEDULED", "LIVE", "ENDED"] as const;

/** https-only URL; empty strings from forms are treated as "no URL". */
const optionalHttpsUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500).nullable().optional(),
);

const fields = {
  title: z.string().trim().min(3, "Use at least 3 characters.").max(160),
  description: z.string().trim().min(1, "Add a description.").max(4000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  streamUrl: optionalHttpsUrl,
  recordingUrl: optionalHttpsUrl,
  audience: z.enum(AUDIENCES),
  status: z.enum(EDITABLE_STATUSES).optional(),
  organisationIds: z.array(z.string().min(1).max(64)).max(200).optional(),
};

export const liveSessionCreateSchema = z.object(fields);
export const liveSessionUpdateSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const LIVE_SCOPES = ["live", "upcoming", "recordings", "past", "manage"] as const;
export type LiveScope = (typeof LIVE_SCOPES)[number];
export const liveListQuery = paginationSchema.extend({ scope: z.enum(LIVE_SCOPES).default("upcoming") });

export type LiveSessionCreateInput = z.infer<typeof liveSessionCreateSchema>;
export type LiveSessionUpdateInput = z.infer<typeof liveSessionUpdateSchema>;

// ── Embeds (CSP allows only youtube-nocookie.com / youtube.com / player.vimeo.com frames) ──

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** Privacy-enhanced embed URL for YouTube/Vimeo links, or null for any other host. */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/)?.[1] ?? null;
    return id && YT_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.split("/")[1] ?? "";
    return YT_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "player.vimeo.com") {
    const id = u.pathname.match(/^\/video\/(\d{5,12})$/)?.[1];
    const h = u.searchParams.get("h");
    return id ? `https://player.vimeo.com/video/${id}${h && /^[a-f0-9]{6,20}$/i.test(h) ? `?h=${h}` : ""}` : null;
  }
  if (host === "vimeo.com") {
    // vimeo.com/123456789, vimeo.com/123456789/<unlisted-hash>, vimeo.com/channels/x/123456789
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => /^\d{5,12}$/.test(p));
    if (idx === -1) return null;
    const hash = parts[idx + 1];
    return `https://player.vimeo.com/video/${parts[idx]}${hash && /^[a-f0-9]{6,20}$/i.test(hash) ? `?h=${hash}` : ""}`;
  }
  return null;
}

// ── Visibility ───────────────────────────────────────────────────────────

/**
 * Employee-only and invitation-only (CLIENT_ORGS) targeting, and the names of invited
 * organisations, are reserved for publishers who are also verified employees.
 */
const isFullPublisher = (a: AuthedActor) => can.publishBroadcasts(a) && a.isEmployee;

/**
 * Publishers' management scope: everything the audience filter already allows them, plus
 * their own sessions in any status (incl. cancelled). Non-publishers never use this.
 */
function manageWhere(actor: AuthedActor): Prisma.LiveSessionWhereInput {
  return { OR: [liveSessionWhere(actor), { createdById: actor.user.id }] };
}

function scopeWhere(scope: LiveScope): Prisma.LiveSessionWhereInput {
  switch (scope) {
    case "live":
      return { status: "LIVE" };
    case "upcoming":
      return { status: "SCHEDULED" };
    case "recordings":
      return { status: "ENDED", recordingUrl: { not: null } };
    case "past":
      return { status: "ENDED", recordingUrl: null };
    case "manage":
      return {};
  }
}

const listSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  status: true,
  audience: true,
  streamUrl: true,
  recordingUrl: true,
  createdById: true,
  _count: { select: { organisations: true } },
} satisfies Prisma.LiveSessionSelect;

export interface LiveSessionListItem {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  status: LiveSessionStatus;
  audience: Audience;
  hasStream: boolean;
  hasRecording: boolean;
  /** Number of invited organisations — publishers only (null otherwise). */
  invitedOrganisationCount: number | null;
}

export async function listLiveSessions(
  actor: AuthedActor,
  q: { scope: LiveScope; cursor?: string; limit: number },
) {
  const publisher = can.publishBroadcasts(actor);
  if (q.scope === "manage") assert(publisher, "Only broadcast publishers can manage sessions.");
  const base = q.scope === "manage" ? manageWhere(actor) : liveSessionWhere(actor);
  const ascending = q.scope === "upcoming" || q.scope === "live";
  const rows = await db.liveSession.findMany({
    where: { AND: [base, scopeWhere(q.scope)] },
    orderBy: [{ startsAt: ascending ? "asc" : "desc" }, { id: ascending ? "asc" : "desc" }],
    select: listSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map(
      (s): LiveSessionListItem => ({
        id: s.id,
        title: s.title,
        description: s.description,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        audience: s.audience,
        hasStream: Boolean(s.streamUrl),
        hasRecording: Boolean(s.recordingUrl),
        invitedOrganisationCount: publisher ? s._count.organisations : null,
      }),
    ),
  };
}

/** Per-tab counts computed under the same audience filter as the lists. */
export async function liveSessionCounts(actor: AuthedActor) {
  const visible = liveSessionWhere(actor);
  const count = (scope: LiveScope) => db.liveSession.count({ where: { AND: [visible, scopeWhere(scope)] } });
  const [live, upcoming, recordings, past] = await Promise.all([count("live"), count("upcoming"), count("recordings"), count("past")]);
  return { live, upcoming, recordings, past };
}

export interface LiveSessionDetail extends LiveSessionListItem {
  streamUrl: string | null;
  recordingUrl: string | null;
  streamEmbedUrl: string | null;
  recordingEmbedUrl: string | null;
  canManage: boolean;
  /** Invited organisations — returned to broadcast publishers only. */
  organisations: { id: string; name: string }[] | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single session the actor may see, or null (callers return 404). The Prisma filter and
 * `audienceAllows` must both pass, so knowing an ID never bypasses the audience.
 */
export async function getLiveSession(actor: AuthedActor, id: string): Promise<LiveSessionDetail | null> {
  const publisher = can.publishBroadcasts(actor);
  const s = await db.liveSession.findFirst({
    where: { AND: [{ id }, publisher ? manageWhere(actor) : liveSessionWhere(actor)] },
    select: {
      ...listSelect,
      createdAt: true,
      updatedAt: true,
      organisations: { select: { organisationId: true, organisation: { select: { name: true } } } },
    },
  });
  if (!s) return null;
  const orgIds = s.organisations.map((o) => o.organisationId);
  const ownManaged = publisher && s.createdById === actor.user.id;
  if (!ownManaged && !audienceAllows(actor, s.audience, orgIds)) return null;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    status: s.status,
    audience: s.audience,
    hasStream: Boolean(s.streamUrl),
    hasRecording: Boolean(s.recordingUrl),
    invitedOrganisationCount: publisher ? orgIds.length : null,
    streamUrl: s.streamUrl,
    recordingUrl: s.recordingUrl,
    streamEmbedUrl: videoEmbedUrl(s.streamUrl),
    recordingEmbedUrl: videoEmbedUrl(s.recordingUrl),
    canManage: publisher,
    organisations: isFullPublisher(actor)
      ? s.organisations.map((o) => ({ id: o.organisationId, name: o.organisation.name })).sort((a, b) => a.name.localeCompare(b.name))
      : null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** Active client organisations for the CLIENT_ORGS picker (broadcast publishers only). */
export async function listInvitableOrganisations(actor: AuthedActor) {
  assert(can.publishBroadcasts(actor));
  if (!isFullPublisher(actor)) return [];
  return db.organisation.findMany({
    where: { type: "CLIENT", status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ── Mutations (broadcast publishers only) ────────────────────────────────

function fieldError(field: string, message: string) {
  return new AppError("validation_failed", message, { [field]: [message] });
}

async function resolveOrganisations(actor: AuthedActor, audience: Audience, ids: readonly string[] | undefined) {
  if ((audience === "EMPLOYEE" || audience === "CLIENT_ORGS") && !isFullPublisher(actor)) {
    throw fieldError("audience", "Only publishers who are verified employees can target employee-only or invitation-only audiences.");
  }
  if (audience !== "CLIENT_ORGS") return [];
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) throw fieldError("organisationIds", "Choose at least one invited organisation.");
  const found = await db.organisation.findMany({
    where: { id: { in: unique }, type: "CLIENT", status: "ACTIVE" },
    select: { id: true },
  });
  if (found.length !== unique.length) throw fieldError("organisationIds", "Invited organisations must be active client organisations.");
  return unique;
}

function checkWindow(startsAt: Date, endsAt: Date | null | undefined) {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) throw fieldError("endsAt", "End time must be after the start time.");
}

export async function createLiveSession(actor: AuthedActor, input: LiveSessionCreateInput) {
  assert(can.publishBroadcasts(actor), "Only broadcast publishers can schedule sessions.");
  checkWindow(input.startsAt, input.endsAt);
  const orgIds = await resolveOrganisations(actor, input.audience, input.organisationIds);
  return db.$transaction(async (tx) => {
    const created = await tx.liveSession.create({
      data: {
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        streamUrl: input.streamUrl ?? null,
        recordingUrl: input.recordingUrl ?? null,
        audience: input.audience,
        status: input.status ?? "SCHEDULED",
        createdById: actor.user.id,
        organisations: { create: orgIds.map((organisationId) => ({ organisationId })) },
      },
      select: { id: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "live_session.create",
        entityType: "LiveSession",
        entityId: created.id,
        metadata: { audience: input.audience, organisationCount: orgIds.length, status: input.status ?? "SCHEDULED" },
      },
      tx,
    );
    return created;
  });
}

async function loadManaged(actor: AuthedActor, id: string) {
  assert(can.publishBroadcasts(actor), "Only broadcast publishers can change sessions.");
  const s = await db.liveSession.findFirst({
    where: { AND: [{ id }, manageWhere(actor)] },
    select: {
      id: true,
      status: true,
      audience: true,
      startsAt: true,
      endsAt: true,
      createdById: true,
      organisations: { select: { organisationId: true } },
    },
  });
  if (!s) throw notFound();
  const orgIds = s.organisations.map((o) => o.organisationId);
  if (s.createdById !== actor.user.id && !audienceAllows(actor, s.audience, orgIds)) throw notFound();
  return { ...s, orgIds };
}

export async function updateLiveSession(actor: AuthedActor, id: string, input: LiveSessionUpdateInput) {
  const existing = await loadManaged(actor, id);
  const audience = input.audience ?? existing.audience;
  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;
  checkWindow(startsAt, endsAt);

  const audienceTouched = input.audience !== undefined || input.organisationIds !== undefined;
  const orgIds = audienceTouched
    ? await resolveOrganisations(actor, audience, input.organisationIds ?? existing.orgIds)
    : existing.orgIds;

  const data: Prisma.LiveSessionUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.startsAt !== undefined) data.startsAt = input.startsAt;
  if (input.endsAt !== undefined) data.endsAt = input.endsAt;
  if (input.streamUrl !== undefined) data.streamUrl = input.streamUrl;
  if (input.recordingUrl !== undefined) data.recordingUrl = input.recordingUrl;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.status !== undefined) data.status = input.status;

  const changed = Object.keys(input);
  await db.$transaction(async (tx) => {
    await tx.liveSession.update({ where: { id }, data });
    if (audienceTouched) {
      await tx.liveSessionOrganisation.deleteMany({ where: { liveSessionId: id } });
      if (orgIds.length) {
        await tx.liveSessionOrganisation.createMany({ data: orgIds.map((organisationId) => ({ liveSessionId: id, organisationId })) });
      }
    }
    await audit(
      {
        actorId: actor.user.id,
        action: "live_session.update",
        entityType: "LiveSession",
        entityId: id,
        metadata: {
          fields: changed,
          audience,
          organisationCount: orgIds.length,
          ...(input.status ? { status: input.status, previousStatus: existing.status } : {}),
        },
      },
      tx,
    );
  });
  return { id };
}

/** DELETE semantics: cancel (kept for audit history, hidden from every audience). */
export async function cancelLiveSession(actor: AuthedActor, id: string) {
  const existing = await loadManaged(actor, id);
  if (existing.status === "CANCELLED") return { id, status: "CANCELLED" as const };
  await db.$transaction(async (tx) => {
    await tx.liveSession.update({ where: { id }, data: { status: "CANCELLED" } });
    await audit(
      {
        actorId: actor.user.id,
        action: "live_session.cancel",
        entityType: "LiveSession",
        entityId: id,
        metadata: { previousStatus: existing.status, audience: existing.audience },
      },
      tx,
    );
  });
  return { id, status: "CANCELLED" as const };
}
