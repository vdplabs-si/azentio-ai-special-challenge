import { describe, expect, it } from "bun:test";
import { AI_OFFERINGS } from "../../../src/content/catalogue";
import { chooseTier, hashSeed, INDUSTRY_CLUSTER, mulberry32, surfaceHeight, surfaceShape } from "../../../src/components/three/presets";

describe("scene presets", () => {
  it("seeds deterministically", () => {
    expect(hashSeed("riva")).toBe(hashSeed("riva"));
    expect(hashSeed("riva")).not.toBe(hashSeed("lending"));
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(seqA).toEqual(Array.from({ length: 5 }, b));
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
  });

  it("gives every AI offering a named, distinct surface", () => {
    const kinds = AI_OFFERINGS.map((o) => surfaceShape(o.slug).kind);
    expect(new Set(kinds).size).toBe(AI_OFFERINGS.length);
    expect(surfaceShape("financial-analysis-intelligence")).toMatchObject({ kind: "seasonal", cycles: 2 });
  });

  it("keeps surface heights finite, bounded and flat at the edges", () => {
    for (const seed of [...AI_OFFERINGS.map((o) => o.slug), "lending", "home"]) {
      const shape = surfaceShape(seed);
      for (let i = 0; i <= 20; i++) {
        for (let j = 0; j <= 20; j++) {
          const h = surfaceHeight(shape, i / 20, j / 20);
          expect(Number.isFinite(h)).toBe(true);
          expect(Math.abs(h)).toBeLessThanOrEqual(1.5);
        }
      }
      // v = 0 and v = 1 are the front/back edges, where the envelope goes to zero (peaks excepted).
      if (shape.kind !== "peaks") expect(Math.abs(surfaceHeight(shape, 0.5, 0))).toBeLessThan(1e-9);
    }
  });

  it("maps the five industries onto distinct clusters", () => {
    expect(new Set(Object.values(INDUSTRY_CLUSTER)).size).toBe(5);
  });

  it("chooses conservative tiers", () => {
    expect(chooseTier({ cores: 4, memoryGb: 8, wide: true })).toBe("low");
    expect(chooseTier({ cores: 16, memoryGb: 8, wide: false })).toBe("low");
    expect(chooseTier({ cores: 8, memoryGb: 4, wide: true })).toBe("mid");
    expect(chooseTier({ cores: 12, memoryGb: 8, wide: true })).toBe("high");
  });
});
