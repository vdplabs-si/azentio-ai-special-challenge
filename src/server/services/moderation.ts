import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ModerationAction, ObservationStatus, SharedStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, conflict, forbidden, notFound } from "@/lib/api/errors";
import type { AuthedActor } from "@/lib/authz/actor";
import { sharedFeedWhere, visibleObservations } from "@/lib/authz/visibility";
import { assertTransition, auditAction, type Transition } from "@/server/learning/lifecycle";
import { parseFlags, scanContribution } from "@/server/learning/sensitive-scan";
import { coarsenPeriod, coarsenRegion, findLocationMentions } from "@/server/learning/coarsen";
import { topSimilar } from "@/server/learning/similarity";
import type { ModerationDecisionInput, ReportDecisionInput } from "@/server/learning/schemas";
import { assertModerator } from "@/server/learning/guard";

type Tx = Prisma.TransactionClient;

const LIVE: SharedStatus[] = ["PUBLISHED", "SUSPENDED"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const DEFAULT_PUBLIC_REASON: Record<"publish" | "suspend" | "reinstate" | "remove", string> = {
  publish: "Approved for the learning community after review. Only the reviewed, de-identified shared copy is visible to participants.",
  suspend: "Your shared contribution has been temporarily unpublished while a concern raised about it is reviewed.",
  reinstate: "The review is complete and your shared contribution is visible to participants again.",
  remove: "After review, your shared contribution has been removed from the learning community.",
};

const NOTIFY_COPY: Record<string, { type: string; title: string }> = {
  return: { type: "observation.returned", title: "Clarification requested on your contribution" },
  publish: { type: "observation.published", title: "Your contribution was published" },
  reject: { type: "observation.rejected", title: "Your contribution was not published" },
  decline_amendment: { type: "observation.amendment_declined", title: "Your amendment was not published" },
  suspend: { type: "observation.suspended", title: "Your shared contribution is temporarily unpublished" },
  reinstate: { type: "observation.reinstated", title: "Your shared contribution was reinstated" },
  remove: { type: "observation.removed", title: "Your shared contribution was removed" },
};

/** Tell the contributor about a moderator state change — public reason only, never the reporter or internal notes. */
async function notifyAuthor(
  tx: Tx,
  o: { id: string; authorId: string; title: string },
  action: keyof typeof NOTIFY_COPY,
  publicReason: string,
  decisionId: string,
) {
  const copy = NOTIFY_COPY[action]!;
  await notify(
    {
      userId: o.authorId,
      type: copy.type,
      title: copy.title,
      body: `“${o.title}”: ${publicReason}`,
      link: `/portal/observations/${o.id}`,
      email: true,
      idempotencyKey: `obs:${o.id}:decision:${decisionId}`,
    },
    tx,
  );
}

async function recordDecision(
  tx: Tx,
  actor: AuthedActor,
  o: { id: string; version: number },
  action: ModerationAction,
  publicReason: string,
  internalNote?: string | null,
) {
  return tx.moderationDecision.create({
    data: { observationId: o.id, version: o.version, moderatorId: actor.user.id, action, publicReason, internalNote: internalNote || null },
    select: { id: true },
  });
}

/** Apply one lifecycle transition to the source with a guarded update + audit event. */
async function transitionSource<T extends { id: string; status: ObservationStatus; version: number; organisationId: string }>(
  tx: Tx,
  actor: AuthedActor,
  o: T,
  t: Transition,
  metadata: Record<string, Prisma.InputJsonValue | null> = {},
): Promise<T> {
  const res = await tx.observation.updateMany({ where: { id: o.id, status: o.status, version: o.version }, data: { status: t.to } });
  if (res.count !== 1) throw conflict("This contribution changed while you were reviewing it. Reload and try again.");
  await audit(
    {
      actorId: actor.user.id,
      action: auditAction(t),
      entityType: "Observation",
      entityId: o.id,
      organisationId: o.organisationId,
      metadata: { from: o.status, to: t.to, version: o.version, ...metadata },
    },
    tx,
  );
  return { ...o, status: t.to };
}

// ── Queue ────────────────────────────────────────────────────────────────

/** SUBMITTED contributions, oldest first. Unsubmitted drafts are never visible to moderators. */
export async function moderationQueue(actor: AuthedActor) {
  assertModerator(actor);
  const [rows, openReports] = await Promise.all([
    db.observation.findMany({
      where: { AND: [visibleObservations(actor), { status: "SUBMITTED", submittedAt: { not: null } }] },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        version: true,
        industry: true,
        region: true,
        submittedAt: true,
        authorId: true,
        sensitiveFlags: true,
        offering: { select: { name: true } },
        organisation: { select: { name: true } },
        sharedCopies: { where: { status: { in: LIVE } }, select: { id: true }, take: 1 },
      },
    }),
    db.contributionReport.count({ where: { status: "OPEN" } }),
  ]);
  return {
    openReports,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      version: r.version,
      industry: r.industry,
      region: r.region,
      offering: r.offering?.name ?? null,
      organisationName: r.organisation.name,
      submittedAt: r.submittedAt!.toISOString(),
      flagCount: parseFlags(r.sensitiveFlags).length,
      isAmendment: r.sharedCopies.length > 0,
      ownContribution: r.authorId === actor.user.id,
    })),
  };
}

