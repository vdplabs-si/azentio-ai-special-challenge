import { describe, it, expect } from "bun:test";
import {
  csvCell,
  findForbiddenKeys,
  FORBIDDEN_SHARED_KEYS,
  sharedSelect,
  sharedToCsv,
  toCommentDTO,
  toSharedDTO,
  type SharedRow,
} from "@/server/learning/dto";

/** A row as Prisma might return it if someone over-selected — the mapper must drop the extras. */
const leakyRow = {
  id: "so_1",
  type: "PRODUCT_GAP",
  title: "Manual covenant tracking",
  body: "Several lenders still track covenants in spreadsheets.",
  industry: "banking",
  region: "Middle East",
  periodLabel: "2026 H1",
  periodStart: new Date("2026-01-01T00:00:00.000Z"),
  evidenceType: "CLIENT_FEEDBACK",
  confidence: "MEDIUM",
  topics: ["covenants"],
  attributionLabel: null,
  publishedAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  offering: { slug: "lending", name: "Lending", id: "off_1" },
  // Forbidden extras:
  sourceObservationId: "obs_secret",
  source: { organisationId: "org_secret", authorId: "user_secret", links: ["https://intranet"] },
  organisationId: "org_secret",
  authorId: "user_secret",
  links: ["https://intranet.example"],
  consents: [{ futureTraining: true }],
  internalNote: "moderator only",
  sensitiveFlags: [{ kind: "email" }],
} as unknown as SharedRow;

describe("shared DTO", () => {
  it("contains no forbidden keys even when the row has them", () => {
    const dto = toSharedDTO(leakyRow);
    expect(findForbiddenKeys(dto)).toEqual([]);
    for (const k of FORBIDDEN_SHARED_KEYS) expect(Object.keys(dto)).not.toContain(k);
    expect(JSON.stringify(dto)).not.toContain("secret");
    expect(JSON.stringify(dto)).not.toContain("intranet");
    expect(JSON.stringify(dto)).not.toContain("moderator only");
  });

  it("exposes exactly the reviewed fields", () => {
    expect(Object.keys(toSharedDTO(leakyRow)).sort()).toEqual(
      [
        "attributionLabel",
        "body",
        "confidence",
        "evidenceType",
        "id",
        "industry",
        "offering",
        "periodLabel",
        "periodStart",
        "publishedAt",
        "region",
        "title",
        "topics",
        "type",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(toSharedDTO(leakyRow).offering!).sort()).toEqual(["name", "slug"]);
  });

  it("the Prisma select never selects forbidden relations or columns", () => {
    expect(findForbiddenKeys(sharedSelect)).toEqual([]);
    expect(Object.keys(sharedSelect)).not.toContain("sourceObservationId");
    expect(Object.keys(sharedSelect)).not.toContain("source");
  });

  it("detects forbidden keys in nested payloads", () => {
    expect(findForbiddenKeys({ items: [{ id: "x", source: { organisationId: "o" } }] })).toEqual([
      "items[0].source",
      "items[0].source.organisationId",
    ]);
  });
});

describe("comment DTO", () => {
  const base = { id: "c1", body: "Helpful", createdAt: new Date("2026-05-01T00:00:00Z"), hidden: false };
  it("labels the viewer's own comment as You", () => {
    expect(toCommentDTO({ ...base, authorId: "u1", authorIsEmployee: false }, "u1", false).authorLabel).toBe("You");
  });
  it("labels employees as Azentio team and everyone else as Community participant", () => {
    expect(toCommentDTO({ ...base, authorId: "u2", authorIsEmployee: true }, "u1", false).authorLabel).toBe("Azentio team");
    expect(toCommentDTO({ ...base, authorId: "u3", authorIsEmployee: false }, "u1", false).authorLabel).toBe("Community participant");
  });
  it("never carries author identifiers and hides moderation state from non-moderators", () => {
    const dto = toCommentDTO({ ...base, authorId: "u3", authorIsEmployee: false }, "u1", false);
    expect(Object.keys(dto)).not.toContain("authorId");
    expect(findForbiddenKeys(dto)).toEqual([]);
    expect(dto.hidden).toBeUndefined();
    expect(toCommentDTO({ ...base, authorId: "u3", authorIsEmployee: false }, "u1", true).hidden).toBe(false);
  });
});

describe("CSV export", () => {
  it("escapes cells and neutralises formula injection", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
  });
  it("exports only DTO columns", () => {
    const csv = sharedToCsv([toSharedDTO(leakyRow)]);
    expect(csv.split("\r\n")[0]).toBe("id,type,title,body,offering,industry,region,period,evidenceType,confidence,topics,attribution,publishedAt");
    expect(csv).not.toContain("secret");
    expect(csv).not.toContain("intranet");
  });
});
