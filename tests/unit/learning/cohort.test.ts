import { describe, it, expect } from "bun:test";
import { buildFacet, cohortLabel, distinctCount, suppressIfBelow } from "@/server/learning/cohort";

describe("suppressIfBelow", () => {
  it("suppresses counts below the minimum", () => {
    expect(suppressIfBelow(0, 3)).toEqual({ suppressed: true, value: null, min: 3 });
    expect(suppressIfBelow(2, 3)).toEqual({ suppressed: true, value: null, min: 3 });
  });
  it("shows counts at or above the minimum", () => {
    expect(suppressIfBelow(3, 3)).toEqual({ suppressed: false, value: 3, min: 3 });
    expect(suppressIfBelow(10, 3)).toEqual({ suppressed: false, value: 10, min: 3 });
  });
  it("never allows a minimum below 2", () => {
    expect(suppressIfBelow(1, 1).suppressed).toBe(true);
    expect(suppressIfBelow(1, 0).min).toBe(2);
  });
  it("treats invalid counts as suppressed", () => {
    expect(suppressIfBelow(Number.NaN, 3).suppressed).toBe(true);
  });
  it("labels values without revealing suppressed counts", () => {
    expect(cohortLabel(suppressIfBelow(2, 3))).toBe("Fewer than 3 organisations — count suppressed");
    expect(cohortLabel(suppressIfBelow(4, 3))).toBe("4 organisations");
  });
});

describe("distinctCount", () => {
  it("counts repeated posts from one organisation once", () => {
    expect(distinctCount(["org-a", "org-a", "org-a", "org-b", null, ""])).toBe(2);
  });
});

describe("buildFacet", () => {
  const rows = [
    { keys: ["Europe"], org: "a" },
    { keys: ["Europe"], org: "b" },
    { keys: ["Europe"], org: "c" },
    { keys: ["Europe"], org: "c" },
    { keys: ["Africa"], org: "a" },
    { keys: ["Africa"], org: "a" },
    { keys: ["Africa"], org: "a" },
    { keys: ["Africa"], org: "a" },
    { keys: ["Africa"], org: "a" },
  ];
  it("suppresses buckets whose DISTINCT organisations are below the minimum, even with many posts", () => {
    const f = buildFacet(rows, 3);
    expect(f).toEqual([
      { value: "Europe", label: "Europe", count: 4, suppressed: false },
      { value: "Africa", label: "Africa", count: null, suppressed: true },
    ]);
  });
  it("never exposes organisation identifiers", () => {
    expect(JSON.stringify(buildFacet(rows, 3))).not.toMatch(/"org"|"a"|"b"|"c"/);
  });
});
