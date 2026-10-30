import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor, AuthedActor } from "@/lib/authz/actor";
import { entitledOfferings } from "@/lib/authz/visibility";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/log";
import { rateLimit } from "@/lib/api/rate-limit";
import { forbidden, notFound, unavailable } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { getEngine } from "@/server/playground/engines";
import { isEngineResult, type EngineResult, type FieldDescriptor, type InputValues } from "@/server/playground/engines/types";

const NOTHING = { id: { in: [] as string[] } };

/**
 * Scenarios the actor may open and run. Employees: every scenario. Clients: only
 * CLIENT_ENTITLED scenarios whose offering the ACTIVE organisation is entitled to.
 * Knowing a slug never bypasses this (callers return 404 when no row matches).
 */
export function scenarioWhere(actor: Actor): Prisma.PlaygroundScenarioWhereInput {
  if (!actor.user) return NOTHING;
  if (actor.isEmployee) return {};
  return { audience: "CLIENT_ENTITLED", offering: entitledOfferings(actor) };
}

// ── Validation ───────────────────────────────────────────────────────────

const inputKey = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9]*$/);

/** Body of POST /scenarios/[slug]/runs — values are validated by the scenario's engine schema. */
export const runRequestSchema = z.object({
  inputs: z.record(inputKey, z.union([z.number(), z.string().max(64)])).default({}),
});

const rating = z
  .number({ error: "Choose a rating from 1 to 5." })
  .int("Choose a rating from 1 to 5.")
  .min(1, "Choose a rating from 1 to 5.")
  .max(5, "Choose a rating from 1 to 5.");

export const feedbackSchema = z.object({
  usefulness: rating,
  clarity: rating,
  trust: rating,
  comment: z.string().trim().max(2000, "Keep comments under 2,000 characters.").default(""),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────

const MAX_SLUG = 120;
const MAX_ID = 64;

function asInputValues(json: Prisma.JsonValue | null | undefined): InputValues {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: InputValues = {};
  for (const [k, v] of Object.entries(json)) if (typeof v === "number" || typeof v === "string") out[k] = v;
  return out;
}

/** Stored run outputs are JSON; never trust their shape blindly. */
export function parseStoredResult(json: Prisma.JsonValue | null | undefined): EngineResult | null {
  return isEngineResult(json) ? json : null;
}

const scenarioSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  audience: true,
  engine: true,
  offering: { select: { id: true, slug: true, name: true, category: true } },
} satisfies Prisma.PlaygroundScenarioSelect;

const visibleSlug = (actor: Actor, slug: string): Prisma.PlaygroundScenarioWhereInput => ({ AND: [{ slug }, scenarioWhere(actor)] });

/** Run ownership: my runs, in my ACTIVE workspace, for scenarios I can still see. */
function myRunsWhere(actor: AuthedActor, scenario: Prisma.PlaygroundScenarioWhereInput): Prisma.PlaygroundRunWhereInput {
  const org = actor.activeOrganisation;
  if (!org) return NOTHING;
  return { userId: actor.user.id, organisationId: org.organisationId, scenario };
}

// ── Scenarios ────────────────────────────────────────────────────────────

export async function listScenarios(actor: AuthedActor) {
  const rows = await db.playgroundScenario.findMany({
    where: scenarioWhere(actor),
    select: scenarioSelect,
    orderBy: [{ offering: { sortOrder: "asc" } }, { offering: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((r) => ({ ...r, available: getEngine(r.engine) !== null }));
}
export type ScenarioSummary = Awaited<ReturnType<typeof listScenarios>>[number];

export interface ScenarioDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: "EMPLOYEE" | "CLIENT_ENTITLED";
  engine: string;
  offering: { id: string; slug: string; name: string; category: string };
  /** False when the engine key is unknown or the stored inputs no longer validate (fail closed). */
  available: boolean;
  fields: FieldDescriptor[];
  defaults: InputValues;
}

/** Scenario detail for pages, or null when the actor may not see it. */
export async function getScenarioBySlug(actor: AuthedActor, slug: string): Promise<ScenarioDetail | null> {
  if (!slug || slug.length > MAX_SLUG) return null;
  const s = await db.playgroundScenario.findFirst({ where: visibleSlug(actor, slug), select: { ...scenarioSelect, inputs: true } });
  if (!s) return null;
  const engine = getEngine(s.engine);
  const parsed = engine?.safeParse(asInputValues(s.inputs));
  if (engine && parsed && !parsed.success) log.warn("Playground scenario inputs fail engine validation", { scenario: s.slug, engine: s.engine });
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    audience: s.audience,
    engine: s.engine,
    offering: s.offering,
    available: Boolean(engine && parsed?.success),
    fields: engine?.fields ?? [],
    defaults: parsed?.success ? parsed.data : {},
  };
}

// ── Runs ─────────────────────────────────────────────────────────────────

export interface RunView {
  id: string;
  createdAt: Date;
  scenario: { slug: string; name: string };
  inputs: InputValues;
  outputs: EngineResult | null;
  feedback: { usefulness: number; clarity: number; trust: number; comment: string; createdAt: Date } | null;
}

/** Validate inputs (merged over the scenario's synthetic defaults), run the engine and persist the run. */
export async function createRun(actor: AuthedActor, slug: string, overrides: InputValues): Promise<RunView> {
  const org = actor.activeOrganisation;
  if (!org) throw forbidden("Select an active workspace first — demonstration runs are recorded in your active workspace.");
  if (!slug || slug.length > MAX_SLUG) throw notFound();
  await rateLimit(`playground:${actor.user.id}`, 30, 60);

  const scenario = await db.playgroundScenario.findFirst({
    where: visibleSlug(actor, slug),
    select: { id: true, slug: true, name: true, engine: true, inputs: true },
  });
  if (!scenario) throw notFound();
  const engine = getEngine(scenario.engine);
  if (!engine) {
    log.warn("Playground scenario references an unknown engine", { scenario: scenario.slug, engine: scenario.engine });
    throw unavailable("This demonstration is not available on this deployment.");
  }

  const inputs = engine.parse({ ...asInputValues(scenario.inputs), ...overrides }); // ZodError → 422 per field
  let result: EngineResult;
  try {
    result = engine.run(inputs);
  } catch (err) {
    log.error("Playground engine failed", { scenario: scenario.slug, engine: scenario.engine, error: err });
    throw unavailable("The simulation could not be completed. Please adjust the inputs and try again.");
  }

  const run = await db.$transaction(async (tx) => {
    const created = await tx.playgroundRun.create({
      data: {
        scenarioId: scenario.id,
        userId: actor.user.id,
        organisationId: org.organisationId,
        inputs: inputs as Prisma.InputJsonObject,
        outputs: result as unknown as Prisma.InputJsonObject,
      },
      select: { id: true, createdAt: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "playground.run",
        entityType: "PlaygroundRun",
        entityId: created.id,
        organisationId: org.organisationId,
        metadata: { scenario: scenario.slug },
      },
      tx,
    );
    return created;
  });

  return { id: run.id, createdAt: run.createdAt, scenario: { slug: scenario.slug, name: scenario.name }, inputs, outputs: result, feedback: null };
}

/** My runs of one scenario in the active workspace; null when the scenario is not visible. */
export async function listRuns(actor: AuthedActor, slug: string, page: Pagination) {
  if (!slug || slug.length > MAX_SLUG) return null;
  const visible = await db.playgroundScenario.count({ where: visibleSlug(actor, slug) });
  if (!visible) return null;
  const rows = await db.playgroundRun.findMany({
    where: myRunsWhere(actor, visibleSlug(actor, slug)),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true, outputs: true, feedback: { where: { userId: actor.user.id }, select: { id: true } } },
    ...pageArgs(page),
  });
  const p = toPage(rows, page);
  return {
    items: p.items.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      summary: parseStoredResult(r.outputs)?.summary ?? "Stored result is unavailable.",
      hasFeedback: r.feedback.length > 0,
    })),
    nextCursor: p.nextCursor,
  };
}

