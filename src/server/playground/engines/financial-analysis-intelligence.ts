/**
 * Financial Analysis Intelligence — "seasonality context" scenario. Generates 12 months of
 * synthetic SME cash flow with a seasonal cycle and compares the latest period with the
 * previous one, naively and after seasonal adjustment, explaining why the naive
 * comparison can mislead.
 */
import type { z } from "zod";
import { defineInputs, numberInput, selectInput, type EngineDefinition, type EngineResult } from "./types";
import { fmt, mulberry32, pctChange, round, sum } from "./math";

const MONTHS = [
  { value: "jan", label: "January" },
  { value: "feb", label: "February" },
  { value: "mar", label: "March" },
  { value: "apr", label: "April" },
  { value: "may", label: "May" },
  { value: "jun", label: "June" },
  { value: "jul", label: "July" },
  { value: "aug", label: "August" },
  { value: "sep", label: "September" },
  { value: "oct", label: "October" },
  { value: "nov", label: "November" },
  { value: "dec", label: "December" },
] as const;
const SHORT = MONTHS.map((m) => m.label.slice(0, 3));

const spec = defineInputs({
  seed: numberInput({ label: "Synthetic series seed", min: 1, max: 9999, step: 1, int: true }),
  baseMonthlyRevenue: numberInput({ label: "Average monthly revenue", min: 20, max: 5000, step: 10, unit: "k" }),
  underlyingGrowthPct: numberInput({ label: "Underlying growth (annual)", min: -30, max: 40, step: 1, unit: "%" }),
  seasonalAmplitudePct: numberInput({ label: "Seasonal amplitude", min: 0, max: 60, step: 1, unit: "%", help: "How far the peak month sits above an average month." }),
  peakMonth: selectInput({ label: "Seasonal peak month", options: MONTHS }),
  contributionMarginPct: numberInput({ label: "Contribution margin", min: 10, max: 70, step: 1, unit: "%" }),
  fixedMonthlyCosts: numberInput({ label: "Fixed monthly costs", min: 0, max: 3000, step: 5, unit: "k" }),
  noisePct: numberInput({ label: "Random noise", min: 0, max: 10, step: 0.5, unit: "%" }),
  comparison: selectInput({
    label: "Comparison",
    options: [
      { value: "quarter", label: "Latest quarter vs previous quarter" },
      { value: "month", label: "Latest month vs previous month" },
    ],
  }),
});

export const inputSchema = spec.schema;
export const fields = spec.fields;
export type SeasonalityInputs = z.infer<typeof inputSchema>;

export const defaultInputs: SeasonalityInputs = {
  seed: 11,
  baseMonthlyRevenue: 480,
  underlyingGrowthPct: 12,
  seasonalAmplitudePct: 35,
  peakMonth: "aug",
  contributionMarginPct: 38,
  fixedMonthlyCosts: 120,
  noisePct: 2,
  comparison: "quarter",
};

export interface MonthPoint {
  month: string;
  revenue: number;
  seasonalIndex: number;
  adjustedRevenue: number;
  cashFlow: number;
  adjustedCashFlow: number;
}

export function generateSeries(i: SeasonalityInputs): MonthPoint[] {
  const rng = mulberry32(i.seed);
  const peak = MONTHS.findIndex((m) => m.value === i.peakMonth);
  const amp = i.seasonalAmplitudePct / 100;
  const cm = i.contributionMarginPct / 100;
  return SHORT.map((month, m) => {
    // Cosine indices average exactly 1 across the 12 months.
    const seasonalIndex = 1 + amp * Math.cos((2 * Math.PI * (m - peak)) / 12);
    const growth = (1 + i.underlyingGrowthPct / 100) ** (m / 12);
    const noise = 1 + (i.noisePct / 100) * (2 * rng() - 1);
    const revenue = i.baseMonthlyRevenue * growth * seasonalIndex * noise;
    const adjustedRevenue = revenue / seasonalIndex;
    return {
      month,
      revenue: round(revenue, 1),
      seasonalIndex: round(seasonalIndex, 3),
      adjustedRevenue: round(adjustedRevenue, 1),
      cashFlow: round(revenue * cm - i.fixedMonthlyCosts, 1),
      adjustedCashFlow: round(adjustedRevenue * cm - i.fixedMonthlyCosts, 1),
    };
  });
}

