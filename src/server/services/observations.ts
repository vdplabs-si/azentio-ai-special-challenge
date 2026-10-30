import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ObservationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import { rateLimit } from "@/lib/api/rate-limit";
import { AppError, conflict, forbidden, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, can, canContributeInOrg, isPortalAdmin, observationAccess } from "@/lib/authz/permissions";
import { visibleObservations } from "@/lib/authz/visibility";
import {
  assertTransition,
  auditAction,
  canDeleteStatus,
  isAmendable,
  isFreelyEditable,
  LifecycleError,
  WITHDRAWABLE,
  type Transition,
} from "@/server/learning/lifecycle";
import { parseFlags, scanContribution, type SensitiveFlag } from "@/server/learning/sensitive-scan";
import type { ConsentInput, ObservationInput, ObservationUpdateInput } from "@/server/learning/schemas";
import { assertParticipant, moderatorUserIds } from "@/server/learning/guard";
import { OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";

type Tx = Prisma.TransactionClient;

const SUBMIT_LIMIT = { count: 20, windowSeconds: 3600 };
const CREATE_LIMIT = { count: 60, windowSeconds: 3600 };

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const validationError = (field: string, message: string) =>
  new AppError("validation_failed", "Some fields are invalid.", { [field]: [message] });

/** Fields of the private source that are snapshotted on each submission. */
const sourceSelect = {
  id: true,
  organisationId: true,
  authorId: true,
  type: true,
  title: true,
  body: true,
  offeringId: true,
  industry: true,
  region: true,
  periodStart: true,
  periodEnd: true,
  evidenceType: true,
  confidence: true,
  topics: true,
  links: true,
  orgVisible: true,
  status: true,
  version: true,
  sensitiveFlags: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ObservationSelect;

type SourceRow = Prisma.ObservationGetPayload<{ select: typeof sourceSelect }>;

function fieldsToData(input: ObservationInput) {
  return {
    type: input.type,
    title: input.title,
    body: input.body,
    offeringId: input.offeringId || null,
    industry: input.industry,
    region: input.region,
    periodStart: toDate(input.periodStart),
    periodEnd: toDate(input.periodEnd),
    evidenceType: input.evidenceType,
    confidence: input.confidence,
    topics: [...new Set(input.topics)],
    links: [...new Set(input.links)],
  };
}

type FieldData = ReturnType<typeof fieldsToData>;

function snapshotOf(o: FieldData | SourceRow, flags: SensitiveFlag[]): Prisma.InputJsonValue {
  return {
    type: o.type,
    title: o.title,
    body: o.body,
    offeringId: o.offeringId,
    industry: o.industry,
    region: o.region,
    periodStart: isoDay(o.periodStart),
    periodEnd: isoDay(o.periodEnd),
    evidenceType: o.evidenceType,
    confidence: o.confidence,
    topics: o.topics,
    links: o.links,
    sensitiveFlagCount: flags.length,
  };
}

/** Whether a PATCH changes anything material (anything a reviewer would see). */
function isMaterialChange(current: SourceRow, next: FieldData) {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return !(
    current.type === next.type &&
    current.title === next.title &&
    current.body === next.body &&
    (current.offeringId ?? null) === next.offeringId &&
    current.industry === next.industry &&
    current.region === next.region &&
    isoDay(current.periodStart) === isoDay(next.periodStart) &&
    isoDay(current.periodEnd) === isoDay(next.periodEnd) &&
    current.evidenceType === next.evidenceType &&
    current.confidence === next.confidence &&
    same(current.topics, next.topics) &&
    same(current.links, next.links)
  );
}

async function assertOffering(offeringId: string | null) {
  if (!offeringId) return;
  const exists = await db.offering.count({ where: { id: offeringId } });
  if (!exists) throw validationError("offeringId", "Choose an offering from the list.");
}

/** Load a source the actor may see (composes visibleObservations) or 404. */
async function loadVisible(actor: AuthedActor, id: string): Promise<SourceRow> {
  const row = await db.observation.findFirst({ where: { AND: [{ id }, visibleObservations(actor)] }, select: sourceSelect });
  if (!row || !observationAccess(actor, row).view) throw notFound();
  return row;
}

/** Load a source the actor authored and may edit (author + still a member of its org). */
async function loadOwn(actor: AuthedActor, id: string): Promise<SourceRow> {
  const row = await loadVisible(actor, id);
  if (!observationAccess(actor, row).edit) throw forbidden("Only the author can change this contribution.");
  return row;
}

/** Guarded status update: fails with 409 if another request changed the record first. */
async function guardedUpdate(tx: Tx, row: Pick<SourceRow, "id" | "status" | "version">, data: Prisma.ObservationUpdateManyMutationInput) {
  const res = await tx.observation.updateMany({ where: { id: row.id, status: row.status, version: row.version }, data });
  if (res.count !== 1) throw conflict("This contribution changed while you were working on it. Reload and try again.");
}

async function notifyModeratorsOfSubmission(tx: Tx, row: Pick<SourceRow, "id" | "type" | "authorId">, version: number, kind: Transition["action"]) {
  const ids = await moderatorUserIds(row.authorId);
  await notifyMany(
    ids.map((userId) => ({
      userId,
      type: "learning.submission",
      title: kind === "amend" ? "Amended contribution awaiting review" : "New contribution awaiting review",
      body: `A ${OBSERVATION_TYPE_LABELS[row.type].toLowerCase()} (version ${version}) was submitted for community sharing.`,
      link: `/portal/moderation/${row.id}`,
    })),
    tx,
  );
}

async function recordConsent(tx: Tx, observationId: string, version: number, userId: string, c: ConsentInput) {
  return tx.sharingConsent.create({
    data: {
      observationId,
      version,
      userId,
      storeAndProcess: c.storeAndProcess,
      publishSharedVersion: c.publishSharedVersion,
      attributeOrganisation: c.attributeOrganisation,
      futureTraining: c.futureTraining,
    },
  });
}

const consentMeta = (c: ConsentInput) => ({
  storeAndProcess: c.storeAndProcess,
  publishSharedVersion: c.publishSharedVersion,
  attributeOrganisation: c.attributeOrganisation,
  futureTraining: c.futureTraining,
});

// ── Create / update / delete ─────────────────────────────────────────────

/** Create a PRIVATE DRAFT in the actor's validated active workspace. Saving never shares. */
export async function createObservation(actor: AuthedActor, input: ObservationInput) {
  assertParticipant(actor);
  const org = actor.activeOrganisation;
  assert(Boolean(org) && canContributeInOrg(actor, org!.organisationId), "Your role in this workspace cannot create contributions.");
  await rateLimit(`learning:create:${actor.user.id}`, CREATE_LIMIT.count, CREATE_LIMIT.windowSeconds);
  const data = fieldsToData(input);
  await assertOffering(data.offeringId);
  const flags = scanContribution(data);

  const created = await db.$transaction(async (tx) => {
    const obs = await tx.observation.create({
      data: {
        ...data,
        organisationId: org!.organisationId,
        authorId: actor.user.id,
        orgVisible: input.orgVisible,
        status: "DRAFT",
        sensitiveFlags: flags as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, status: true, version: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "observation.create",
        entityType: "Observation",
        entityId: obs.id,
        organisationId: org!.organisationId,
        metadata: { orgVisible: input.orgVisible, sensitiveFlagCount: flags.length },
      },
      tx,
    );
    return obs;
  });
  return { ...created, sensitiveFlags: flags };
}

/**
 * Update a contribution. DRAFT and RETURNED are edited in place. A material edit of a PUBLISHED
 * contribution creates version n+1 in SUBMITTED (new snapshot + new consent); the approved shared
 * copy stays live until a moderator publishes the new version.
 */
export async function updateObservation(actor: AuthedActor, id: string, input: ObservationUpdateInput) {
  const row = await loadOwn(actor, id);
  const data = fieldsToData(input);
  await assertOffering(data.offeringId);
  const flags = scanContribution(data);

  if (isFreelyEditable(row.status)) {
    await db.$transaction(async (tx) => {
      await guardedUpdate(tx, row, { ...data, orgVisible: input.orgVisible, sensitiveFlags: flags as unknown as Prisma.InputJsonValue });
      await audit(
        {
          actorId: actor.user.id,
          action: "observation.update",
          entityType: "Observation",
          entityId: id,
          organisationId: row.organisationId,
          metadata: { status: row.status, version: row.version, sensitiveFlagCount: flags.length, orgVisible: input.orgVisible },
        },
        tx,
      );
    });
    return { id, status: row.status, version: row.version, sensitiveFlags: flags, newVersion: false };
  }

  if (isAmendable(row.status)) {
    if (!isMaterialChange(row, data)) {
      if (row.orgVisible !== input.orgVisible) await setOrgVisibility(actor, id, input.orgVisible);
      return { id, status: row.status, version: row.version, sensitiveFlags: parseFlags(row.sensitiveFlags), newVersion: false };
    }
    if (!input.consent) {
      throw validationError("consent", "Amending a published contribution needs your sharing permissions for the new version.");
    }
    const consent = input.consent;
    const t = assertTransition(row.status, "SUBMITTED", "author", "amend");
    await rateLimit(`learning:submit:${actor.user.id}`, SUBMIT_LIMIT.count, SUBMIT_LIMIT.windowSeconds);
    const version = row.version + 1;
    await db.$transaction(async (tx) => {
      await guardedUpdate(tx, row, {
        ...data,
        orgVisible: input.orgVisible,
        sensitiveFlags: flags as unknown as Prisma.InputJsonValue,
        status: t.to,
        version,
        submittedAt: new Date(),
      });
      await tx.observationVersion.create({ data: { observationId: id, version, snapshot: snapshotOf(data, flags) } });
      await recordConsent(tx, id, version, actor.user.id, consent);
      await audit(
        {
          actorId: actor.user.id,
          action: auditAction(t),
          entityType: "Observation",
          entityId: id,
          organisationId: row.organisationId,
          metadata: { from: row.status, to: t.to, version, consent: consentMeta(consent), sensitiveFlagCount: flags.length },
        },
        tx,
      );
      await notifyModeratorsOfSubmission(tx, row, version, t.action);
    });
    return { id, status: t.to, version, sensitiveFlags: flags, newVersion: true };
  }

  throw conflict("This contribution can't be edited in its current state.");
}

/** Delete a never-submitted private draft (author only). */
export async function deleteObservation(actor: AuthedActor, id: string) {
  const row = await loadOwn(actor, id);
  if (!canDeleteStatus(row.status) || row.submittedAt) throw conflict("Only private drafts can be deleted. Withdraw shared contributions instead.");
  await db.$transaction(async (tx) => {
    const res = await tx.observation.deleteMany({ where: { id, status: "DRAFT", authorId: actor.user.id, submittedAt: null } });
    if (res.count !== 1) throw conflict("This draft changed while you were working on it. Reload and try again.");
    await audit(
      { actorId: actor.user.id, action: "observation.delete", entityType: "Observation", entityId: id, organisationId: row.organisationId },
      tx,
    );
  });
}

/** The explicit "within my organisation" choice. Never affects community sharing. */
export async function setOrgVisibility(actor: AuthedActor, id: string, orgVisible: boolean) {
  const row = await loadOwn(actor, id);
  if (row.orgVisible === orgVisible) return { id, orgVisible };
  await db.$transaction(async (tx) => {
    await tx.observation.update({ where: { id }, data: { orgVisible } });
    await audit(
      {
        actorId: actor.user.id,
        action: "observation.visibility",
        entityType: "Observation",
        entityId: id,
        organisationId: row.organisationId,
        metadata: { orgVisible },
      },
      tx,
    );
  });
  return { id, orgVisible };
}

// ── Lifecycle: submit / resubmit / withdraw ─────────────────────────────

/** DRAFT → SUBMITTED (first submission) or RETURNED → SUBMITTED (resubmission, version n+1). */
export async function submitObservation(actor: AuthedActor, id: string, consent: ConsentInput) {
  const row = await loadOwn(actor, id);
  const action = row.status === "DRAFT" ? "submit" : row.status === "RETURNED" ? "resubmit" : null;
  if (!action) throw new LifecycleError(row.status, "SUBMITTED", "author");
  const t = assertTransition(row.status, "SUBMITTED", "author", action);
  await rateLimit(`learning:submit:${actor.user.id}`, SUBMIT_LIMIT.count, SUBMIT_LIMIT.windowSeconds);

  // First submission keeps version 1; every resubmission is a new version.
  const existingVersions = await db.observationVersion.count({ where: { observationId: id } });
  const version = action === "submit" && existingVersions === 0 ? row.version : row.version + 1;
  const flags = scanContribution(row);

  await db.$transaction(async (tx) => {
    await guardedUpdate(tx, row, {
      status: t.to,
      version,
      submittedAt: new Date(),
      sensitiveFlags: flags as unknown as Prisma.InputJsonValue,
    });
    await tx.observationVersion.create({ data: { observationId: id, version, snapshot: snapshotOf(row, flags) } });
    await recordConsent(tx, id, version, actor.user.id, consent);
    await audit(
      {
        actorId: actor.user.id,
        action: auditAction(t),
        entityType: "Observation",
        entityId: id,
        organisationId: row.organisationId,
        metadata: { from: row.status, to: t.to, version, consent: consentMeta(consent), sensitiveFlagCount: flags.length },
      },
      tx,
    );
    await notifyModeratorsOfSubmission(tx, row, version, t.action);
  });
  return { id, status: t.to, version, sensitiveFlags: flags };
}

/**
 * One-click withdrawal. Every live shared copy is marked WITHDRAWN in the same transaction; because
 * all shared reads (feed, search, counts, saved searches, export, AIRA) are live queries over
 * sharedFeedWhere, the copy disappears from all of them immediately.
 */
export async function withdrawObservation(actor: AuthedActor, id: string) {
  const row = await loadOwn(actor, id);
  if (!WITHDRAWABLE.includes(row.status)) throw new LifecycleError(row.status, "WITHDRAWN", "author");
  const t = assertTransition(row.status, "WITHDRAWN", "author", "withdraw");
  const effectiveAt = new Date();
  const withdrawn = await db.$transaction(async (tx) => {
    await guardedUpdate(tx, row, { status: t.to });
    const copies = await tx.sharedObservation.updateMany({
      where: { sourceObservationId: id, status: { in: ["PUBLISHED", "SUSPENDED"] } },
      data: { status: "WITHDRAWN" },
    });
    // Append-only consent history: record that publication permission was withdrawn.
    await tx.sharingConsent.create({
      data: {
        observationId: id,
        version: row.version,
        userId: actor.user.id,
        storeAndProcess: true,
        publishSharedVersion: false,
        attributeOrganisation: false,
        futureTraining: false,
      },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: auditAction(t),
        entityType: "Observation",
        entityId: id,
        organisationId: row.organisationId,
        metadata: { from: row.status, to: t.to, version: row.version, withdrawnSharedCopies: copies.count },
      },
      tx,
    );
    return copies.count;
  });
  return { id, status: t.to, withdrawnSharedCopies: withdrawn, effectiveAt: effectiveAt.toISOString() };
}

// ── Reads ────────────────────────────────────────────────────────────────

const listSelect = {
  id: true,
  type: true,
  title: true,
  status: true,
  version: true,
  orgVisible: true,
  industry: true,
  region: true,
  topics: true,
  submittedAt: true,
  updatedAt: true,
  createdAt: true,
  authorId: true,
  sensitiveFlags: true,
  author: { select: { name: true } },
  offering: { select: { name: true } },
} as const satisfies Prisma.ObservationSelect;

type ListRow = Prisma.ObservationGetPayload<{ select: typeof listSelect }>;

function toListItem(actor: AuthedActor, r: ListRow) {
  const mine = r.authorId === actor.user.id;
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    status: r.status,
    version: r.version,
    orgVisible: r.orgVisible,
    industry: r.industry,
    region: r.region,
    topics: r.topics,
    offering: r.offering?.name ?? null,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    mine,
    // Same-organisation display only (this list never crosses tenants).
    authorName: mine ? "You" : r.author.name,
    sensitiveFlagCount: mine ? parseFlags(r.sensitiveFlags).length : 0,
  };
}
export type ObservationListItem = ReturnType<typeof toListItem>;

/** "My observations" — authored by me in the active workspace. */
export async function listMyObservations(actor: AuthedActor, page: Pagination) {
  assertParticipant(actor);
  const orgId = actor.activeOrganisation?.organisationId;
  if (!orgId) return { items: [], nextCursor: null };
  const rows = await db.observation.findMany({
    where: { AND: [visibleObservations(actor), { authorId: actor.user.id, organisationId: orgId }] },
    select: listSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const p = toPage(rows, page);
  return { items: p.items.map((r) => toListItem(actor, r)), nextCursor: p.nextCursor };
}

/** "Our organisation's observations" — explicitly shared within the active workspace (read-only to members). */
export async function listOrgObservations(actor: AuthedActor, page: Pagination) {
  assertParticipant(actor);
  const orgId = actor.activeOrganisation?.organisationId;
  if (!orgId) return { items: [], nextCursor: null };
  const rows = await db.observation.findMany({
    where: { AND: [visibleObservations(actor), { orgVisible: true, organisationId: orgId }] },
    select: listSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const p = toPage(rows, page);
  return { items: p.items.map((r) => toListItem(actor, r)), nextCursor: p.nextCursor };
}

/** Contribution status counts for my observations in the active workspace. */
export async function myStatusCounts(actor: AuthedActor) {
  const orgId = actor.activeOrganisation?.organisationId;
  const counts: Partial<Record<ObservationStatus, number>> = {};
  if (!orgId || !can.accessLearning(actor)) return counts;
  const groups = await db.observation.groupBy({
    by: ["status"],
    where: { AND: [visibleObservations(actor), { authorId: actor.user.id, organisationId: orgId }] },
    _count: { _all: true },
  });
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

export async function countOrgObservations(actor: AuthedActor) {
  const orgId = actor.activeOrganisation?.organisationId;
  if (!orgId || !can.accessLearning(actor)) return 0;
  return db.observation.count({ where: { AND: [visibleObservations(actor), { orgVisible: true, organisationId: orgId }] } });
}

const detailSelect = {
  ...sourceSelect,
  author: { select: { name: true } },
  organisation: { select: { name: true } },
  offering: { select: { id: true, name: true, slug: true } },
  versions: { select: { version: true, snapshot: true, createdAt: true }, orderBy: { version: "asc" } },
  consents: {
    select: { id: true, version: true, storeAndProcess: true, publishSharedVersion: true, attributeOrganisation: true, futureTraining: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
  // Contributor-facing: action + public reason only. internalNote and moderator identity never selected.
  decisions: { select: { id: true, version: true, action: true, publicReason: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  sharedCopies: {
    select: { id: true, version: true, status: true, title: true, region: true, periodLabel: true, topics: true, attributionLabel: true, publishedAt: true, updatedAt: true },
    orderBy: { publishedAt: "asc" },
  },
} as const satisfies Prisma.ObservationSelect;

export type ViewerRole = "author" | "org_member" | "moderator" | "support";

/**
 * Detail of a private source for an actor who may view it. Authors get the full timeline
 * (versions, public decision reasons, consent history, shared copies); org members get a
 * read-only view; moderators are pointed to the moderation workspace.
 */
export async function getObservationDetail(actor: AuthedActor, id: string) {
  const row = await db.observation.findFirst({ where: { AND: [{ id }, visibleObservations(actor)] }, select: detailSelect });
  if (!row) throw notFound();
  const access = observationAccess(actor, row);
  if (!access.view) throw notFound();
  const isAuthor = row.authorId === actor.user.id;
  const role: ViewerRole = isAuthor
    ? "author"
    : row.orgVisible && actor.memberships.some((m) => m.organisationId === row.organisationId)
      ? "org_member"
      : can.moderateLearning(actor) && row.submittedAt
        ? "moderator"
        : isPortalAdmin(actor)
          ? "support"
          : "org_member";

  const base = {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    offering: row.offering,
    industry: row.industry,
    region: row.region,
    periodStart: isoDay(row.periodStart),
    periodEnd: isoDay(row.periodEnd),
    evidenceType: row.evidenceType,
    confidence: row.confidence,
    topics: row.topics,
    orgVisible: row.orgVisible,
    status: row.status,
    version: row.version,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    organisationName: row.organisation.name,
    authorName: isAuthor ? "You" : row.author.name,
    viewerRole: role,
  };

  if (!isAuthor) {
    return { ...base, links: role === "org_member" ? row.links : [], author: null };
  }

  const canEdit = access.edit;
  return {
    ...base,
    links: row.links,
    author: {
      sensitiveFlags: parseFlags(row.sensitiveFlags),
      versions: row.versions.map((v) => ({ version: v.version, createdAt: v.createdAt.toISOString(), snapshot: v.snapshot as Record<string, unknown> })),
      consents: row.consents.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      decisions: row.decisions.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
      sharedCopies: row.sharedCopies.map((s) => ({ ...s, publishedAt: s.publishedAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
      actions: {
        edit: canEdit && isFreelyEditable(row.status),
        amend: canEdit && isAmendable(row.status),
        submit: canEdit && row.status === "DRAFT",
        resubmit: canEdit && row.status === "RETURNED",
        withdraw: canEdit && WITHDRAWABLE.includes(row.status),
        delete: canEdit && canDeleteStatus(row.status) && !row.submittedAt,
        toggleOrgVisible: canEdit,
      },
    },
  };
}
export type ObservationDetail = Awaited<ReturnType<typeof getObservationDetail>>;

/** Source fields for the edit form (author only). */
export async function getObservationForEdit(actor: AuthedActor, id: string) {
  const row = await loadOwn(actor, id);
  if (!isFreelyEditable(row.status) && !isAmendable(row.status)) throw conflict("This contribution can't be edited in its current state.");
  const latestConsent = await db.sharingConsent.findFirst({
    where: { observationId: id, publishSharedVersion: true },
    orderBy: { createdAt: "desc" },
    select: { attributeOrganisation: true, futureTraining: true },
  });
  return {
    id: row.id,
    status: row.status,
    version: row.version,
    values: {
      type: row.type,
      title: row.title,
      body: row.body,
      offeringId: row.offeringId ?? null,
      industry: row.industry,
      region: row.region,
      periodStart: isoDay(row.periodStart),
      periodEnd: isoDay(row.periodEnd),
      evidenceType: row.evidenceType,
      confidence: row.confidence,
      topics: row.topics,
      links: row.links,
      orgVisible: row.orgVisible,
    },
    latestConsent,
  };
}

/** Offerings for contribution, theme and idea forms (reference data). */
export function listOfferingOptions() {
  return db.offering.findMany({ select: { id: true, name: true, slug: true, industry: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
export type OfferingOption = Awaited<ReturnType<typeof listOfferingOptions>>[number];
