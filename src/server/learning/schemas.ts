/**
 * Zod schemas shared by the collective-learning client forms AND the server.
 * Pure: no "server-only", no database, no env — so client components can import it and the
 * server validates with exactly the same rules (PDF §07).
 */
import { z } from "zod";
import {
  Confidence,
  EvidenceType,
  FeedbackKind,
  IdeaStatus,
  IdeaVisibility,
  ObservationType,
  Priority,
  ReportReason,
  ThemeStatus,
} from "@/generated/prisma/enums";
import { REGIONS } from "@/content/catalogue";
import { INDUSTRY_VALUES } from "@/server/learning/labels";

export const LIMITS = {
  titleMin: 5,
  titleMax: 150,
  bodyMin: 30,
  bodyMax: 5000,
  topicsMax: 8,
  topicMin: 2,
  topicMax: 40,
  linksMax: 5,
} as const;

const id = z.string().trim().min(1).max(64);

/** YYYY-MM-DD for "today" in UTC plus one day of tolerance for clients ahead of UTC. */
export function latestAllowedDate(now = new Date()) {
  return new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
}

export const topicSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.topicMin, `Topics need at least ${LIMITS.topicMin} characters.`)
  .max(LIMITS.topicMax, `Topics can be at most ${LIMITS.topicMax} characters.`)
  .regex(/^[a-z0-9][a-z0-9 &/+.-]*$/, "Use lowercase letters, numbers, spaces or hyphens.");

export const topicsSchema = z
  .array(topicSchema)
  .max(LIMITS.topicsMax, `Add at most ${LIMITS.topicsMax} topics.`)
  .refine((t) => new Set(t).size === t.length, "Remove duplicate topics.");

export const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: "Use a full https:// link." })
  .max(2048, "Link is too long.");

/** Normalise a free-text topic the same way the schema does (used by the tag input). */
export const normaliseTopic = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, " ");

// ── Observation (private source) ─────────────────────────────────────────

export const observationFieldsShape = {
  type: z.enum(ObservationType, { error: "Choose a contribution type." }),
  title: z
    .string()
    .trim()
    .min(LIMITS.titleMin, `Title needs at least ${LIMITS.titleMin} characters.`)
    .max(LIMITS.titleMax, `Title can be at most ${LIMITS.titleMax} characters.`),
  body: z
    .string()
    .trim()
    .min(LIMITS.bodyMin, `Describe the observation in at least ${LIMITS.bodyMin} characters.`)
    .max(LIMITS.bodyMax, `Keep the description under ${LIMITS.bodyMax} characters.`),
  offeringId: id.nullish(),
  industry: z.enum(INDUSTRY_VALUES, { error: "Choose an industry." }),
  region: z.enum(REGIONS, { error: "Choose a broad region." }),
  periodStart: z.iso.date({ error: "Enter a start date." }),
  periodEnd: z.iso.date({ error: "Enter an end date." }),
  evidenceType: z.enum(EvidenceType, { error: "Choose an evidence type." }),
  confidence: z.enum(Confidence, { error: "Choose a confidence level." }),
  topics: topicsSchema,
  links: z.array(httpsUrlSchema).max(LIMITS.linksMax, `Add at most ${LIMITS.linksMax} links.`),
  orgVisible: z.boolean(),
};

function refinePeriod(v: { periodStart: string; periodEnd: string }, ctx: z.RefinementCtx) {
  if (v.periodEnd < v.periodStart) {
    ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "End date must be on or after the start date." });
  }
  const max = latestAllowedDate();
  if (v.periodStart > max) ctx.addIssue({ code: "custom", path: ["periodStart"], message: "The period cannot start in the future." });
  if (v.periodEnd > max) ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "The period cannot end in the future." });
}

/** Create / full update of a private observation. Saving never shares (PDF §09). */
export const observationInputSchema = z.object(observationFieldsShape).superRefine(refinePeriod);
export type ObservationInput = z.output<typeof observationInputSchema>;
export type ObservationFormValues = z.input<typeof observationInputSchema>;

/**
 * Consent captured on submission — four SEPARATE permissions (PDF §09).
 * (a) and (b) are required to propose community sharing; (c) and (d) are opt-in.
 */
export const consentSchema = z.object({
  storeAndProcess: z.literal(true, { error: "Permission to store and process this contribution is required." }),
  publishSharedVersion: z.literal(true, {
    error: "Permission to publish a reviewed, de-identified shared version is required to propose sharing.",
  }),
  attributeOrganisation: z.boolean(),
  futureTraining: z.boolean(),
});
export type ConsentInput = z.output<typeof consentSchema>;

export const submitSchema = z.object({ consent: consentSchema });

/** PATCH body: full fields; `consent` is required when amending a PUBLISHED contribution. */
export const observationUpdateSchema = z
  .object({ ...observationFieldsShape, consent: consentSchema.optional() })
  .superRefine(refinePeriod);
export type ObservationUpdateInput = z.output<typeof observationUpdateSchema>;

export const visibilitySchema = z.object({ orgVisible: z.boolean() });

