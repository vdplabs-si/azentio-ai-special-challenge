import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAYGROUND_SCENARIOS } from "../../../src/server/playground/scenarios";
import { getEngine } from "../../../src/server/playground/engines";
import { AI_OFFERINGS } from "../../../src/content/catalogue";

describe("PLAYGROUND_SCENARIOS", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = PLAYGROUND_SCENARIOS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("covers every sandbox offering with at least one scenario", () => {
    const sandbox = AI_OFFERINGS.filter((o) => o.sandbox).map((o) => o.slug);
    expect(sandbox.length).toBeGreaterThanOrEqual(5);
    for (const slug of sandbox) expect(PLAYGROUND_SCENARIOS.some((s) => s.offeringSlug === slug)).toBe(true);
    const known = new Set(AI_OFFERINGS.map((o) => o.slug));
    for (const s of PLAYGROUND_SCENARIOS) expect(known.has(s.offeringSlug)).toBe(true);
  });

  it("is mostly client-entitled with at least one employee-only internal prototype", () => {
    const employee = PLAYGROUND_SCENARIOS.filter((s) => s.audience === "EMPLOYEE");
    const client = PLAYGROUND_SCENARIOS.filter((s) => s.audience === "CLIENT_ENTITLED");
    expect(employee.length).toBeGreaterThanOrEqual(1);
    expect(client.length).toBeGreaterThan(employee.length);
  });

  it("stores inputs that validate against the scenario's engine and run", () => {
    for (const s of PLAYGROUND_SCENARIOS) {
      const engine = getEngine(s.engine);
      expect(engine).not.toBeNull();
      const parsed = engine!.safeParse(s.inputs);
      if (!parsed.success) throw new Error(`${s.slug}: ${parsed.error.message}`);
      expect(engine!.run(s.inputs).summary.length).toBeGreaterThan(0);
    }
  });

  it("stays importable by a plain Node seed script (only type-only, relative imports)", () => {
    const src = readFileSync(join(import.meta.dir, "../../../src/server/playground/scenarios.ts"), "utf8");
    const imports = [...src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)];
    for (const m of imports) {
      expect(m[1]).toBeTruthy();
      expect(m[2]!.startsWith("@/")).toBe(false);
    }
    expect(src).not.toMatch(/from\s+"server-only"|import\s+"server-only"/);
  });
});
