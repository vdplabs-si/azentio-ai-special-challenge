/**
 * SME Credit Decisioning Workbench — computes core ratios from synthetic SME financials,
 * evaluates them against an indicative policy with evidence, and labels the outcome as
 * indicative only: a human credit officer always decides.
 */
import type { z } from "zod";
import { defineInputs, numberInput, selectInput, type EngineDefinition, type EngineResult } from "./types";
import { fmt, round } from "./math";

export const RECOMMENDATION_LABEL = "Indicative — requires human review";
const STRESS_CONTRIBUTION_MARGIN = 0.35;
const STRESSED_DSCR_FLOOR = 1.0;

const SECTORS = [
  { value: "trading", label: "Trading & distribution", stress: 0.15 },
  { value: "manufacturing", label: "Manufacturing", stress: 0.2 },
  { value: "services", label: "Professional services", stress: 0.1 },
  { value: "agribusiness", label: "Agribusiness", stress: 0.25 },
] as const;

const spec = defineInputs({
  sector: selectInput({ label: "Sector", options: SECTORS, help: "Sets the synthetic revenue stress applied in the stress test." }),
  annualRevenue: numberInput({ label: "Annual revenue", min: 200, max: 50000, step: 50, unit: "k" }),
  ebitdaMarginPct: numberInput({ label: "EBITDA margin", min: 2, max: 40, step: 0.5, unit: "%" }),
  existingDebt: numberInput({ label: "Existing debt", min: 0, max: 30000, step: 50, unit: "k" }),
  existingDebtService: numberInput({ label: "Existing annual debt service", min: 0, max: 10000, step: 10, unit: "k" }),
  requestedAmount: numberInput({ label: "Requested facility", min: 50, max: 20000, step: 50, unit: "k" }),
  tenorYears: numberInput({ label: "Tenor", min: 1, max: 10, step: 1, int: true, unit: "years" }),
  interestRatePct: numberInput({ label: "Interest rate", min: 2, max: 25, step: 0.25, unit: "%" }),
  currentAssets: numberInput({ label: "Current assets", min: 10, max: 40000, step: 10, unit: "k" }),
  currentLiabilities: numberInput({ label: "Current liabilities", min: 10, max: 40000, step: 10, unit: "k" }),
  policyMinDscr: numberInput({ label: "Policy · minimum DSCR", min: 1, max: 2.5, step: 0.05, unit: "x" }),
  policyMinCurrentRatio: numberInput({ label: "Policy · minimum current ratio", min: 0.8, max: 2.5, step: 0.05, unit: "x" }),
  policyMaxLeverage: numberInput({ label: "Policy · maximum leverage (debt / EBITDA)", min: 1, max: 8, step: 0.25, unit: "x" }),
});

export const inputSchema = spec.schema;
export const fields = spec.fields;
export type SmeInputs = z.infer<typeof inputSchema>;

export const defaultInputs: SmeInputs = {
  sector: "trading",
  annualRevenue: 12000,
  ebitdaMarginPct: 11,
  existingDebt: 2400,
  existingDebtService: 520,
  requestedAmount: 1500,
  tenorYears: 5,
  interestRatePct: 9,
  currentAssets: 4200,
  currentLiabilities: 3100,
  policyMinDscr: 1.25,
  policyMinCurrentRatio: 1.2,
  policyMaxLeverage: 3.5,
};

/** Level annual payment on an amortising facility. */
export function annuity(principal: number, ratePct: number, years: number) {
  const r = ratePct / 100;
  if (r === 0) return principal / years;
  return (principal * r) / (1 - (1 + r) ** -years);
}

