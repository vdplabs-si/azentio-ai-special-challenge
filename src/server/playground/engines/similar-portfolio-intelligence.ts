/**
 * Similar Portfolio Intelligence — nearest-neighbour matching of an application against a
 * library of synthetic historical portfolio segments, using min–max normalised features.
 * Comparable outcomes are context, never a prediction for the applicant.
 */
import type { z } from "zod";
import { defineInputs, numberInput, selectInput, type EngineDefinition, type EngineResult } from "./types";
import { bell, clamp, fmt, mulberry32, pad, pick, round, sum } from "./math";

const INDUSTRIES = [
  { value: "trading", label: "Trading & distribution" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Professional services" },
  { value: "agribusiness", label: "Agribusiness" },
  { value: "construction", label: "Construction" },
] as const;
type Industry = (typeof INDUSTRIES)[number]["value"];
const INDUSTRY_RISK: Record<Industry, number> = { trading: 0.4, manufacturing: 0.2, services: -0.6, agribusiness: 0.9, construction: 1.4 };

const SEGMENT_COUNT = 60;
const TOP_K = 5;
const LOW_SAMPLE = 100;

const spec = defineInputs({
  seed: numberInput({ label: "Segment library seed", min: 1, max: 9999, step: 1, int: true, help: "Generates the synthetic historical segment library." }),
  industry: selectInput({ label: "Industry", options: INDUSTRIES }),
  annualRevenue: numberInput({ label: "Annual revenue", min: 100, max: 50000, step: 50, unit: "k" }),
  yearsInBusiness: numberInput({ label: "Years in business", min: 1, max: 50, step: 1, int: true, unit: "years" }),
  leverage: numberInput({ label: "Leverage (debt / EBITDA)", min: 0, max: 8, step: 0.1, unit: "x" }),
  dscr: numberInput({ label: "DSCR", min: 0.5, max: 4, step: 0.05, unit: "x" }),
  collateralCoveragePct: numberInput({ label: "Collateral coverage", min: 0, max: 200, step: 5, unit: "%" }),
  industryWeight: numberInput({ label: "Industry match weight", min: 0, max: 2, step: 0.25, help: "How strongly an industry mismatch pushes a segment away (0 = ignore industry)." }),
});

export const inputSchema = spec.schema;
export const fields = spec.fields;
export type SimilarPortfolioInputs = z.infer<typeof inputSchema>;

export const defaultInputs: SimilarPortfolioInputs = {
  seed: 7,
  industry: "trading",
  annualRevenue: 8500,
  yearsInBusiness: 9,
  leverage: 2.8,
  dscr: 1.45,
  collateralCoveragePct: 80,
  industryWeight: 1,
};

export interface Segment {
  id: string;
  industry: Industry;
  revenue: number; // k, segment median
  years: number;
  leverage: number;
  dscr: number;
  collateral: number; // %
  accounts: number;
  defaultRate: number; // %
  arrearsRate: number; // %
}

export function generateSegments(seed: number): Segment[] {
  const rng = mulberry32(seed);
  return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
    const industry = pick(rng, INDUSTRIES).value;
    const revenue = Math.round(150 * (40000 / 150) ** rng());
    const years = 1 + Math.round(39 * rng() ** 1.3);
    const leverage = round(0.5 + 6 * bell(rng, 2), 2);
    const dscr = round(0.8 + 2.4 * bell(rng, 2), 2);
    const collateral = Math.round(20 + 160 * rng());
    const accounts = Math.round(40 + 560 * rng() ** 1.6);
    const noise = (rng() - 0.5) * 1.5;
    const defaultRate = clamp(
      3.2 + 1.1 * (leverage - 3) - 2.2 * (dscr - 1.6) - 0.015 * (collateral - 100) - 0.05 * (years - 10) + INDUSTRY_RISK[industry] + noise,
      0.4,
      25,
    );
    const arrearsRate = clamp(defaultRate * 1.7 + (rng() - 0.3) * 2, 0.5, 40);
    return { id: `SEG-${pad(i + 1, 2)}`, industry, revenue, years, leverage, dscr, collateral, accounts, defaultRate: round(defaultRate, 2), arrearsRate: round(arrearsRate, 2) };
  });
}

const FEATURES = [
  { key: "revenue", label: "revenue (log)", get: (s: { revenue: number }) => Math.log(s.revenue) },
  { key: "years", label: "years in business", get: (s: { years: number }) => s.years },
  { key: "leverage", label: "leverage", get: (s: { leverage: number }) => s.leverage },
  { key: "dscr", label: "DSCR", get: (s: { dscr: number }) => s.dscr },
  { key: "collateral", label: "collateral coverage", get: (s: { collateral: number }) => s.collateral },
] as const;

const industryLabel = (v: Industry) => INDUSTRIES.find((x) => x.value === v)!.label;

