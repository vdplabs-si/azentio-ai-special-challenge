import { describe, it, expect } from "bun:test";
import { ENGINE_KEYS, getEngine } from "../../../src/server/playground/engines";
import * as credit from "../../../src/server/playground/engines/credit-strategy-simulator";
import * as sme from "../../../src/server/playground/engines/sme-credit-decisioning";
import * as similar from "../../../src/server/playground/engines/similar-portfolio-intelligence";
import * as riva from "../../../src/server/playground/engines/riva";
import * as seasonality from "../../../src/server/playground/engines/financial-analysis-intelligence";
import { isEngineResult, type EngineResult } from "../../../src/server/playground/engines/types";

function metric(r: EngineResult, key: string) {
  const m = r.metrics.find((x) => x.key === key);
  if (!m) throw new Error(`metric ${key} missing`);
  return m;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

const modules = [
  { key: "credit-strategy-simulator", mod: credit },
  { key: "sme-credit-decisioning", mod: sme },
  { key: "similar-portfolio-intelligence", mod: similar },
  { key: "riva", mod: riva },
  { key: "financial-analysis-intelligence", mod: seasonality },
] as const;

describe("engine registry", () => {
  it("registers every engine key and fails closed on unknown keys", () => {
    for (const key of ENGINE_KEYS) expect(getEngine(key)?.key).toBe(key);
    expect(getEngine("does-not-exist")).toBeNull();
    expect(getEngine("__proto__")).toBeNull();
    expect(getEngine("toString")).toBeNull();
  });

  it("exposes UI field descriptors that match the schema keys and bounds", () => {
    for (const { key, mod } of modules) {
      const schemaKeys = Object.keys(mod.inputSchema.shape).sort();
      expect(mod.fields.map((f) => f.key).sort()).toEqual(schemaKeys);
      const defaults = mod.defaultInputs as Record<string, number | string>;
      for (const f of mod.fields) {
        const v = defaults[f.key];
        if (f.kind === "number") {
          expect(typeof v).toBe("number");
          expect(v as number).toBeGreaterThanOrEqual(f.min);
          expect(v as number).toBeLessThanOrEqual(f.max);
          // Bounds advertised to the UI are the bounds the schema enforces.
          expect(getEngine(key)!.safeParse({ ...defaults, [f.key]: f.max + Math.max(f.step, 1) }).success).toBe(false);
          expect(getEngine(key)!.safeParse({ ...defaults, [f.key]: f.min - Math.max(f.step, 1) }).success).toBe(false);
        } else {
          expect(f.options.map((o) => o.value)).toContain(v as string);
        }
      }
      expect(getEngine(key)!.fields).toEqual(mod.fields);
    }
  });
});

describe("determinism", () => {
  for (const { key, mod } of modules) {
    it(`${key}: same inputs produce identical outputs`, () => {
      const engine = getEngine(key)!;
      const a = engine.run(mod.defaultInputs);
      const b = engine.run(structuredClone(mod.defaultInputs));
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(isEngineResult(a)).toBe(true);
    });

    it(`${key}: output is JSON-serialisable and well-formed`, () => {
      const r = getEngine(key)!.run(mod.defaultInputs);
      expect(JSON.parse(JSON.stringify(r))).toEqual(r);
      expect(r.summary.length).toBeGreaterThan(20);
      expect(r.explanation.length).toBeGreaterThan(0);
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.metrics.length).toBeGreaterThan(0);
      for (const row of r.rows.data) for (const c of r.rows.columns) expect(c.key in row).toBe(true);
      for (const m of r.metrics) if (typeof m.value === "number") expect(Number.isFinite(m.value)).toBe(true);
    });
  }

  it("different seeds produce different synthetic data; equal seeds the same", () => {
    expect(credit.generateApplicants(1, 40)).not.toEqual(credit.generateApplicants(2, 40));
    expect(credit.generateApplicants(5, 40)).toEqual(credit.generateApplicants(5, 40));
    expect(similar.generateSegments(3)).toEqual(similar.generateSegments(3));
  });
});

