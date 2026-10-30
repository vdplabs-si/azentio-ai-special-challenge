import { describe, it, expect } from "bun:test";
import { consentSchema, moderationDecisionSchema, observationInputSchema, sharedFiltersSchema } from "@/server/learning/schemas";

const valid = {
  type: "PRODUCT_GAP",
  title: "Covenant tracking is manual",
  body: "Several lenders still track covenants in spreadsheets, which delays breach detection.",
  offeringId: null,
  industry: "banking",
  region: "Middle East",
  periodStart: "2026-01-01",
  periodEnd: "2026-03-31",
  evidenceType: "CLIENT_FEEDBACK",
  confidence: "MEDIUM",
  topics: ["Covenants", "lending ops"],
  links: ["https://example.org/report"],
  orgVisible: false,
};

describe("observation schema", () => {
  it("accepts a valid contribution and lowercases topics", () => {
    const r = observationInputSchema.parse(valid);
    expect(r.topics).toEqual(["covenants", "lending ops"]);
  });
  it("enforces title/body length", () => {
    expect(observationInputSchema.safeParse({ ...valid, title: "abc" }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, body: "too short" }).success).toBe(false);
  });
  it("requires end ≥ start and no future periods", () => {
    expect(observationInputSchema.safeParse({ ...valid, periodEnd: "2025-12-31" }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, periodEnd: "2999-01-01" }).success).toBe(false);
  });
  it("limits topics (0–8, 2–40 chars, unique) and https links (0–5)", () => {
    expect(observationInputSchema.safeParse({ ...valid, topics: [] }).success).toBe(true);
    expect(observationInputSchema.safeParse({ ...valid, topics: Array.from({ length: 9 }, (_, i) => `t${i}x`) }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, topics: ["a"] }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, topics: ["dup", "DUP"] }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, links: ["http://insecure.example"] }).success).toBe(false);
    expect(observationInputSchema.safeParse({ ...valid, links: Array.from({ length: 6 }, (_, i) => `https://e.org/${i}`) }).success).toBe(false);
  });
  it("only accepts broad REGIONS values", () => {
    expect(observationInputSchema.safeParse({ ...valid, region: "Dubai" }).success).toBe(false);
  });
});

describe("consent schema", () => {
  it("requires (a) store/process and (b) publish; (c) and (d) are independent opt-ins", () => {
    expect(consentSchema.safeParse({ storeAndProcess: true, publishSharedVersion: true, attributeOrganisation: false, futureTraining: false }).success).toBe(true);
    expect(consentSchema.safeParse({ storeAndProcess: false, publishSharedVersion: true, attributeOrganisation: false, futureTraining: false }).success).toBe(false);
    expect(consentSchema.safeParse({ storeAndProcess: true, publishSharedVersion: false, attributeOrganisation: true, futureTraining: true }).success).toBe(false);
  });
});

describe("moderation decision schema", () => {
  it("requires a public reason to return or reject", () => {
    expect(moderationDecisionSchema.safeParse({ action: "REJECT" }).success).toBe(false);
    expect(moderationDecisionSchema.safeParse({ action: "RETURN_FOR_CLARIFICATION", publicReason: "Please clarify the period." }).success).toBe(true);
  });
  it("requires a shared copy to publish", () => {
    expect(moderationDecisionSchema.safeParse({ action: "PUBLISH" }).success).toBe(false);
  });
});

describe("shared filters", () => {
  it("treats empty strings as no filter", () => {
    expect(sharedFiltersSchema.safeParse({ q: "", type: "", periodFrom: "" }).success).toBe(true);
    expect(sharedFiltersSchema.safeParse({ periodFrom: "yesterday" }).success).toBe(false);
  });
});