export function run(i: SimilarPortfolioInputs): EngineResult {
  const segments = generateSegments(i.seed);
  const app = { revenue: i.annualRevenue, years: i.yearsInBusiness, leverage: i.leverage, dscr: i.dscr, collateral: i.collateralCoveragePct };
  const ranges = FEATURES.map((f) => {
    const vals = segments.map((s) => f.get(s));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return { lo, span: hi - lo || 1 };
  });
  const norm = (fi: number, v: number) => (v - ranges[fi]!.lo) / ranges[fi]!.span;
  const penalty = 0.5 * i.industryWeight;

  const scored = segments.map((s) => {
    const deltas = FEATURES.map((f, fi) => norm(fi, f.get(s)) - norm(fi, f.get(app)));
    const mismatch = s.industry !== i.industry;
    const distance = Math.sqrt(sum(deltas.map((d) => d * d)) + (mismatch ? penalty * penalty : 0));
    let driver = 0;
    deltas.forEach((d, idx) => {
      if (Math.abs(d) > Math.abs(deltas[driver]!)) driver = idx;
    });
    return { s, distance, mismatch, driver: FEATURES[driver]!.label, driverDelta: deltas[driver]! };
  });
  const top = [...scored].sort((a, b) => a.distance - b.distance || a.s.id.localeCompare(b.s.id)).slice(0, TOP_K);

  const weighted = (xs: { s: Segment }[], k: "defaultRate" | "arrearsRate") => {
    const n = sum(xs.map((x) => x.s.accounts));
    return n ? round(sum(xs.map((x) => x.s[k] * x.s.accounts)) / n, 2) : 0;
  };
  const all = segments.map((s) => ({ s }));
  const topDefault = weighted(top, "defaultRate");
  const topArrears = weighted(top, "arrearsRate");
  const portDefault = weighted(all, "defaultRate");
  const portArrears = weighted(all, "arrearsRate");
  const topAccounts = sum(top.map((t) => t.s.accounts));
  const similarity = (d: number) => round(100 * Math.exp(-1.5 * d), 1);
  const avgSimilarity = round(sum(top.map((t) => similarity(t.distance))) / top.length, 1);
  const lowSample = top.filter((t) => t.s.accounts < LOW_SAMPLE);
  const mismatches = top.filter((t) => t.mismatch).length;
  const direction = topDefault > portDefault ? "higher than" : topDefault < portDefault ? "lower than" : "the same as";

  const explanation = [
    `The application is compared with ${SEGMENT_COUNT} synthetic historical segments on min–max normalised revenue (log scale), years in business, leverage, DSCR and collateral coverage${i.industryWeight > 0 ? `; an industry mismatch adds a penalty weighted at ${fmt(i.industryWeight)}` : "; industry is ignored (weight 0)"}.`,
    `The ${TOP_K} nearest segments cover ${topAccounts} accounts with an account-weighted default rate of ${fmt(topDefault)}% — ${direction} the synthetic portfolio average of ${fmt(portDefault)}%.`,
    `Arrears in the comparables run at ${fmt(topArrears)}% versus ${fmt(portArrears)}% across the portfolio.`,
    mismatches > 0
      ? `${mismatches} of the ${TOP_K} comparables are from a different industry; raise the industry weight to favour same-industry segments.`
      : `All ${TOP_K} comparables are ${industryLabel(i.industry).toLowerCase()} segments.`,
    "Comparable outcomes describe what happened to similar historical segments. They are context for a reviewer — not a prediction, score or probability of default for this applicant.",
  ];

  const evidence = [
    `Segment library: ${SEGMENT_COUNT} synthetic segments generated deterministically from seed ${i.seed}; no real portfolio data.`,
    "Distance = √(Σ normalised feature differences² + industry penalty²); similarity = 100 × e^(−1.5 × distance).",
    ...top.map(
      (t) =>
        `${t.s.id}: distance ${fmt(t.distance, 3)}, largest difference on ${t.driver} (${t.driverDelta >= 0 ? "segment higher" : "segment lower"}), ${t.s.accounts} accounts.`,
    ),
    ...lowSample.map((t) => `${t.s.id} has only ${t.s.accounts} accounts (< ${LOW_SAMPLE}); its outcome rates are volatile.`),
  ];

  return {
    summary: `The ${TOP_K} most similar synthetic segments (${topAccounts} accounts, average similarity ${fmt(avgSimilarity, 1)}%) show a weighted default rate of ${fmt(topDefault)}% versus ${fmt(portDefault)}% for the portfolio.`,
    metrics: [
      { key: "comparable_default_rate", label: "Default rate · comparables", value: topDefault, before: portDefault, beforeLabel: "Portfolio", format: "percent", better: "lower" },
      { key: "comparable_arrears_rate", label: "Arrears rate · comparables", value: topArrears, before: portArrears, beforeLabel: "Portfolio", format: "percent", better: "lower" },
      { key: "comparable_accounts", label: "Accounts in comparables", value: topAccounts, format: "integer" },
      { key: "average_similarity", label: "Average similarity", value: avgSimilarity, format: "percent" },
      { key: "industry_matches", label: "Same-industry comparables", value: `${TOP_K - mismatches} / ${TOP_K}`, format: "text" },
    ],
    rows: {
      title: `Top ${TOP_K} comparable segments`,
      columns: [
        { key: "segment", label: "Segment" },
        { key: "industry", label: "Industry" },
        { key: "revenue", label: "Median revenue", format: "amount" },
        { key: "years", label: "Years", format: "integer" },
        { key: "leverage", label: "Leverage", format: "ratio" },
        { key: "dscr", label: "DSCR", format: "ratio" },
        { key: "collateral", label: "Collateral", format: "percent" },
        { key: "accounts", label: "Accounts", format: "integer" },
        { key: "defaultRate", label: "Default rate", format: "percent" },
        { key: "arrearsRate", label: "Arrears rate", format: "percent" },
        { key: "similarity", label: "Similarity", format: "percent" },
      ],
      data: top.map((t) => ({
        segment: t.s.id,
        industry: industryLabel(t.s.industry),
        revenue: t.s.revenue,
        years: t.s.years,
        leverage: t.s.leverage,
        dscr: t.s.dscr,
        collateral: t.s.collateral,
        accounts: t.s.accounts,
        defaultRate: t.s.defaultRate,
        arrearsRate: t.s.arrearsRate,
        similarity: similarity(t.distance),
      })),
    },
    explanation,
    evidence,
  };
}

export const engine: EngineDefinition<typeof inputSchema> = {
  key: "similar-portfolio-intelligence",
  name: "Comparable segment search",
  inputSchema,
  fields,
  run,
};