export function run(i: SmeInputs): EngineResult {
  const sector = SECTORS.find((s) => s.value === i.sector)!;
  const ebitda = (i.annualRevenue * i.ebitdaMarginPct) / 100;
  const newDebtService = annuity(i.requestedAmount, i.interestRatePct, i.tenorYears);
  const totalDebtService = i.existingDebtService + newDebtService;
  const dscr = ebitda / totalDebtService;
  const currentRatio = i.currentAssets / i.currentLiabilities;
  const totalDebt = i.existingDebt + i.requestedAmount;
  const leverage = totalDebt / ebitda;
  const lostRevenue = i.annualRevenue * sector.stress;
  const stressedEbitda = ebitda - lostRevenue * STRESS_CONTRIBUTION_MARGIN;
  const stressedDscr = stressedEbitda / totalDebtService;

  const checks = [
    {
      check: "Debt service coverage (DSCR)",
      policy: `≥ ${fmt(i.policyMinDscr)}x`,
      actual: round(dscr, 2),
      pass: dscr >= i.policyMinDscr,
      evidence: `EBITDA ${fmt(ebitda, 0)}k ÷ annual debt service ${fmt(totalDebtService, 0)}k (existing ${fmt(i.existingDebtService, 0)}k + new ${fmt(newDebtService, 0)}k).`,
    },
    {
      check: "Liquidity (current ratio)",
      policy: `≥ ${fmt(i.policyMinCurrentRatio)}x`,
      actual: round(currentRatio, 2),
      pass: currentRatio >= i.policyMinCurrentRatio,
      evidence: `Current assets ${fmt(i.currentAssets, 0)}k ÷ current liabilities ${fmt(i.currentLiabilities, 0)}k.`,
    },
    {
      check: "Leverage (total debt / EBITDA)",
      policy: `≤ ${fmt(i.policyMaxLeverage)}x`,
      actual: round(leverage, 2),
      pass: leverage <= i.policyMaxLeverage,
      evidence: `Total debt after the facility ${fmt(totalDebt, 0)}k (existing ${fmt(i.existingDebt, 0)}k + requested ${fmt(i.requestedAmount, 0)}k) ÷ EBITDA ${fmt(ebitda, 0)}k.`,
    },
    {
      check: "Stressed DSCR",
      policy: `≥ ${fmt(STRESSED_DSCR_FLOOR)}x`,
      actual: round(stressedDscr, 2),
      pass: stressedDscr >= STRESSED_DSCR_FLOOR,
      evidence: `Revenue −${sector.stress * 100}% (${sector.label} profile) loses ${fmt(lostRevenue, 0)}k at a ${STRESS_CONTRIBUTION_MARGIN * 100}% contribution margin → stressed EBITDA ${fmt(stressedEbitda, 0)}k.`,
    },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);
  const outcome =
    failed.length === 0
      ? "Within indicative policy"
      : failed.length === 1
        ? "Refer — one policy exception"
        : "Outside indicative policy";

  const explanation = [
    `The requested ${fmt(i.requestedAmount, 0)}k over ${i.tenorYears} years at ${fmt(i.interestRatePct)}% adds ${fmt(newDebtService, 0)}k of annual debt service to the existing ${fmt(i.existingDebtService, 0)}k.`,
    ...checks.map((c) =>
      c.pass
        ? `${c.check} is ${fmt(c.actual)}x against a policy of ${c.policy} — passes.`
        : `${c.check} is ${fmt(c.actual)}x against a policy of ${c.policy} — fails; this is the evidence a reviewer would need to challenge or mitigate.`,
    ),
    `${passed} of ${checks.length} indicative policy checks pass: ${outcome.toLowerCase()}.`,
    `${RECOMMENDATION_LABEL}: a credit officer must verify the financial statements, collateral and the qualitative factors (management, market position, conduct) this workbench does not assess.`,
  ];

  const evidence = [
    "Financials are synthetic sample inputs (synthetic currency, thousands) — not a real borrower.",
    `Annual debt service on the requested facility uses a level annuity: P × r ÷ (1 − (1 + r)^−n) = ${fmt(newDebtService, 1)}k.`,
    `Sector stress assumption for ${sector.label}: revenue −${sector.stress * 100}% (synthetic sector profile); stressed DSCR floor ${fmt(STRESSED_DSCR_FLOOR)}x.`,
    ...checks.map((c) => `${c.check}: ${c.evidence}`),
  ];

  return {
    summary: `${outcome}: ${passed} of ${checks.length} policy checks passed (DSCR ${fmt(dscr)}x, current ratio ${fmt(currentRatio)}x, leverage ${fmt(leverage)}x). ${RECOMMENDATION_LABEL}.`,
    metrics: [
      { key: "recommendation", label: "Recommendation", value: RECOMMENDATION_LABEL, format: "text", hint: outcome },
      { key: "dscr", label: "DSCR", value: round(dscr, 2), format: "ratio", better: "higher", hint: `Policy ≥ ${fmt(i.policyMinDscr)}x` },
      { key: "current_ratio", label: "Current ratio", value: round(currentRatio, 2), format: "ratio", better: "higher", hint: `Policy ≥ ${fmt(i.policyMinCurrentRatio)}x` },
      { key: "leverage", label: "Leverage (debt / EBITDA)", value: round(leverage, 2), format: "ratio", better: "lower", hint: `Policy ≤ ${fmt(i.policyMaxLeverage)}x` },
      { key: "stressed_dscr", label: "Stressed DSCR", value: round(stressedDscr, 2), before: round(dscr, 2), beforeLabel: "Unstressed", format: "ratio", better: "higher" },
      { key: "checks_passed", label: "Policy checks passed", value: `${passed} / ${checks.length}`, format: "text" },
    ],
    rows: {
      title: "Policy checks and evidence",
      columns: [
        { key: "check", label: "Check" },
        { key: "policy", label: "Policy" },
        { key: "actual", label: "Actual", format: "ratio" },
        { key: "result", label: "Result" },
        { key: "evidence", label: "Evidence" },
      ],
      data: checks.map((c) => ({ check: c.check, policy: c.policy, actual: c.actual, result: c.pass ? "PASS" : "FAIL", evidence: c.evidence })),
    },
    explanation,
    evidence,
  };
}

export const engine: EngineDefinition<typeof inputSchema> = {
  key: "sme-credit-decisioning",
  name: "SME credit workbench",
  inputSchema,
  fields,
  run,
};