export function comparePeriods(series: MonthPoint[], comparison: SeasonalityInputs["comparison"]) {
  const len = comparison === "quarter" ? 3 : 1;
  const current = series.slice(12 - len);
  const previous = series.slice(12 - 2 * len, 12 - len);
  const tot = (xs: MonthPoint[], k: keyof Omit<MonthPoint, "month">) => sum(xs.map((x) => x[k]));
  const label = (xs: MonthPoint[]) => (xs.length === 1 ? xs[0]!.month : `${xs[0]!.month}–${xs[xs.length - 1]!.month}`);
  const r = (x: number | null) => (x === null ? null : round(x, 1));
  return {
    currentLabel: label(current),
    previousLabel: label(previous),
    currentMonths: current.map((x) => x.month),
    previousMonths: previous.map((x) => x.month),
    naiveRevenue: r(pctChange(tot(previous, "revenue"), tot(current, "revenue"))),
    adjustedRevenue: r(pctChange(tot(previous, "adjustedRevenue"), tot(current, "adjustedRevenue"))),
    naiveCashFlow: r(pctChange(tot(previous, "cashFlow"), tot(current, "cashFlow"))),
    adjustedCashFlow: r(pctChange(tot(previous, "adjustedCashFlow"), tot(current, "adjustedCashFlow"))),
    currentIndex: round(tot(current, "seasonalIndex") / current.length, 3),
    previousIndex: round(tot(previous, "seasonalIndex") / previous.length, 3),
    currentRevenue: round(tot(current, "revenue"), 1),
  };
}

const signed = (x: number | null) => (x === null ? "n/a" : `${x > 0 ? "+" : ""}${fmt(x, 1)}%`);
const movement = (x: number | null) => (x === null ? "cannot be compared (base near zero)" : x > 0 ? `up ${fmt(x, 1)}%` : x < 0 ? `down ${fmt(Math.abs(x), 1)}%` : "flat");

