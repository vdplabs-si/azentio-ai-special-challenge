import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { IdeaStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import { AppError, conflict, notFound } from "@/lib/api/errors";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, can } from "@/lib/authz/permissions";
import { sharedFeedWhere, visibleIdeas, visibleThemes } from "@/lib/authz/visibility";
import { sharedSelect, toSharedDTO } from "@/server/learning/dto";
import { IDEA_STATUS_EXPLANATIONS, IDEA_STATUS_LABELS } from "@/server/learning/labels";
import type { IdeaInput } from "@/server/learning/schemas";
import { assertParticipant } from "@/server/learning/guard";

const ideaBaseSelect = {
  id: true,
  title: true,
  status: true,
  updatedAt: true,
  publicStatusNote: true,
  team: true,
  visibility: true,
  priority: true,
  offering: { select: { id: true, name: true, slug: true } },
  owner: { select: { id: true, name: true } },
  theme: { select: { id: true, title: true, status: true } },
} as const satisfies Prisma.ImprovementIdeaSelect;

type IdeaBaseRow = Prisma.ImprovementIdeaGetPayload<{ select: typeof ideaBaseSelect }>;

/**
 * What participants (clients) may see of an idea: title, plain-language status, offering, owner
 * display name + team, last update, public status note and linked theme title (only if that theme
 * is published). Never internal notes, priority or evidence.
 */
export interface ClientIdeaDTO {
  id: string;
  title: string;
  status: IdeaStatus;
  statusLabel: string;
  statusExplanation: string;
  offering: { name: string; slug: string };
  ownerName: string;
  team: string;
  updatedAt: string;
  publicStatusNote: string;
  themeTitle: string | null;
}

function toClientIdea(r: IdeaBaseRow): ClientIdeaDTO {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    statusLabel: IDEA_STATUS_LABELS[r.status],
    statusExplanation: IDEA_STATUS_EXPLANATIONS[r.status],
    offering: { name: r.offering.name, slug: r.offering.slug },
    ownerName: r.owner.name,
    team: r.team,
    updatedAt: r.updatedAt.toISOString(),
    publicStatusNote: r.publicStatusNote,
    themeTitle: r.theme && r.theme.status === "PUBLISHED" ? r.theme.title : null,
  };
}

/** Employees see internal fields too. */
function toInternalIdea(r: IdeaBaseRow) {
  return {
    ...toClientIdea(r),
    visibility: r.visibility,
    priority: r.priority,
    ownerId: r.owner.id,
    offeringId: r.offering.id,
    theme: r.theme,
  };
}
export type InternalIdeaDTO = ReturnType<typeof toInternalIdea>;

export async function listIdeas(actor: AuthedActor, filters: { status?: IdeaStatus; offering?: string } = {}) {
  assertParticipant(actor);
  const where: Prisma.ImprovementIdeaWhereInput = {
    AND: [
      visibleIdeas(actor),
      filters.status ? { status: filters.status } : {},
      filters.offering ? { offering: { slug: filters.offering } } : {},
    ],
  };
  const rows = await db.improvementIdea.findMany({ where, select: ideaBaseSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 200 });
  return actor.isEmployee
    ? { audience: "internal" as const, items: rows.map(toInternalIdea) }
    : { audience: "participant" as const, items: rows.map(toClientIdea) };
}

export async function getIdea(actor: AuthedActor, id: string) {
  assertParticipant(actor);
  const row = await db.improvementIdea.findFirst({
    where: { AND: [{ id }, visibleIdeas(actor)] },
    select: {
      ...ideaBaseSelect,
      problemStatement: true,
      proposedOutcome: true,
      internalNotes: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      evidence: { where: { sharedObservation: sharedFeedWhere(actor) }, select: { sharedObservation: { select: sharedSelect } } },
      statusChanges: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true, changedBy: { select: { name: true } } },
      },
    },
  });
  if (!row) throw notFound();
  if (!actor.isEmployee) {
    return { audience: "participant" as const, idea: toClientIdea(row) };
  }
  return {
    audience: "internal" as const,
    canManage: can.manageIdeas(actor),
    idea: {
      ...toInternalIdea(row),
      problemStatement: row.problemStatement,
      proposedOutcome: row.proposedOutcome,
      internalNotes: row.internalNotes,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy.name,
      evidence: row.evidence.map((e) => toSharedDTO(e.sharedObservation)),
      statusChanges: row.statusChanges.map((s) => ({
        id: s.id,
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        note: s.note,
        createdAt: s.createdAt.toISOString(),
        changedBy: s.changedBy.name,
      })),
    },
  };
}
export type IdeaDetail = Awaited<ReturnType<typeof getIdea>>;

