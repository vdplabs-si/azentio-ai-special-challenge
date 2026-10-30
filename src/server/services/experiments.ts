import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ExperimentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { Actor, AuthedActor } from "@/lib/authz/actor";
import { assert, can, isPortalAdmin } from "@/lib/authz/permissions";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, notFound } from "@/lib/api/errors";
import { pageArgs, paginationSchema, toPage } from "@/lib/api/pagination";

export const EXPERIMENT_STATUSES = ["SUBMITTED", "IN_REVIEW", "ACCEPTED", "ARCHIVED"] as const;

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  SUBMITTED: "submitted",
  IN_REVIEW: "in review",
  ACCEPTED: "accepted",
  ARCHIVED: "archived",
};

// ── Validation ───────────────────────────────────────────────────────────

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().min(1).max(64).nullable().optional(),
);

export const experimentCreateSchema = z.object({
  title: z.string().trim().min(5, "Use at least 5 characters.").max(160),
  hypothesis: z.string().trim().min(10, "Describe the hypothesis (at least 10 characters).").max(4000),
  approach: z.string().trim().min(10, "Describe the approach (at least 10 characters).").max(8000),
  offeringId: optionalId,
});

export const experimentUpdateSchema = z
  .object({
    title: experimentCreateSchema.shape.title.optional(),
    hypothesis: experimentCreateSchema.shape.hypothesis.optional(),
    approach: experimentCreateSchema.shape.approach.optional(),
    offeringId: optionalId,
    // Reviewer fields
    status: z.enum(EXPERIMENT_STATUSES).optional(),
    feedback: z.string().trim().max(4000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");

export const experimentListQuery = paginationSchema.extend({
  mine: z.enum(["1", "0"]).optional(),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
  offeringId: z.string().min(1).max(64).optional(),
  q: z.string().trim().max(100).optional(),
});

export type ExperimentCreateInput = z.infer<typeof experimentCreateSchema>;
export type ExperimentUpdateInput = z.infer<typeof experimentUpdateSchema>;
export type ExperimentListQuery = z.infer<typeof experimentListQuery>;

// ── Permissions ──────────────────────────────────────────────────────────

/** Reviewers: employees holding PRODUCT_OWNER or portal administration. */
export const canReviewExperiments = (a: Actor) => a.isEmployee && (can.manageIdeas(a) || isPortalAdmin(a));

/** Experiments are an employee-only area: everyone else gets 404, never 403. */
function requireEmployee(actor: AuthedActor) {
  if (!can.accessEmployeeArea(actor)) throw notFound();
}

const select = {
  id: true,
  title: true,
  hypothesis: true,
  approach: true,
  status: true,
  feedback: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { name: true } },
  offering: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ExperimentSelect;

// ── Reads ────────────────────────────────────────────────────────────────

export async function listExperiments(actor: AuthedActor, q: ExperimentListQuery) {
  requireEmployee(actor);
  const where: Prisma.ExperimentWhereInput = {
    ...(q.mine === "1" ? { authorId: actor.user.id } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.offeringId ? { offeringId: q.offeringId } : {}),
    ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { hypothesis: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await db.experiment.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select,
    ...pageArgs(q),
  });
  return toPage(rows, q);
}

export async function experimentStatusCounts(actor: AuthedActor) {
  requireEmployee(actor);
  const [groups, mine] = await Promise.all([
    db.experiment.groupBy({ by: ["status"], _count: { _all: true } }),
    db.experiment.count({ where: { authorId: actor.user.id } }),
  ]);
  const counts = Object.fromEntries(EXPERIMENT_STATUSES.map((s) => [s, 0])) as Record<ExperimentStatus, number>;
  for (const g of groups) counts[g.status] = g._count._all;
  return { ...counts, mine };
}

/** Page/API getter: null when the actor is not an employee or the experiment does not exist. */
export async function getExperiment(actor: AuthedActor, id: string) {
  if (!can.accessEmployeeArea(actor)) return null;
  const e = await db.experiment.findUnique({ where: { id }, select });
  if (!e) return null;
  const isAuthor = e.authorId === actor.user.id;
  return {
    ...e,
    isAuthor,
    canEdit: isAuthor && e.status === "SUBMITTED",
    canReview: canReviewExperiments(actor) && !isAuthor,
  };
}

/** Offerings for the optional offering selector (public catalogue metadata). */
export async function listOfferingOptions(actor: AuthedActor) {
  requireEmployee(actor);
  return db.offering.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

// ── Mutations ────────────────────────────────────────────────────────────

async function checkOffering(offeringId: string | null | undefined) {
  if (!offeringId) return;
  const exists = await db.offering.count({ where: { id: offeringId } });
  if (!exists) throw new AppError("validation_failed", "Choose an existing offering.", { offeringId: ["Choose an existing offering."] });
}

export async function createExperiment(actor: AuthedActor, input: ExperimentCreateInput) {
  requireEmployee(actor);
  await checkOffering(input.offeringId);
  return db.$transaction(async (tx) => {
    const created = await tx.experiment.create({
      data: {
        title: input.title,
        hypothesis: input.hypothesis,
        approach: input.approach,
        offeringId: input.offeringId ?? null,
        authorId: actor.user.id,
      },
      select: { id: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "experiment.create",
        entityType: "Experiment",
        entityId: created.id,
        metadata: { offeringId: input.offeringId ?? null },
      },
      tx,
    );
    return created;
  });
}

/**
 * Author edits (title/hypothesis/approach/offering) only while SUBMITTED.
 * Reviewers (not the author) set status and feedback; the author is notified.
 */
export async function updateExperiment(actor: AuthedActor, id: string, input: ExperimentUpdateInput) {
  requireEmployee(actor);
  const e = await db.experiment.findUnique({ where: { id }, select: { id: true, authorId: true, status: true, title: true, feedback: true } });
  if (!e) throw notFound();
  const isAuthor = e.authorId === actor.user.id;

  const contentKeys = (["title", "hypothesis", "approach", "offeringId"] as const).filter((k) => input[k] !== undefined);
  const reviewKeys = (["status", "feedback"] as const).filter((k) => input[k] !== undefined);

  if (contentKeys.length) {
    assert(isAuthor, "Only the author can edit this experiment.");
    if (e.status !== "SUBMITTED") throw new AppError("conflict", "Experiments can only be edited while they are submitted and not yet in review.");
    await checkOffering(input.offeringId);
  }
  if (reviewKeys.length) {
    assert(canReviewExperiments(actor), "Only product owners or portal administrators can review experiments.");
    assert(!isAuthor, "You cannot review your own experiment.");
  }

  const data: Prisma.ExperimentUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.hypothesis !== undefined) data.hypothesis = input.hypothesis;
  if (input.approach !== undefined) data.approach = input.approach;
  if (input.offeringId !== undefined) data.offeringId = input.offeringId;
  if (input.status !== undefined) data.status = input.status;
  if (input.feedback !== undefined) data.feedback = input.feedback;

  const statusChanged = input.status !== undefined && input.status !== e.status;
  const feedbackChanged = input.feedback !== undefined && input.feedback !== e.feedback;

  await db.$transaction(async (tx) => {
    await tx.experiment.update({ where: { id }, data });
    if (contentKeys.length) {
      await audit(
        { actorId: actor.user.id, action: "experiment.update", entityType: "Experiment", entityId: id, metadata: { fields: contentKeys } },
        tx,
      );
    }
    if (reviewKeys.length) {
      await audit(
        {
          actorId: actor.user.id,
          action: "experiment.review",
          entityType: "Experiment",
          entityId: id,
          metadata: { fromStatus: e.status, toStatus: input.status ?? e.status, feedbackUpdated: feedbackChanged },
        },
        tx,
      );
      if (statusChanged || feedbackChanged) {
        const status = input.status ?? e.status;
        await notify(
          {
            userId: e.authorId,
            type: "experiment.reviewed",
            title: statusChanged ? `Experiment ${STATUS_LABEL[status]}` : "New feedback on your experiment",
            body: statusChanged
              ? `“${e.title}” is now ${STATUS_LABEL[status]}${feedbackChanged ? " — the reviewer left feedback." : "."}`
              : `A reviewer updated the feedback on “${e.title}”.`,
            link: `/portal/experiments/${id}`,
          },
          tx,
        );
      }
    }
  });
  return { id };
}