// ── Review ───────────────────────────────────────────────────────────────

const reviewSelect = {
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
  status: true,
  version: true,
  sensitiveFlags: true,
  submittedAt: true,
  updatedAt: true,
  offering: { select: { name: true, slug: true } },
  organisation: { select: { name: true } },
  consents: { orderBy: { createdAt: "desc" }, select: { id: true, version: true, storeAndProcess: true, publishSharedVersion: true, attributeOrganisation: true, futureTraining: true, createdAt: true } },
  versions: { orderBy: { version: "desc" }, select: { version: true, createdAt: true, snapshot: true } },
  decisions: {
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, action: true, publicReason: true, internalNote: true, createdAt: true, moderator: { select: { name: true } } },
  },
  sharedCopies: {
    orderBy: { publishedAt: "desc" },
    select: { id: true, version: true, status: true, title: true, body: true, region: true, periodLabel: true, topics: true, attributionLabel: true, publishedAt: true },
  },
} as const satisfies Prisma.ObservationSelect;

async function loadForModeration(actor: AuthedActor, id: string) {
  assertModerator(actor);
  const row = await db.observation.findFirst({
    where: { AND: [{ id }, visibleObservations(actor), { submittedAt: { not: null } }] },
    select: reviewSelect,
  });
  if (!row) throw notFound();
  return row;
}

/**
 * Moderator review workspace: private source (allowed once submitted), consent for the current
 * version, scan flags, location hints, duplicate hints and a pre-filled, coarsened shared copy draft.
 * The contributor's personal identity is not shown — only their organisation (needed for attribution).
 */
