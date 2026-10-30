import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Confidence } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError, notFound } from "@/lib/api/errors";
import { randomBytes } from "node:crypto";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, can } from "@/lib/authz/permissions";
import { sharedFeedWhere, visibleIdeas, visibleThemes } from "@/lib/authz/visibility";
import { sharedSelect, toSharedDTO } from "@/server/learning/dto";
import { suppressIfBelow, type CohortValue } from "@/server/learning/cohort";
import { suggestGroupings } from "@/server/learning/similarity";
import type { ThemeInput } from "@/server/learning/schemas";
import { assertParticipant, learningMinCohort } from "@/server/learning/guard";

/** Evidence rows: only approved, currently PUBLISHED shared copies count (withdrawal applies instantly). */
const evidenceWhere = (actor: AuthedActor): Prisma.ThemeEvidenceWhereInput => ({ sharedObservation: sharedFeedWhere(actor) });

interface EvidenceStatRow {
  addedAt: Date;
  sharedObservation: { periodStart: Date; periodLabel: string; confidence: Confidence; updatedAt: Date; source: { organisationId: string } };
}

export interface ThemeMetrics {
  contributions: number;
  /** DISTINCT contributing organisations — shown only at or above the cohort minimum. */
  organisations: CohortValue;
  smallSample: boolean;
  period: { from: string; to: string; label: string } | null;
  confidenceMix: Record<Confidence, number>;
  latestUpdate: string;
}

/** Server-side metrics; organisation identifiers are consumed here and never returned. */
function metrics(themeUpdatedAt: Date, rows: EvidenceStatRow[], min: number): ThemeMetrics {
  const orgs = new Set(rows.map((r) => r.sharedObservation.source.organisationId));
  const organisations = suppressIfBelow(orgs.size, min);
  const sorted = [...rows].sort((a, b) => a.sharedObservation.periodStart.getTime() - b.sharedObservation.periodStart.getTime());
  const first = sorted[0]?.sharedObservation;
  const last = sorted[sorted.length - 1]?.sharedObservation;
  const confidenceMix: Record<Confidence, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const r of rows) confidenceMix[r.sharedObservation.confidence]++;
  const latest = Math.max(
    themeUpdatedAt.getTime(),
    ...rows.map((r) => Math.max(r.addedAt.getTime(), r.sharedObservation.updatedAt.getTime())),
  );
  return {
    contributions: rows.length,
    organisations,
    smallSample: organisations.suppressed || rows.length < min,
    period:
      first && last
        ? {
            from: first.periodStart.toISOString(),
            to: last.periodStart.toISOString(),
            label: first.periodLabel === last.periodLabel ? first.periodLabel : `${first.periodLabel.split("–")[0]} – ${last.periodLabel.split("–").pop()}`,
          }
        : null,
    confidenceMix,
    latestUpdate: new Date(latest).toISOString(),
  };
}

const evidenceStatSelect = {
  addedAt: true,
  sharedObservation: {
    select: { periodStart: true, periodLabel: true, confidence: true, updatedAt: true, source: { select: { organisationId: true } } },
  },
} as const;

export async function listThemes(actor: AuthedActor) {
  assertParticipant(actor);
  const min = learningMinCohort();
  const rows = await db.theme.findMany({
    where: visibleThemes(actor),
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      updatedAt: true,
      offerings: { select: { offering: { select: { id: true, name: true, slug: true } } } },
      evidence: { where: evidenceWhere(actor), select: evidenceStatSelect },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    status: t.status,
    offerings: t.offerings.map((o) => o.offering),
    metrics: metrics(t.updatedAt, t.evidence, min),
  }));
}
export type ThemeListItem = Awaited<ReturnType<typeof listThemes>>[number];