describe("credit-strategy-simulator", () => {
  const base = credit.defaultInputs;
  const rate = (i: credit.CreditStrategyInputs) => metric(credit.run(i), "approval_rate").value as number;

  it("stricter thresholds never raise the approval rate", () => {
    const loose = { ...base, minScore: 560, maxDti: 60, minDscr: 0.9 };
    const mid = { ...base, minScore: 620, maxDti: 45, minDscr: 1.2 };
    const strict = { ...base, minScore: 700, maxDti: 35, minDscr: 1.6 };
    expect(rate(loose)).toBeGreaterThanOrEqual(rate(mid));
    expect(rate(mid)).toBeGreaterThanOrEqual(rate(strict));
    expect(rate(loose)).toBeGreaterThan(rate(strict));
  });

  it("each threshold moves the approval rate in the expected direction", () => {
    for (let s = 500; s < 800; s += 25) expect(rate({ ...base, minScore: s + 25 })).toBeLessThanOrEqual(rate({ ...base, minScore: s }));
    for (let d = 10; d < 80; d += 5) expect(rate({ ...base, maxDti: d })).toBeLessThanOrEqual(rate({ ...base, maxDti: d + 5 }));
    for (let c = 0.8; c < 2.4; c += 0.1) {
      expect(rate({ ...base, minDscr: round2(c + 0.1) })).toBeLessThanOrEqual(rate({ ...base, minDscr: round2(c) }));
    }
  });

  it("reports a before/after comparison against the baseline policy", () => {
    const r = credit.run(base);
    const m = metric(r, "approval_rate");
    expect(typeof m.before).toBe("number");
    expect(m.value as number).toBeLessThanOrEqual(m.before as number); // defaults tighten the policy
    expect(r.rows.data).toHaveLength(base.poolSize);
    const same = credit.run({ ...base, minScore: base.baselineMinScore, maxDti: base.baselineMaxDti, minDscr: base.baselineMinDscr });
    expect(metric(same, "approval_rate").value).toBe(metric(same, "approval_rate").before!);
    expect(same.rows.data.every((x) => x.change === "Unchanged")).toBe(true);
  });

  it("rejects out-of-bound and malformed inputs", () => {
    expect(credit.inputSchema.safeParse({ ...base, minScore: 900 }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, maxDti: -1 }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, poolSize: 40.5 }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, minDscr: "1.3" }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, seed: Number.NaN }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, seed: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(credit.inputSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    const missing: Record<string, unknown> = { ...base };
    delete missing.minScore;
    expect(credit.inputSchema.safeParse(missing).success).toBe(false);
    expect(() => getEngine("credit-strategy-simulator")!.run({ ...base, poolSize: 1000 })).toThrow();
  });
});

describe("sme-credit-decisioning", () => {
  it("computes ratios, evidence-backed policy checks and an indicative label", () => {
    const r = sme.run(sme.defaultInputs);
    expect(metric(r, "recommendation").value).toBe("Indicative — requires human review");
    expect(r.summary).toContain("Indicative — requires human review");
    expect(r.rows.data).toHaveLength(4);
    for (const row of r.rows.data) {
      expect(["PASS", "FAIL"]).toContain(row.result as string);
      expect(String(row.evidence).length).toBeGreaterThan(10);
    }
    const i = sme.defaultInputs;
    const expected = (i.annualRevenue * i.ebitdaMarginPct) / 100 / (i.existingDebtService + sme.annuity(i.requestedAmount, i.interestRatePct, i.tenorYears));
    expect(metric(r, "dscr").value as number).toBeCloseTo(expected, 2);
    expect(metric(r, "current_ratio").value as number).toBeCloseTo(i.currentAssets / i.currentLiabilities, 2);
  });

  it("a larger request lowers DSCR and can only fail more checks", () => {
    const small = sme.run({ ...sme.defaultInputs, requestedAmount: 200 });
    const large = sme.run({ ...sme.defaultInputs, requestedAmount: 15000 });
    expect(metric(large, "dscr").value as number).toBeLessThan(metric(small, "dscr").value as number);
    const fails = (r: EngineResult) => r.rows.data.filter((x) => x.result === "FAIL").length;
    expect(fails(large)).toBeGreaterThanOrEqual(fails(small));
  });

  it("rejects invalid inputs", () => {
    expect(sme.inputSchema.safeParse({ ...sme.defaultInputs, sector: "mining" }).success).toBe(false);
    expect(sme.inputSchema.safeParse({ ...sme.defaultInputs, currentLiabilities: 0 }).success).toBe(false);
    expect(sme.inputSchema.safeParse({ ...sme.defaultInputs, tenorYears: 2.5 }).success).toBe(false);
  });
});