/** My most recent runs across visible scenarios in the active workspace. */
export async function listMyRecentRuns(actor: AuthedActor, take = 8) {
  const rows = await db.playgroundRun.findMany({
    where: myRunsWhere(actor, scenarioWhere(actor)),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      createdAt: true,
      outputs: true,
      scenario: { select: { slug: true, name: true, offering: { select: { name: true } } } },
      feedback: { where: { userId: actor.user.id }, select: { id: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    scenario: { slug: r.scenario.slug, name: r.scenario.name, offeringName: r.scenario.offering.name },
    summary: parseStoredResult(r.outputs)?.summary ?? "Stored result is unavailable.",
    hasFeedback: r.feedback.length > 0,
  }));
}

/** One of my runs (active workspace, visible scenario) or null. */
export async function getRun(actor: AuthedActor, id: string): Promise<RunView | null> {
  if (!id || id.length > MAX_ID) return null;
  const r = await db.playgroundRun.findFirst({
    where: { id, ...myRunsWhere(actor, scenarioWhere(actor)) },
    select: {
      id: true,
      createdAt: true,
      inputs: true,
      outputs: true,
      scenario: { select: { slug: true, name: true } },
      feedback: {
        where: { userId: actor.user.id },
        select: { usefulness: true, clarity: true, trust: true, comment: true, createdAt: true },
        take: 1,
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    createdAt: r.createdAt,
    scenario: r.scenario,
    inputs: asInputValues(r.inputs),
    outputs: parseStoredResult(r.outputs),
    feedback: r.feedback[0] ?? null,
  };
}

/** Structured feedback — one record per run per user (re-submitting updates it). */
export async function upsertFeedback(actor: AuthedActor, runId: string, input: FeedbackInput) {
  const run = await getRun(actor, runId);
  if (!run) throw notFound();
  const org = actor.activeOrganisation!; // getRun only matches inside the active workspace
  const data = { usefulness: input.usefulness, clarity: input.clarity, trust: input.trust, comment: input.comment };
  return db.$transaction(async (tx) => {
    const feedback = await tx.playgroundFeedback.upsert({
      where: { runId_userId: { runId: run.id, userId: actor.user.id } },
      create: { runId: run.id, userId: actor.user.id, ...data },
      update: data,
      select: { usefulness: true, clarity: true, trust: true, comment: true, createdAt: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "playground.feedback",
        entityType: "PlaygroundRun",
        entityId: run.id,
        organisationId: org.organisationId,
        metadata: { scenario: run.scenario.slug, usefulness: data.usefulness, clarity: data.clarity, trust: data.trust, hasComment: data.comment.length > 0 },
      },
      tx,
    );
    return feedback;
  });
}