export async function getReview(actor: AuthedActor, id: string) {
  const row = await loadForModeration(actor, id);
  const consent = row.consents.find((c) => c.version === row.version) ?? null;
  const flags = parseFlags(row.sensitiveFlags);
  const liveCopy = row.sharedCopies.find((s) => LIVE.includes(s.status)) ?? null;

  const candidates = await db.sharedObservation.findMany({
    where: { AND: [sharedFeedWhere(actor), { sourceObservationId: { not: row.id } }] },
    orderBy: { publishedAt: "desc" },
    take: 500,
    select: { id: true, title: true, body: true, topics: true },
  });
  const duplicates = topSimilar(row, candidates, 3);

  const openReports = await db.contributionReport.findMany({
    where: { status: "OPEN", sharedObservation: { sourceObservationId: row.id } },
    orderBy: { createdAt: "asc" },
    select: { id: true, reason: true, details: true, createdAt: true },
  });

  return {
    source: {
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
      links: row.links,
      status: row.status,
      version: row.version,
      submittedAt: row.submittedAt!.toISOString(),
      organisationName: row.organisation.name,
      flags,
    },
    consent: consent ? { ...consent, createdAt: consent.createdAt.toISOString() } : null,
    consentHistory: row.consents.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    versions: row.versions.map((v) => ({ version: v.version, createdAt: v.createdAt.toISOString(), snapshot: v.snapshot as Record<string, unknown> })),
    decisions: row.decisions.map((d) => ({
      id: d.id,
      version: d.version,
      action: d.action,
      publicReason: d.publicReason,
      internalNote: d.internalNote,
      moderatorName: d.moderator.name,
      createdAt: d.createdAt.toISOString(),
    })),
    liveCopy: liveCopy ? { ...liveCopy, publishedAt: liveCopy.publishedAt.toISOString() } : null,
    sharedCopies: row.sharedCopies.map((s) => ({ id: s.id, version: s.version, status: s.status, publishedAt: s.publishedAt.toISOString() })),
    duplicates,
    locationMentions: findLocationMentions(`${row.title}\n${row.body}`),
    periodPreview: {
      half: coarsenPeriod(row.periodStart, row.periodEnd, "half").label,
      year: coarsenPeriod(row.periodStart, row.periodEnd, "year").label,
    },
    suggestedCopy: {
      title: row.title,
      body: row.body,
      region: coarsenRegion(row.region),
      periodGranularity: "half" as const,
      topics: row.topics,
      attributeOrganisation: false,
    },
    openReports: openReports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    canDecide: row.status === "SUBMITTED" && row.authorId !== actor.user.id,
    ownContribution: row.authorId === actor.user.id,
  };
}
export type ReviewData = Awaited<ReturnType<typeof getReview>>;