describe("similar-portfolio-intelligence", () => {
  it("returns the 5 nearest comparable segments with outcome rates", () => {
    const r = similar.run(similar.defaultInputs);
    expect(r.rows.data).toHaveLength(5);
    const sims = r.rows.data.map((x) => x.similarity as number);
    expect([...sims].sort((a, b) => b - a)).toEqual(sims);
    const d = metric(r, "comparable_default_rate");
    expect(typeof d.value).toBe("number");
    expect(typeof d.before).toBe("number");
  });

  it("industry weight favours same-industry comparables", () => {
    const same = (w: number) =>
      similar.run({ ...similar.defaultInputs, industryWeight: w }).rows.data.filter((x) => x.industry === "Trading & distribution").length;
    expect(same(2)).toBeGreaterThanOrEqual(same(0));
  });

  it("rejects invalid inputs", () => {
    expect(similar.inputSchema.safeParse({ ...similar.defaultInputs, industry: "space" }).success).toBe(false);
    expect(similar.inputSchema.safeParse({ ...similar.defaultInputs, dscr: 10 }).success).toBe(false);
  });
});

describe("riva", () => {
  it("raises no row exceptions at a 0% defect rate with standard thresholds", () => {
    const r = riva.run({ ...riva.defaultInputs, errorRatePct: 0, reconciliationTolerance: 500 });
    expect(metric(r, "rows_with_exceptions").value).toBe(0);
    expect(r.rows.data).toHaveLength(0);
    expect(r.rows.emptyMessage).toBeTruthy();
  });

  it("a higher defect rate never reduces rows with exceptions", () => {
    let prev = -1;
    for (const rate of [0, 5, 10, 20, 30, 40]) {
      const n = metric(riva.run({ ...riva.defaultInputs, errorRatePct: rate }), "rows_with_exceptions").value as number;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(prev).toBeGreaterThan(0);
  });

  it("validation thresholds change exceptions without changing the data", () => {
    const standard = riva.run({ ...riva.defaultInputs, errorRatePct: 0 });
    const shifted = riva.run({ ...riva.defaultInputs, errorRatePct: 0, stage2DpdThreshold: 60, stage3DpdThreshold: 150 });
    expect(metric(shifted, "warnings").value as number).toBeGreaterThan(metric(standard, "warnings").value as number);
    expect(riva.generateReport(1, 30, 10)).toEqual(riva.generateReport(1, 30, 10));
  });

  it("every exception references a rule and severity", () => {
    const r = riva.run({ ...riva.defaultInputs, errorRatePct: 40 });
    expect(r.rows.data.length).toBeGreaterThan(0);
    for (const e of r.rows.data) {
      expect(String(e.rule)).toMatch(/^R[1-7] /);
      expect(["Error", "Warning"]).toContain(e.severity as string);
    }
  });

  it("rejects invalid inputs", () => {
    expect(riva.inputSchema.safeParse({ ...riva.defaultInputs, errorRatePct: 90 }).success).toBe(false);
    expect(riva.inputSchema.safeParse({ ...riva.defaultInputs, rowCount: 5 }).success).toBe(false);
  });
});

describe("financial-analysis-intelligence (seasonality context)", () => {
  it("shows a material difference between naive and seasonally adjusted comparisons", () => {
    const r = seasonality.run(seasonality.defaultInputs);
    const rev = metric(r, "revenue_change");
    expect(typeof rev.value).toBe("number");
    expect(typeof rev.before).toBe("number");
    const naive = rev.before as number;
    const adjusted = rev.value as number;
    expect(Math.abs(naive - adjusted)).toBeGreaterThan(5);
    // August peak: Q4 vs Q3 looks like a decline naively while underlying growth is positive.
    expect(naive).toBeLessThan(0);
    expect(adjusted).toBeGreaterThan(0);
    expect(r.explanation.join(" ")).toContain("misleads");
    expect(r.rows.data).toHaveLength(12);
  });

  it("naive and adjusted comparisons coincide without seasonality", () => {
    const r = seasonality.run({ ...seasonality.defaultInputs, seasonalAmplitudePct: 0 });
    const rev = metric(r, "revenue_change");
    expect(rev.value).toBe(rev.before!);
  });

  it("supports month-over-month comparison", () => {
    const r = seasonality.run({ ...seasonality.defaultInputs, comparison: "month" });
    expect(r.summary).toContain("Dec vs Nov");
  });

  it("rejects invalid inputs", () => {
    expect(seasonality.inputSchema.safeParse({ ...seasonality.defaultInputs, peakMonth: "smarch" }).success).toBe(false);
    expect(seasonality.inputSchema.safeParse({ ...seasonality.defaultInputs, seasonalAmplitudePct: 95 }).success).toBe(false);
    expect(seasonality.inputSchema.safeParse({ ...seasonality.defaultInputs, comparison: "year" }).success).toBe(false);
  });
});
