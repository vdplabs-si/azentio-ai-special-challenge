/**
 * Cross-client DTOs (PDF §09). Shared learning payloads — API JSON and props passed to client
 * components — are built ONLY from these explicit selects and mappers. They exclude the private
 * source link (sourceObservationId), organisation IDs, author identity, links, consent records,
 * moderator notes and sensitive-scan output.
 * Pure module — the forbidden-key test lives in tests/unit/learning/dto.test.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { Confidence, EvidenceType, ObservationType } from "@/generated/prisma/enums";

/** Keys that must never appear in a shared (cross-tenant) payload. */
export const FORBIDDEN_SHARED_KEYS = [
  "sourceObservationId",
  "source",
  "organisationId",
  "organisation",
  "authorId",
  "author",
  "email",
  "links",
  "consents",
  "consent",
  "internalNote",
  "internalNotes",
  "moderatorId",
  "sensitiveFlags",
  "reports",
  "reporterId",
] as const;

/** Prisma select for shared copies: reviewed fields only. */
export const sharedSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  industry: true,
  region: true,
  periodLabel: true,
  periodStart: true,
  evidenceType: true,
  confidence: true,
  topics: true,
  attributionLabel: true,
  publishedAt: true,
  updatedAt: true,
  offering: { select: { slug: true, name: true } },
} as const satisfies Prisma.SharedObservationSelect;

export interface SharedRow {
  id: string;
  type: ObservationType;
  title: string;
  body: string;
  industry: string;
  region: string;
  periodLabel: string;
  periodStart: Date;
  evidenceType: EvidenceType;
  confidence: Confidence;
  topics: string[];
  attributionLabel: string | null;
  publishedAt: Date;
  updatedAt: Date;
  offering: { slug: string; name: string } | null;
}

export interface SharedDTO {
  id: string;
  type: ObservationType;
  title: string;
  body: string;
  offering: { slug: string; name: string } | null;
  industry: string;
  region: string;
  periodLabel: string;
  periodStart: string;
  evidenceType: EvidenceType;
  confidence: Confidence;
  topics: string[];
  /** Organisation name only when the contributor consented AND a moderator approved; else null. */
  attributionLabel: string | null;
  publishedAt: string;
  updatedAt: string;
}

/** Explicit field-by-field mapping — extra properties on `row` are never copied. */
export function toSharedDTO(row: SharedRow): SharedDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    offering: row.offering ? { slug: row.offering.slug, name: row.offering.name } : null,
    industry: row.industry,
    region: row.region,
    periodLabel: row.periodLabel,
    periodStart: row.periodStart.toISOString(),
    evidenceType: row.evidenceType,
    confidence: row.confidence,
    topics: [...row.topics],
    attributionLabel: row.attributionLabel ?? null,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Recursively list any forbidden keys present in a payload (defence-in-depth checks and tests). */
export function findForbiddenKeys(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findForbiddenKeys(v, `${path}[${i}]`));
  const hits: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if ((FORBIDDEN_SHARED_KEYS as readonly string[]).includes(k)) hits.push(p);
    hits.push(...findForbiddenKeys(v, p));
  }
  return hits;
}

// ── Comments on shared copies ────────────────────────────────────────────

export type CommentAuthorLabel = "You" | "Azentio team" | "Community participant";

export interface SharedCommentDTO {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: CommentAuthorLabel;
  mine: boolean;
  /** Only populated for moderators (hidden comments are excluded for everyone else). */
  hidden?: boolean;
}

/**
 * Comment author display never crosses tenants: the viewer sees "You" on their own comments,
 * "Azentio team" for employees, otherwise "Community participant" — never names or organisations.
 */
export function toCommentDTO(
  row: { id: string; body: string; createdAt: Date; authorId: string; authorIsEmployee: boolean; hidden: boolean },
  viewerId: string,
  viewerIsModerator: boolean,
): SharedCommentDTO {
  const mine = row.authorId === viewerId;
  const dto: SharedCommentDTO = {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorLabel: mine ? "You" : row.authorIsEmployee ? "Azentio team" : "Community participant",
    mine,
  };
  if (viewerIsModerator) dto.hidden = row.hidden;
  return dto;
}

// ── CSV export ───────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  "id",
  "type",
  "title",
  "body",
  "offering",
  "industry",
  "region",
  "period",
  "evidenceType",
  "confidence",
  "topics",
  "attribution",
  "publishedAt",
] as const;

/** Escape a CSV cell and neutralise spreadsheet formula injection. */
export function csvCell(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function sharedToCsvRow(d: SharedDTO): string {
  return [
    d.id,
    d.type,
    d.title,
    d.body,
    d.offering?.name ?? "",
    d.industry,
    d.region,
    d.periodLabel,
    d.evidenceType,
    d.confidence,
    d.topics.join("; "),
    d.attributionLabel ?? "",
    d.publishedAt,
  ]
    .map(csvCell)
    .join(",");
}

export function sharedToCsv(items: readonly SharedDTO[]): string {
  return [CSV_COLUMNS.join(","), ...items.map(sharedToCsvRow)].join("\r\n") + "\r\n";
}