/** RETURN_FOR_CLARIFICATION | REJECT | PUBLISH a SUBMITTED contribution. */
export async function decideObservation(actor: AuthedActor, id: string, input: ModerationDecisionInput) {
  const row = await loadForModeration(actor, id);
  if (row.authorId === actor.user.id) throw forbidden("You can't moderate your own contribution. Another moderator must review it.");
  if (input.version && input.version !== row.version) {
    throw conflict("A newer version of this contribution was submitted. Reload to review the latest version.");
  }
  const src = { id: row.id, status: row.status, version: row.version, organisationId: row.organisationId };
  const liveCopies = row.sharedCopies.filter((s) => LIVE.includes(s.status));

  if (input.action === "RETURN_FOR_CLARIFICATION") {
    const t = assertTransition(row.status, "RETURNED", "moderator", "return");
    await db.$transaction(async (tx) => {
      await transitionSource(tx, actor, src, t, { liveSharedCopyRemains: liveCopies.length > 0 });
      const d = await recordDecision(tx, actor, row, "RETURN_FOR_CLARIFICATION", input.publicReason, input.internalNote);
      await notifyAuthor(tx, row, "return", input.publicReason, d.id);
    });
    return { id, status: t.to };
  }

  if (input.action === "REJECT") {
    // Declining an amendment keeps the previously approved copy as the shared version.
    const livePublished = liveCopies.find((s) => s.status === "PUBLISHED");
    const liveSuspended = liveCopies.find((s) => s.status === "SUSPENDED");
    const t = livePublished || liveSuspended
      ? assertTransition(row.status, "PUBLISHED", "moderator", "decline_amendment")
      : assertTransition(row.status, "REJECTED", "moderator", "reject");
    const status = await db.$transaction(async (tx) => {
      let cur = await transitionSource(tx, actor, src, t, { category: input.category ?? null });
      const d = await recordDecision(tx, actor, row, "REJECT", input.publicReason, input.internalNote);
      await notifyAuthor(tx, row, t.action === "decline_amendment" ? "decline_amendment" : "reject", input.publicReason, d.id);
      if (t.action === "decline_amendment" && !livePublished && liveSuspended) {
        // The remaining copy is under investigation: keep the source status consistent with it.
        cur = await transitionSource(tx, actor, cur, assertTransition(cur.status, "SUSPENDED", "moderator", "suspend"), {
          reason: "previous copy already suspended",
        });
      }
      return cur.status;
    });
    return { id, status };
  }

  // PUBLISH
  const t = assertTransition(row.status, "PUBLISHED", "moderator", "publish");
  const consent = row.consents.find((c) => c.version === row.version);
  if (!consent || !consent.storeAndProcess || !consent.publishSharedVersion) {
    throw conflict("There is no publishing consent recorded for this version, so it cannot be published.");
  }
  const copy = input.sharedCopy;
  const sourceFlags = parseFlags(row.sensitiveFlags);
  const copyFlags = scanContribution({ title: copy.title, body: copy.body, topics: copy.topics });
  if ((sourceFlags.length > 0 || copyFlags.length > 0) && input.acknowledgedFlags !== true) {
    throw new AppError("validation_failed", "Confirm you reviewed the flagged content before publishing.", {
      acknowledgedFlags: ["Tick “I reviewed the flagged content” to publish a flagged contribution."],
    });
  }
  const region = coarsenRegion(copy.region);
  const period = coarsenPeriod(row.periodStart, row.periodEnd, copy.periodGranularity);
  // Attribution requires BOTH the contributor's consent (c) for this version AND moderator approval.
  const attributionLabel = consent.attributeOrganisation && copy.attributeOrganisation ? row.organisation.name : null;
  const publicReason = input.publicReason || DEFAULT_PUBLIC_REASON.publish;

  const shared = await db.$transaction(async (tx) => {
    await transitionSource(tx, actor, src, t, {
      attributed: attributionLabel !== null,
      sourceFlagCount: sourceFlags.length,
      sharedCopyFlagCount: copyFlags.length,
      flagsAcknowledged: input.acknowledgedFlags === true,
    });
    const superseded = await tx.sharedObservation.updateMany({
      where: { sourceObservationId: row.id, status: { in: LIVE } },
      data: { status: "SUPERSEDED" },
    });
    // Only reviewed fields are copied — never author, tenant, links, consent, notes or flags.
    const created = await tx.sharedObservation.create({
      data: {
        sourceObservationId: row.id,
        version: row.version,
        type: row.type,
        title: copy.title,
        body: copy.body,
        offeringId: row.offeringId,
        industry: row.industry,
        region,
        periodLabel: period.label,
        periodStart: period.periodStart,
        evidenceType: row.evidenceType,
        confidence: row.confidence,
        topics: [...new Set(copy.topics)],
        attributionLabel,
      },
      select: { id: true },
    });
    const d = await recordDecision(tx, actor, row, "PUBLISH", publicReason, input.internalNote);
    await audit(
      {
        actorId: actor.user.id,
        action: "shared_observation.create",
        entityType: "SharedObservation",
        entityId: created.id,
        organisationId: row.organisationId,
        metadata: { observationId: row.id, version: row.version, supersededCount: superseded.count },
      },
      tx,
    );
    await notifyAuthor(tx, row, "publish", publicReason, d.id);
    return created;
  });
  return { id, status: t.to, sharedObservationId: shared.id };
}

// ── Reports ──────────────────────────────────────────────────────────────