export const observationListQuery = z.object({
  scope: z.enum(["mine", "org"]).default("mine"),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Moderation ───────────────────────────────────────────────────────────

const publicReason = z
  .string()
  .trim()
  .min(10, "Give the contributor a reason of at least 10 characters.")
  .max(1000, "Keep the reason under 1000 characters.");
const internalNote = z.string().trim().max(2000, "Keep the internal note under 2000 characters.").optional();

export const sharedCopySchema = z.object({
  title: observationFieldsShape.title,
  body: observationFieldsShape.body,
  region: z.enum(REGIONS),
  periodGranularity: z.enum(["half", "year"]),
  topics: topicsSchema,
  /** Moderator approves attribution; only effective if the contributor also consented to (c). */
  attributeOrganisation: z.boolean(),
});
export type SharedCopyInput = z.output<typeof sharedCopySchema>;

export const REJECT_CATEGORIES = ["DUPLICATE", "UNSAFE", "OUT_OF_SCOPE", "INSUFFICIENT_DETAIL", "OTHER"] as const;
export const REJECT_CATEGORY_LABELS: Record<(typeof REJECT_CATEGORIES)[number], string> = {
  DUPLICATE: "Duplicate of an existing contribution",
  UNSAFE: "Unsafe to share (confidential or identifying)",
  OUT_OF_SCOPE: "Out of scope for the learning community",
  INSUFFICIENT_DETAIL: "Insufficient detail to be useful",
  OTHER: "Other",
};

export const moderationDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RETURN_FOR_CLARIFICATION"),
    publicReason,
    internalNote,
    version: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("REJECT"),
    publicReason,
    internalNote,
    category: z.enum(REJECT_CATEGORIES).optional(),
    version: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("PUBLISH"),
    publicReason: z.string().trim().max(1000).optional(),
    internalNote,
    sharedCopy: sharedCopySchema,
    acknowledgedFlags: z.boolean().optional(),
    version: z.number().int().positive().optional(),
  }),
]);
export type ModerationDecisionInput = z.output<typeof moderationDecisionSchema>;

export const reportDecisionSchema = z.object({
  action: z.enum(["SUSPEND", "REINSTATE", "REMOVE", "DISMISS"]),
  /** Decision note recorded on the report (moderator-only). */
  note: z.string().trim().min(5, "Record a decision note of at least 5 characters.").max(2000),
  /** Optional audience-appropriate message for the contributor (never reveals the reporter). */
  publicReason: z.string().trim().max(1000).optional(),
});
export type ReportDecisionInput = z.output<typeof reportDecisionSchema>;

export const hideCommentSchema = z.object({ hidden: z.boolean().default(true) });

// ── Shared feed ──────────────────────────────────────────────────────────

/** Optional trimmed text; empty strings are treated as "no filter" by the query builder. */
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Filters for the approved shared feed (also stored in SavedSearch.query). */
export const sharedFiltersSchema = z.object({
  q: optionalText(200),
  offering: optionalText(80), // Offering slug
  industry: optionalText(40),
  region: optionalText(40),
  type: z.enum(ObservationType).or(z.literal("")).optional(),
  topic: optionalText(40),
  periodFrom: z.iso.date().or(z.literal("")).optional(),
  periodTo: z.iso.date().or(z.literal("")).optional(),
});
export type SharedFilters = z.output<typeof sharedFiltersSchema>;
export const SHARED_FILTER_KEYS = ["q", "offering", "industry", "region", "type", "topic", "periodFrom", "periodTo"] as const;

export const sharedListQuery = sharedFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const reportSchema = z.object({
  reason: z.enum(ReportReason, { error: "Choose a reason." }),
  details: z
    .string()
    .trim()
    .min(10, "Describe the concern in at least 10 characters.")
    .max(2000, "Keep the details under 2000 characters."),
});

export const commentSchema = z.object({
  body: z.string().trim().min(2, "Write a comment.").max(2000, "Keep comments under 2000 characters."),
});

export const feedbackSchema = z.object({ kind: z.enum(FeedbackKind).nullable() });

export const savedSearchSchema = z.object({
  name: z.string().trim().min(2, "Name the search.").max(80),
  query: sharedFiltersSchema,
});

export const bookmarkSchema = z
  .object({ sharedObservationId: id.optional(), contentItemId: id.optional() })
  .refine((v) => Boolean(v.sharedObservationId) !== Boolean(v.contentItemId), "Bookmark exactly one item.");

// ── Themes ───────────────────────────────────────────────────────────────

export const themeSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters.").max(150),
  summary: z.string().trim().min(20, "Summarise the theme in at least 20 characters.").max(3000),
  limitations: z.string().trim().max(3000),
  status: z.enum(ThemeStatus),
  offeringIds: z.array(id).max(10, "Link at most 10 offerings."),
  evidenceIds: z.array(id).max(100, "Link at most 100 contributions."),
});
export type ThemeInput = z.output<typeof themeSchema>;

// ── Improvement ideas ────────────────────────────────────────────────────

export const ideaSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters.").max(150),
  problemStatement: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(3000),
  proposedOutcome: z.string().trim().min(10, "Describe the proposed outcome.").max(3000),
  offeringId: id.refine(Boolean, "Choose an offering."),
  themeId: id.nullish(),
  ownerId: id,
  team: z.string().trim().min(2, "Enter the owning team.").max(80),
  priority: z.enum(Priority),
  visibility: z.enum(IdeaVisibility),
  publicStatusNote: z.string().trim().max(1000),
  internalNotes: z.string().trim().max(5000),
  evidenceIds: z.array(id).max(50, "Link at most 50 contributions."),
});
export type IdeaInput = z.output<typeof ideaSchema>;
export const ideaCreateSchema = ideaSchema.extend({ status: z.enum(IdeaStatus).default("PROPOSED") });

export const ideaStatusSchema = z.object({
  status: z.enum(IdeaStatus),
  /** Audience-appropriate note; replaces the idea's public status note when provided. */
  publicStatusNote: z.string().trim().max(1000).optional(),
  /** Employee-only rationale recorded on the status change. */
  note: z.string().trim().max(2000).optional(),
});