function assertManager(actor: AuthedActor) {
  assertParticipant(actor);
  assert(actor.isEmployee && can.manageIdeas(actor), "Only product owners can manage improvement ideas.");
}

/** Validate references: offering exists, theme visible, owner is an active INTERNAL member, evidence PUBLISHED. */
async function validateIdea(actor: AuthedActor, input: IdeaInput) {
  const evidenceIds = [...new Set(input.evidenceIds)];
  const [offering, theme, owner, evidence] = await Promise.all([
    db.offering.count({ where: { id: input.offeringId } }),
    input.themeId ? db.theme.count({ where: { AND: [{ id: input.themeId }, visibleThemes(actor)] } }) : 1,
    db.membership.count({
      where: { userId: input.ownerId, status: "ACTIVE", organisation: { type: "INTERNAL", status: "ACTIVE" }, user: { status: "ACTIVE" } },
    }),
    evidenceIds.length ? db.sharedObservation.count({ where: { AND: [sharedFeedWhere(actor), { id: { in: evidenceIds } }] } }) : 0,
  ]);
  const errors: Record<string, string[]> = {};
  if (!offering) errors.offeringId = ["Choose an offering from the list."];
  if (!theme) errors.themeId = ["Choose a theme from the list."];
  if (!owner) errors.ownerId = ["The owner must be an active Azentio employee."];
  if (evidence !== evidenceIds.length) errors.evidenceIds = ["Only currently published shared contributions can be linked as evidence."];
  if (Object.keys(errors).length) throw new AppError("validation_failed", "Some fields are invalid.", errors);
  return { evidenceIds };
}