export function run(i: SeasonalityInputs): EngineResult {
  const series = generateSeries(i);
  const c = comparePeriods(series, i.comparison);
  const period = i.comparison === "quarter" ? "quarter" : "month";
  const peakLabel = MONTHS.find((m) => m.value === i.peakMonth)!.label;
  const seasonalEffect = c.naiveRevenue !== null && c.adjustedRevenue !== null ? round(c.naiveRevenue - c.adjustedRevenue, 1) : null;
  const signFlip =
    c.naiveRevenue !== null && c.adjustedRevenue !== null && Math.sign(c.naiveRevenue) !== Math.sign(c.adjustedRevenue) && Math.abs(c.naiveRevenue) >= 0.5;

  const explanation = [
    `A naive comparison of ${c.currentLabel} with ${c.previousLabel} shows revenue ${movement(c.naiveRevenue)}.`,
    i.seasonalAmplitudePct === 0
      ? "This synthetic business has no seasonal cycle, so the naive and seasonally adjusted comparisons coincide."
      : `${peakLabel} is the seasonal peak; the average seasonal index is ${fmt(c.currentIndex, 3)} in ${c.currentLabel} versus ${fmt(c.previousIndex, 3)} in ${c.previousLabel}, so about ${fmt(Math.abs(seasonalEffect ?? 0), 1)} percentage points of the movement is the calendar rather than the business.`,
    `After dividing each month by its seasonal index, revenue is ${movement(c.adjustedRevenue)} — consistent with the ${fmt(i.underlyingGrowthPct, 0)}% annual underlying growth built into this synthetic series (plus ±${fmt(i.noisePct, 1)}% noise).`,
    `Fixed costs of ${fmt(i.fixedMonthlyCosts, 0)}k a month amplify the swing in operating cash flow: ${signed(c.naiveCashFlow)} naively versus ${signed(c.adjustedCashFlow)} after adjustment.`,
  ];
  if (signFlip) {
    explanation.push(
      `The naive comparison points in the opposite direction to the underlying trend — reading it as ${c.naiveRevenue! < 0 ? "deterioration" : "improvement"} would mislead a credit review.`,
    );
  }
  explanation.push(
    `Why a naive comparison misleads: consecutive ${period}s sit at different points of the annual cycle. Compare like-for-like periods (the same ${period} last year) or seasonally adjust before drawing conclusions, and record the seasonal context alongside the figure.`,
  );

  const evidence = [
    `12 months of synthetic SME cash flow generated from seed ${i.seed}: average revenue ${fmt(i.baseMonthlyRevenue, 0)}k/month, growth ${fmt(i.underlyingGrowthPct, 0)}%/year, seasonal amplitude ${fmt(i.seasonalAmplitudePct, 0)}%, peak ${peakLabel}, noise ±${fmt(i.noisePct, 1)}%.`,
    "Seasonal indices come from the synthetic sector profile used to generate the series; in practice they would be estimated from several years of history or a sector benchmark.",
    `Operating cash flow = revenue × ${fmt(i.contributionMarginPct, 0)}% contribution margin − ${fmt(i.fixedMonthlyCosts, 0)}k fixed costs.`,
    `Comparison window: ${c.currentMonths.join(", ")} vs ${c.previousMonths.join(", ")}. Figures in synthetic currency units (thousands).`,
  ];

  const inCurrent = new Set(c.currentMonths);
  const inPrevious = new Set(c.previousMonths);
  return {
    summary: `${c.currentLabel} vs ${c.previousLabel}: revenue ${signed(c.naiveRevenue)} naively but ${signed(c.adjustedRevenue)} after seasonal adjustment${seasonalEffect !== null && i.seasonalAmplitudePct > 0 ? ` — about ${fmt(Math.abs(seasonalEffect), 1)} points of the naive change is seasonal` : ""}.`,
    metrics: [
      { key: "revenue_change", label: "Revenue change · seasonally adjusted", value: c.adjustedRevenue ?? "n/a", before: c.naiveRevenue ?? "n/a", beforeLabel: "Naive", format: "percent" },
      { key: "cash_flow_change", label: "Operating cash flow change · adjusted", value: c.adjustedCashFlow ?? "n/a", before: c.naiveCashFlow ?? "n/a", beforeLabel: "Naive", format: "percent" },
      { key: "seasonal_effect", label: "Seasonal effect in naive change", value: seasonalEffect ?? "n/a", format: "number", unit: "pp" },
      { key: "seasonal_index", label: "Average seasonal index", value: c.currentIndex, before: c.previousIndex, beforeLabel: "Previous", format: "number" },
      { key: "current_revenue", label: `Revenue · ${c.currentLabel}`, value: c.currentRevenue, format: "amount" },
    ],
    rows: {
      title: "Synthetic monthly series",
      columns: [
        { key: "month", label: "Month" },
        { key: "window", label: "Window" },
        { key: "revenue", label: "Revenue", format: "amount" },
        { key: "seasonalIndex", label: "Seasonal index", format: "number" },
        { key: "adjustedRevenue", label: "Adjusted revenue", format: "amount" },
        { key: "cashFlow", label: "Operating cash flow", format: "amount" },
        { key: "adjustedCashFlow", label: "Adjusted cash flow", format: "amount" },
      ],
      data: series.map((p) => ({
        month: p.month,
        window: inCurrent.has(p.month) ? "Current" : inPrevious.has(p.month) ? "Previous" : "",
        revenue: p.revenue,
        seasonalIndex: p.seasonalIndex,
        adjustedRevenue: p.adjustedRevenue,
        cashFlow: p.cashFlow,
        adjustedCashFlow: p.adjustedCashFlow,
      })),
    },
    explanation,
    evidence,
  };
}

export const engine: EngineDefinition<typeof inputSchema> = {
  key: "financial-analysis-intelligence",
  name: "Seasonality-aware period comparison",
  inputSchema,
  fields,
  run,
};