/** Theme dashboard (PDF §10). */
export async function getTheme(actor: AuthedActor, id: string) {
  assertParticipant(actor);
  const min = learningMinCohort();
  const t = await db.theme.findFirst({
    where: { AND: [{ id }, visibleThemes(actor)] },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      limitations: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      offerings: { select: { offering: { select: { id: true, name: true, slug: true } } } },
      evidence: {
        where: evidenceWhere(actor),
        orderBy: { addedAt: "desc" },
        select: { ...evidenceStatSelect, sharedObservation: { select: { ...sharedSelect, ...evidenceStatSelect.sharedObservation.select } } },
      },
      ideas: { where: visibleIdeas(actor), select: { id: true, title: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!t) throw notFound();
  const canManage = can.manageThemes(actor);
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    limitations: t.limitations,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    createdBy: canManage ? t.createdBy.name : null,
    offerings: t.offerings.map((o) => o.offering),
    // Explicit DTO mapping drops the source/organisation fields used for metrics.
    evidence: t.evidence.map((e) => ({ addedAt: e.addedAt.toISOString(), item: toSharedDTO(e.sharedObservation) })),
    metrics: metrics(t.updatedAt, t.evidence, min),
    ideas: t.ideas.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() })),
    canManage,
  };
}
export type ThemeDetail = Awaited<ReturnType<typeof getTheme>>;

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "theme"}-${randomBytes(3).toString("hex")}`;
}

/** Validate offerings exist and evidence is currently-PUBLISHED shared copies visible to the actor. */
async function validateLinks(actor: AuthedActor, input: Pick<ThemeInput, "offeringIds" | "evidenceIds">) {
  const offeringIds = [...new Set(input.offeringIds)];
  const evidenceIds = [...new Set(input.evidenceIds)];
  const [offerings, evidence] = await Promise.all([
    offeringIds.length ? db.offering.count({ where: { id: { in: offeringIds } } }) : 0,
    evidenceIds.length ? db.sharedObservation.count({ where: { AND: [sharedFeedWhere(actor), { id: { in: evidenceIds } }] } }) : 0,
  ]);
  const errors: Record<string, string[]> = {};
  if (offerings !== offeringIds.length) errors.offeringIds = ["Choose offerings from the list."];
  if (evidence !== evidenceIds.length) errors.evidenceIds = ["Only currently published shared contributions can be linked as evidence."];
  if (Object.keys(errors).length) throw new AppError("validation_failed", "Some fields are invalid.", errors);
  return { offeringIds, evidenceIds };
}

export async function createTheme(actor: AuthedActor, input: ThemeInput) {
  assertParticipant(actor);
  assert(can.manageThemes(actor), "Only product owners and learning moderators can manage themes.");
  const { offeringIds, evidenceIds } = await validateLinks(actor, input);
  return db.$transaction(async (tx) => {
    const theme = await tx.theme.create({
      data: {
        slug: slugify(input.title),
        title: input.title,
        summary: input.summary,
        limitations: input.limitations,
        status: input.status,
        createdById: actor.user.id,
        offerings: { create: offeringIds.map((offeringId) => ({ offeringId })) },
        evidence: { create: evidenceIds.map((sharedObservationId) => ({ sharedObservationId })) },
      },
      select: { id: true, slug: true },
    });
    await audit(
      { actorId: actor.user.id, action: "theme.create", entityType: "Theme", entityId: theme.id, metadata: { status: input.status, evidenceCount: evidenceIds.length, offeringCount: offeringIds.length } },
      tx,
    );
    return theme;
  });
}

export async function updateTheme(actor: AuthedActor, id: string, input: ThemeInput) {
  assertParticipant(actor);
  assert(can.manageThemes(actor), "Only product owners and learning moderators can manage themes.");
  const current = await db.theme.findFirst({
    where: { AND: [{ id }, visibleThemes(actor)] },
    select: { id: true, status: true, evidence: { select: { sharedObservationId: true } }, offerings: { select: { offeringId: true } } },
  });
  if (!current) throw notFound();
  const { offeringIds, evidenceIds } = await validateLinks(actor, input);
  const oldEvidence = new Set(current.evidence.map((e) => e.sharedObservationId));
  const nextEvidence = new Set(evidenceIds);
  await db.$transaction(async (tx) => {
    await tx.theme.update({
      where: { id },
      data: { title: input.title, summary: input.summary, limitations: input.limitations, status: input.status },
    });
    await tx.themeOffering.deleteMany({ where: { themeId: id } });
    if (offeringIds.length) await tx.themeOffering.createMany({ data: offeringIds.map((offeringId) => ({ themeId: id, offeringId })) });
    // Preserve addedAt for evidence that stays linked.
    const removed = [...oldEvidence].filter((e) => !nextEvidence.has(e));
    const added = [...nextEvidence].filter((e) => !oldEvidence.has(e));
    if (removed.length) await tx.themeEvidence.deleteMany({ where: { themeId: id, sharedObservationId: { in: removed } } });
    if (added.length) await tx.themeEvidence.createMany({ data: added.map((sharedObservationId) => ({ themeId: id, sharedObservationId })) });
    await audit(
      {
        actorId: actor.user.id,
        action: "theme.update",
        entityType: "Theme",
        entityId: id,
        metadata: { from: current.status, to: input.status, evidenceAdded: added.length, evidenceRemoved: removed.length, offeringCount: offeringIds.length },
      },
      tx,
    );
  });
  return { id };
}

/** Theme values for the edit form (managers only). Evidence is limited to currently visible copies. */
export async function getThemeForEdit(actor: AuthedActor, id: string) {
  assert(can.manageThemes(actor), "Only product owners and learning moderators can manage themes.");
  const t = await db.theme.findFirst({
    where: { AND: [{ id }, visibleThemes(actor)] },
    select: {
      id: true,
      title: true,
      summary: true,
      limitations: true,
      status: true,
      offerings: { select: { offeringId: true } },
      evidence: { where: evidenceWhere(actor), select: { sharedObservation: { select: { id: true, title: true, periodLabel: true, region: true, type: true } } } },
    },
  });
  if (!t) throw notFound();
  return {
    id: t.id,
    values: {
      title: t.title,
      summary: t.summary,
      limitations: t.limitations,
      status: t.status,
      offeringIds: t.offerings.map((o) => o.offeringId),
      evidenceIds: t.evidence.map((e) => e.sharedObservation.id),
    },
    evidence: t.evidence.map((e) => e.sharedObservation),
  };
}

/**
 * "Suggested groupings (keyword similarity)": clusters of PUBLISHED shared copies by topic/keyword
 * overlap. Hints only — each group keeps its evidence links and a cohort-suppressed organisation count.
 */
export async function themeSuggestions(actor: AuthedActor) {
  assertParticipant(actor);
  assert(can.manageThemes(actor), "Only product owners and learning moderators can see suggested groupings.");
  const min = learningMinCohort();
  const rows = await db.sharedObservation.findMany({
    where: sharedFeedWhere(actor),
    orderBy: { publishedAt: "desc" },
    take: 500,
    select: { id: true, title: true, topics: true, periodLabel: true, source: { select: { organisationId: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return suggestGroupings(rows.map((r) => ({ id: r.id, title: r.title, topics: r.topics }))).map((g) => {
    const members = g.memberIds.map((id) => byId.get(id)!);
    return {
      label: g.label,
      sharedTopics: g.sharedTopics,
      cohesion: g.cohesion,
      contributions: members.length,
      organisations: suppressIfBelow(new Set(members.map((m) => m.source.organisationId)).size, min),
      members: members.map((m) => ({ id: m.id, title: m.title, periodLabel: m.periodLabel })),
    };
  });
}
export type ThemeSuggestion = Awaited<ReturnType<typeof themeSuggestions>>[number];

/** Theme options for idea forms. */
export function listThemeOptions(actor: AuthedActor) {
  return db.theme.findMany({ where: visibleThemes(actor), select: { id: true, title: true, status: true }, orderBy: { title: "asc" } });
}