export async function createIdea(actor: AuthedActor, input: IdeaInput & { status: IdeaStatus }) {
  assertManager(actor);
  const { evidenceIds } = await validateIdea(actor, input);
  return db.$transaction(async (tx) => {
    const idea = await tx.improvementIdea.create({
      data: {
        title: input.title,
        problemStatement: input.problemStatement,
        proposedOutcome: input.proposedOutcome,
        offeringId: input.offeringId,
        themeId: input.themeId || null,
        ownerId: input.ownerId,
        team: input.team,
        priority: input.priority,
        status: input.status,
        visibility: input.visibility,
        publicStatusNote: input.publicStatusNote,
        internalNotes: input.internalNotes,
        createdById: actor.user.id,
        evidence: { create: evidenceIds.map((sharedObservationId) => ({ sharedObservationId })) },
        statusChanges: { create: { fromStatus: null, toStatus: input.status, note: "Idea created", changedById: actor.user.id } },
      },
      select: { id: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "idea.create",
        entityType: "ImprovementIdea",
        entityId: idea.id,
        metadata: { status: input.status, visibility: input.visibility, evidenceCount: evidenceIds.length },
      },
      tx,
    );
    return idea;
  });
}

export async function updateIdea(actor: AuthedActor, id: string, input: IdeaInput) {
  assertManager(actor);
  const current = await db.improvementIdea.findFirst({
    where: { AND: [{ id }, visibleIdeas(actor)] },
    select: { id: true, visibility: true, evidence: { select: { sharedObservationId: true } } },
  });
  if (!current) throw notFound();
  const { evidenceIds } = await validateIdea(actor, input);
  await db.$transaction(async (tx) => {
    await tx.improvementIdea.update({
      where: { id },
      data: {
        title: input.title,
        problemStatement: input.problemStatement,
        proposedOutcome: input.proposedOutcome,
        offeringId: input.offeringId,
        themeId: input.themeId || null,
        ownerId: input.ownerId,
        team: input.team,
        priority: input.priority,
        visibility: input.visibility,
        publicStatusNote: input.publicStatusNote,
        internalNotes: input.internalNotes,
      },
    });
    const old = new Set(current.evidence.map((e) => e.sharedObservationId));
    const next = new Set(evidenceIds);
    const removed = [...old].filter((e) => !next.has(e));
    const added = [...next].filter((e) => !old.has(e));
    if (removed.length) await tx.ideaEvidence.deleteMany({ where: { ideaId: id, sharedObservationId: { in: removed } } });
    if (added.length) await tx.ideaEvidence.createMany({ data: added.map((sharedObservationId) => ({ ideaId: id, sharedObservationId })) });
    await audit(
      {
        actorId: actor.user.id,
        action: "idea.update",
        entityType: "ImprovementIdea",
        entityId: id,
        metadata: { visibilityFrom: current.visibility, visibilityTo: input.visibility, evidenceAdded: added.length, evidenceRemoved: removed.length },
      },
      tx,
    );
  });
  return { id };
}

/**
 * Every status change creates an IdeaStatusChange + audit. When the idea is shared with participants,
 * authors of the linked (currently published) evidence are told the decision — theme + status + the
 * public note only; no private material, no other clients' information, no internal notes.
 */
export async function changeIdeaStatus(actor: AuthedActor, id: string, input: { status: IdeaStatus; publicStatusNote?: string; note?: string }) {
  assertManager(actor);
  const idea = await db.improvementIdea.findFirst({
    where: { AND: [{ id }, visibleIdeas(actor)] },
    select: { id: true, status: true, visibility: true, publicStatusNote: true, theme: { select: { title: true, status: true } } },
  });
  if (!idea) throw notFound();
  if (idea.status === input.status) throw conflict("The idea already has this status.");
  const publicStatusNote = input.publicStatusNote ?? idea.publicStatusNote;

  const authorIds =
    idea.visibility === "SHARED_WITH_PARTICIPANTS"
      ? [
          ...new Set(
            (
              await db.sharedObservation.findMany({
                where: { AND: [{ ideaEvidence: { some: { ideaId: id } } }, { status: "PUBLISHED" }] },
                select: { source: { select: { authorId: true } } },
              })
            ).map((s) => s.source.authorId),
          ),
        ].filter((uid) => uid !== actor.user.id)
      : [];

  await db.$transaction(async (tx) => {
    const res = await tx.improvementIdea.updateMany({ where: { id, status: idea.status }, data: { status: input.status, publicStatusNote } });
    if (res.count !== 1) throw conflict("This idea changed while you were working on it. Reload and try again.");
    await tx.ideaStatusChange.create({ data: { ideaId: id, fromStatus: idea.status, toStatus: input.status, note: input.note ?? "", changedById: actor.user.id } });
    await audit(
      { actorId: actor.user.id, action: "idea.status", entityType: "ImprovementIdea", entityId: id, metadata: { from: idea.status, to: input.status, notifiedContributors: authorIds.length } },
      tx,
    );
    const theme = idea.theme && idea.theme.status === "PUBLISHED" ? ` under the theme “${idea.theme.title}”` : "";
    const label = IDEA_STATUS_LABELS[input.status];
    await notifyMany(
      authorIds.map((userId) => ({
        userId,
        type: "idea.status",
        title: "Update on an idea informed by your shared contribution",
        body:
          `An improvement idea${theme} that draws on shared learning you contributed is now “${label}”. ${IDEA_STATUS_EXPLANATIONS[input.status]}` +
          (publicStatusNote ? ` Update from the product team: ${publicStatusNote}` : ""),
        link: `/portal/ideas/${id}`,
      })),
      tx,
    );
  });
  return { id, status: input.status, notifiedContributors: authorIds.length };
}

/** Values for the edit form (managers only). */
export async function getIdeaForEdit(actor: AuthedActor, id: string) {
  assertManager(actor);
  const row = await db.improvementIdea.findFirst({
    where: { AND: [{ id }, visibleIdeas(actor)] },
    select: {
      id: true,
      title: true,
      problemStatement: true,
      proposedOutcome: true,
      offeringId: true,
      themeId: true,
      ownerId: true,
      team: true,
      priority: true,
      visibility: true,
      publicStatusNote: true,
      internalNotes: true,
      status: true,
      evidence: {
        where: { sharedObservation: sharedFeedWhere(actor) },
        select: { sharedObservation: { select: { id: true, title: true, periodLabel: true, region: true, type: true } } },
      },
    },
  });
  if (!row) throw notFound();
  const { evidence, status, id: ideaId, ...values } = row;
  return {
    id: ideaId,
    status,
    values: { ...values, themeId: values.themeId ?? "", evidenceIds: evidence.map((e) => e.sharedObservation.id) },
    evidence: evidence.map((e) => e.sharedObservation),
  };
}

/** Active employees (members of the INTERNAL organisation) who can own an idea. */
export async function listIdeaOwnerOptions(actor: AuthedActor) {
  assertManager(actor);
  const rows = await db.membership.findMany({
    where: { status: "ACTIVE", organisation: { type: "INTERNAL", status: "ACTIVE" }, user: { status: "ACTIVE" } },
    select: { user: { select: { id: true, name: true, title: true } } },
    orderBy: { user: { name: "asc" } },
    take: 500,
  });
  const seen = new Set<string>();
  return rows.map((r) => r.user).filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
}
