import { describe, it, expect } from "bun:test";
import { jaccard, suggestGroupings, tokenize, topSimilar } from "@/server/learning/similarity";

describe("tokenize", () => {
  it("lowercases, drops stopwords, short and numeric tokens", () => {
    expect([...tokenize("The SME lenders are reviewing 2026 credit, and AI")].sort()).toEqual(["credit", "lender", "reviewing", "sme"]);
  });
});

describe("jaccard", () => {
  const s = (...x: string[]) => new Set(x);
  it("is 1 for identical sets and 0 for disjoint/empty sets", () => {
    expect(jaccard(s("a", "b"), s("a", "b"))).toBe(1);
    expect(jaccard(s("a"), s("b"))).toBe(0);
    expect(jaccard(s(), s())).toBe(0);
  });
  it("is |A∩B| / |A∪B|", () => {
    expect(jaccard(s("a", "b", "c"), s("b", "c", "d"))).toBeCloseTo(2 / 4);
    expect(jaccard(s("a", "b"), s("a", "b", "c", "d"))).toBeCloseTo(0.5);
  });
  it("is symmetric", () => {
    expect(jaccard(s("x", "y", "z"), s("y"))).toBe(jaccard(s("y"), s("x", "y", "z")));
  });
});

describe("topSimilar", () => {
  const candidates = [
    { id: "1", title: "Covenant monitoring still manual", body: "Banks track loan covenants in spreadsheets" },
    { id: "2", title: "Sanctions screening false positives", body: "Name screening produces many false positive alerts" },
    { id: "3", title: "Manual covenant tracking", body: "Covenant tracking spreadsheets slow down credit reviews" },
    { id: "4", title: "Unrelated", body: "Insurance claims automation in health" },
  ];
  it("ranks the closest candidates first, top 3, with rounded scores", () => {
    const hits = topSimilar({ title: "Covenant tracking is manual", body: "Lenders track covenants in spreadsheets" }, candidates, 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(["1", "3"]).toContain(hits[0]!.id);
    expect(hits.map((h) => h.id)).not.toContain("4");
    for (const h of hits) expect(h.score).toBe(Math.round(h.score * 100) / 100);
  });
});

describe("suggestGroupings", () => {
  it("groups items that share topics and keeps evidence ids", () => {
    const groups = suggestGroupings([
      { id: "a", title: "Covenant tracking manual", topics: ["covenants", "lending ops"] },
      { id: "b", title: "Covenant breaches detected late", topics: ["covenants", "lending ops"] },
      { id: "c", title: "Spreadsheet covenant monitoring", topics: ["covenants"] },
      { id: "d", title: "Sanctions screening noise", topics: ["sanctions"] },
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]!.memberIds.sort()).toEqual(["a", "b", "c"]);
    expect(groups[0]!.sharedTopics[0]).toBe("covenants");
    expect(groups[0]!.cohesion).toBeGreaterThan(0);
  });
  it("returns nothing when no items are related", () => {
    expect(suggestGroupings([{ id: "a", title: "Alpha", topics: ["x1"] }, { id: "b", title: "Beta", topics: ["y1"] }])).toEqual([]);
  });
});