export async function listReports(actor: AuthedActor, status: "OPEN" | "RESOLVED" | "ALL" = "OPEN") {
  assertModerator(actor);
  const where: Prisma.ContributionReportWhereInput =
    status === "OPEN" ? { status: "OPEN" } : status === "RESOLVED" ? { status: { not: "OPEN" } } : {};
  const rows = await db.contributionReport.findMany({
    where,
    orderBy: status === "OPEN" ? [{ createdAt: "asc" }] : [{ createdAt: "desc" }],
    take: 200,
    // The reporter's identity is deliberately NOT selected.
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      resolvedAt: true,
      sharedObservation: {
        select: {
          id: true,
          sourceObservationId: true,
          version: true,
          status: true,
          title: true,
          body: true,
          region: true,
          periodLabel: true,
          topics: true,
          attributionLabel: true,
          publishedAt: true,
          _count: { select: { reports: { where: { status: "OPEN" } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    shared: {
      id: r.sharedObservation.id,
      observationId: r.sharedObservation.sourceObservationId, // moderator-only view
      version: r.sharedObservation.version,
      status: r.sharedObservation.status,
      title: r.sharedObservation.title,
      body: r.sharedObservation.body,
      region: r.sharedObservation.region,
      periodLabel: r.sharedObservation.periodLabel,
      topics: r.sharedObservation.topics,
      attributionLabel: r.sharedObservation.attributionLabel,
      publishedAt: r.sharedObservation.publishedAt.toISOString(),
      openReports: r.sharedObservation._count.reports,
    },
  }));
}
export type ReportItem = Awaited<ReturnType<typeof listReports>>[number];

/**
 * SUSPEND (temporary unpublish during investigation) | REINSTATE | REMOVE | DISMISS.
 * The contributor is informed of state changes with an audience-appropriate reason; the reporter is never revealed.
 */
export async function decideReport(actor: AuthedActor, reportId: string, input: ReportDecisionInput) {
  assertModerator(actor);
  const report = await db.contributionReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      sharedObservation: {
        select: {
          id: true,
          status: true,
          version: true,
          source: { select: { id: true, authorId: true, title: true, status: true, version: true, organisationId: true } },
        },
      },
    },
  });
  if (!report) throw notFound();
  if (report.status !== "OPEN") throw conflict("This report has already been resolved.");
  const copy = report.sharedObservation;
  const src = copy.source;
  if (src.authorId === actor.user.id) throw forbidden("You can't moderate reports about your own contribution.");
  const now = new Date();

  const setCopyStatus = async (tx: Tx, from: SharedStatus[], to: SharedStatus) => {
    const res = await tx.sharedObservation.updateMany({ where: { id: copy.id, status: { in: from } }, data: { status: to } });
    if (res.count !== 1) throw conflict("The shared copy changed while you were reviewing it. Reload and try again.");
  };
  const meta = { sharedObservationId: copy.id, reportId: report.id };

  if (input.action === "DISMISS") {
    if (copy.status === "SUSPENDED") throw conflict("This copy is suspended — reinstate or remove it instead of dismissing.");
    await db.$transaction(async (tx) => {
      await tx.contributionReport.update({
        where: { id: report.id },
        data: { status: "RESOLVED_KEPT", decisionNote: input.note, resolvedById: actor.user.id, resolvedAt: now },
      });
      await audit({ actorId: actor.user.id, action: "report.dismiss", entityType: "ContributionReport", entityId: report.id, metadata: meta }, tx);
    });
    return { reportStatus: "RESOLVED_KEPT" as const, sharedStatus: copy.status };
  }

  if (input.action === "SUSPEND") {
    if (copy.status !== "PUBLISHED") throw conflict("Only a published copy can be suspended.");
    const publicReason = input.publicReason || DEFAULT_PUBLIC_REASON.suspend;
    await db.$transaction(async (tx) => {
      await setCopyStatus(tx, ["PUBLISHED"], "SUSPENDED");
      if (src.status === "PUBLISHED") {
        await transitionSource(tx, actor, src, assertTransition(src.status, "SUSPENDED", "moderator", "suspend"), meta);
      } else {
        await audit(
          { actorId: actor.user.id, action: "observation.suspend", entityType: "Observation", entityId: src.id, organisationId: src.organisationId, metadata: { ...meta, sourceStatus: src.status, copyOnly: true } },
          tx,
        );
      }
      await tx.contributionReport.update({ where: { id: report.id }, data: { decisionNote: input.note } });
      const d = await recordDecision(tx, actor, { id: src.id, version: copy.version }, "SUSPEND", publicReason, input.note);
      await notifyAuthor(tx, src, "suspend", publicReason, d.id);
    });
    return { reportStatus: "OPEN" as const, sharedStatus: "SUSPENDED" as const };
  }

  if (input.action === "REINSTATE") {
    if (copy.status !== "SUSPENDED") throw conflict("Only a suspended copy can be reinstated.");
    const publicReason = input.publicReason || DEFAULT_PUBLIC_REASON.reinstate;
    await db.$transaction(async (tx) => {
      await setCopyStatus(tx, ["SUSPENDED"], "PUBLISHED");
      if (src.status === "SUSPENDED") {
        await transitionSource(tx, actor, src, assertTransition(src.status, "PUBLISHED", "moderator", "reinstate"), meta);
      } else {
        await audit(
          { actorId: actor.user.id, action: "observation.reinstate", entityType: "Observation", entityId: src.id, organisationId: src.organisationId, metadata: { ...meta, sourceStatus: src.status, copyOnly: true } },
          tx,
        );
      }
      await tx.contributionReport.updateMany({
        where: { sharedObservationId: copy.id, status: "OPEN" },
        data: { status: "RESOLVED_KEPT", decisionNote: input.note, resolvedById: actor.user.id, resolvedAt: now },
      });
      const d = await recordDecision(tx, actor, { id: src.id, version: copy.version }, "REINSTATE", publicReason, input.note);
      await notifyAuthor(tx, src, "reinstate", publicReason, d.id);
    });
    return { reportStatus: "RESOLVED_KEPT" as const, sharedStatus: "PUBLISHED" as const };
  }

  // REMOVE
  if (copy.status !== "PUBLISHED" && copy.status !== "SUSPENDED") throw conflict("This copy is no longer live; dismiss the report instead.");
  const publicReason = input.publicReason || DEFAULT_PUBLIC_REASON.remove;
  await db.$transaction(async (tx) => {
    await setCopyStatus(tx, ["PUBLISHED", "SUSPENDED"], "REMOVED");
    let cur = { ...src };
    if (cur.status === "PUBLISHED") cur = await transitionSource(tx, actor, cur, assertTransition(cur.status, "SUSPENDED", "moderator", "suspend"), meta);
    if (cur.status === "SUSPENDED") {
      await transitionSource(tx, actor, cur, assertTransition(cur.status, "REJECTED", "moderator", "remove"), meta);
    } else {
      // An amendment is pending review; only the old copy is removed.
      await audit(
        { actorId: actor.user.id, action: "observation.remove", entityType: "Observation", entityId: src.id, organisationId: src.organisationId, metadata: { ...meta, sourceStatus: cur.status, copyOnly: true } },
        tx,
      );
    }
    await tx.contributionReport.updateMany({
      where: { sharedObservationId: copy.id, status: "OPEN" },
      data: { status: "RESOLVED_REMOVED", decisionNote: input.note, resolvedById: actor.user.id, resolvedAt: now },
    });
    const d = await recordDecision(tx, actor, { id: src.id, version: copy.version }, "REMOVE", publicReason, input.note);
    await notifyAuthor(tx, src, "remove", publicReason, d.id);
  });
  return { reportStatus: "RESOLVED_REMOVED" as const, sharedStatus: "REMOVED" as const };
}

/** Hide (or unhide) a comment on a shared copy. */
export async function setCommentHidden(actor: AuthedActor, commentId: string, hidden: boolean) {
  assertModerator(actor);
  const c = await db.sharedObservationComment.findUnique({ where: { id: commentId }, select: { id: true, status: true, sharedObservationId: true } });
  if (!c) throw notFound();
  const status = hidden ? "HIDDEN" : "VISIBLE";
  if (c.status === status) return { id: c.id, status };
  await db.$transaction(async (tx) => {
    await tx.sharedObservationComment.update({ where: { id: c.id }, data: { status } });
    await audit(
      {
        actorId: actor.user.id,
        action: hidden ? "shared_comment.hide" : "shared_comment.unhide",
        entityType: "SharedObservationComment",
        entityId: c.id,
        metadata: { sharedObservationId: c.sharedObservationId },
      },
      tx,
    );
  });
  return { id: c.id, status };
}

export async function moderationCounts(actor: AuthedActor) {
  assertModerator(actor);
  const [queue, reports] = await Promise.all([
    db.observation.count({ where: { AND: [visibleObservations(actor), { status: "SUBMITTED", submittedAt: { not: null } }] } }),
    db.contributionReport.count({ where: { status: "OPEN" } }),
  ]);
  return { queue, reports };
}
