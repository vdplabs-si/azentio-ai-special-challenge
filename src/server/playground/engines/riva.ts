/**
 * RIVA — validates a synthetic regulatory loan-book report against a source-to-report
 * mapping table and configurable validation rules, producing an exceptions list.
 * Data-quality defects are injected deliberately (seeded) to demonstrate exception handling.
 */
import type { z } from "zod";
import { defineInputs, numberInput, type EngineDefinition, type EngineResult } from "./types";
import { fmt, mulberry32, pad, pick, round, sum } from "./math";

export const PRODUCT_MAPPING: Record<string, string> = {
  TL01: "Term loans",
  OD02: "Overdrafts",
  TF03: "Trade finance",
  MG04: "Mortgages",
  CC05: "Credit cards",
};
const PRODUCT_CODES = Object.keys(PRODUCT_MAPPING);
const CURRENCIES = ["AED", "SAR", "USD", "EUR", "INR"] as const;
const SECTOR_CODES = ["A01", "B02", "C03", "D04", "E05", "F06"] as const;
const DEFECTS = ["unmapped_product", "invalid_currency", "provision_exceeds", "missing_sector", "stage_mismatch", "negative_balance"] as const;

const spec = defineInputs({
  seed: numberInput({ label: "Synthetic report seed", min: 1, max: 9999, step: 1, int: true }),
  rowCount: numberInput({ label: "Report rows", min: 10, max: 80, step: 1, int: true }),
  errorRatePct: numberInput({ label: "Injected defect rate", min: 0, max: 40, step: 1, unit: "%", help: "Share of rows that receive a deliberate synthetic data-quality defect." }),
  stage2DpdThreshold: numberInput({ label: "Stage 2 from (days past due)", min: 15, max: 60, step: 1, int: true, unit: "days" }),
  stage3DpdThreshold: numberInput({ label: "Stage 3 from (days past due)", min: 61, max: 180, step: 1, int: true, unit: "days" }),
  reconciliationTolerance: numberInput({ label: "Control-total tolerance", min: 0, max: 500, step: 5, unit: "k" }),
});

export const inputSchema = spec.schema;
export const fields = spec.fields;
export type RivaInputs = z.infer<typeof inputSchema>;

export const defaultInputs: RivaInputs = {
  seed: 2026,
  rowCount: 40,
  errorRatePct: 12,
  stage2DpdThreshold: 30,
  stage3DpdThreshold: 90,
  reconciliationTolerance: 50,
};

export interface ReportRow {
  rowRef: string;
  productCode: string;
  currency: string;
  outstanding: number;
  provision: number;
  stage: 1 | 2 | 3;
  dpd: number;
  sectorCode: string;
  injected: (typeof DEFECTS)[number] | null;
}

/**
 * Deterministic synthetic report. Every row consumes the same random draws regardless of
 * the defect rate, so a higher rate injects defects into a superset of rows.
 */
export function generateReport(seed: number, rowCount: number, errorRatePct: number) {
  const rng = mulberry32(seed);
  let ledgerTotal = 0;
  const rows: ReportRow[] = Array.from({ length: rowCount }, (_, i) => {
    const productCode = pick(rng, PRODUCT_CODES);
    const currency: string = pick(rng, CURRENCIES);
    const outstanding = round(5 + 995 * rng() ** 2, 1);
    const u = rng();
    const stage: 1 | 2 | 3 = u < 0.8 ? 1 : u < 0.93 ? 2 : 3;
    const r = rng();
    // "True" days past due follow standard 30/90 bands; validation thresholds are configurable.
    const dpd = stage === 1 ? Math.floor(r * 30) : stage === 2 ? 30 + Math.floor(r * 60) : 90 + Math.floor(r * 200);
    const provisionPct = stage === 1 ? 0.005 + 0.015 * rng() : stage === 2 ? 0.03 + 0.07 * rng() : 0.25 + 0.35 * rng();
    const sectorCode: string = pick(rng, SECTOR_CODES);
    const defectDraw = rng();
    const defect = DEFECTS[Math.floor(rng() * DEFECTS.length)]!;
    ledgerTotal += outstanding;
    const row: ReportRow = {
      rowRef: `R-${pad(i + 1)}`,
      productCode,
      currency,
      outstanding,
      provision: round(outstanding * provisionPct, 2),
      stage,
      dpd,
      sectorCode,
      injected: null,
    };
    if (defectDraw < errorRatePct / 100) {
      row.injected = defect;
      if (defect === "unmapped_product") row.productCode = "XX9";
      if (defect === "invalid_currency") row.currency = "XYZ";
      if (defect === "provision_exceeds") row.provision = round(row.outstanding * 1.15, 2);
      if (defect === "missing_sector") row.sectorCode = "";
      if (defect === "stage_mismatch") {
        row.stage = 1;
        row.dpd = 95;
      }
      if (defect === "negative_balance") row.outstanding = -row.outstanding;
    }
    return row;
  });
  const ledgerOffset = round((rng() - 0.5) * 120, 1);
  return { rows, ledgerTotal: round(ledgerTotal + ledgerOffset, 1) };
}

interface Exception {
  rowRef: string;
  rule: string;
  severity: "Error" | "Warning";
  field: string;
  value: string;
  message: string;
}

export function validate(rows: ReportRow[], ledgerTotal: number, i: RivaInputs) {
  const exceptions: Exception[] = [];
  const push = (e: Exception) => exceptions.push(e);
  for (const r of rows) {
    if (!PRODUCT_MAPPING[r.productCode])
      push({ rowRef: r.rowRef, rule: "R1 Product mapping", severity: "Error", field: "productCode", value: r.productCode, message: "Source product code has no regulatory category in the mapping table." });
    if (!(CURRENCIES as readonly string[]).includes(r.currency))
      push({ rowRef: r.rowRef, rule: "R2 Reporting currency", severity: "Error", field: "currency", value: r.currency, message: "Currency is not in the permitted reporting currency list." });
    if (r.outstanding < 0)
      push({ rowRef: r.rowRef, rule: "R3 Non-negative balance", severity: "Error", field: "outstanding", value: fmt(r.outstanding, 1), message: "Outstanding balance must not be negative." });
    else if (r.provision > r.outstanding)
      push({ rowRef: r.rowRef, rule: "R4 Provision ≤ balance", severity: "Error", field: "provision", value: fmt(r.provision), message: `Provision exceeds the outstanding balance of ${fmt(r.outstanding, 1)}k.` });
    const expected = r.dpd >= i.stage3DpdThreshold ? 3 : r.dpd >= i.stage2DpdThreshold ? 2 : 1;
    if (expected !== r.stage)
      push({ rowRef: r.rowRef, rule: "R5 Stage vs days past due", severity: "Warning", field: "stage", value: `Stage ${r.stage} · ${r.dpd} DPD`, message: `With thresholds ${i.stage2DpdThreshold}/${i.stage3DpdThreshold} days, ${r.dpd} DPD implies stage ${expected}.` });
    if (!r.sectorCode)
      push({ rowRef: r.rowRef, rule: "R6 Sector code present", severity: "Error", field: "sectorCode", value: "(blank)", message: "Counterparty sector code is required for the sector breakdown." });
  }
  const reportedTotal = round(sum(rows.map((r) => r.outstanding)), 1);
  const difference = round(reportedTotal - ledgerTotal, 1);
  const reconciles = Math.abs(difference) <= i.reconciliationTolerance;
  if (!reconciles)
    push({ rowRef: "TOTAL", rule: "R7 Control-total reconciliation", severity: "Error", field: "outstanding", value: `${fmt(difference, 1)}k`, message: `Reported total ${fmt(reportedTotal, 1)}k differs from the ledger control total ${fmt(ledgerTotal, 1)}k by more than ${fmt(i.reconciliationTolerance, 0)}k.` });
  return { exceptions, reportedTotal, difference, reconciles };
}

export function run(i: RivaInputs): EngineResult {
  const { rows, ledgerTotal } = generateReport(i.seed, i.rowCount, i.errorRatePct);
  const { exceptions, reportedTotal, difference, reconciles } = validate(rows, ledgerTotal, i);
  const rowLevel = exceptions.filter((e) => e.rowRef !== "TOTAL");
  const rowsWithExceptions = new Set(rowLevel.map((e) => e.rowRef)).size;
  const errors = exceptions.filter((e) => e.severity === "Error").length;
  const rowErrors = rowLevel.filter((e) => e.severity === "Error").length;
  const reportLevel = reconciles ? "" : ", plus one report-level reconciliation error";
  const warnings = exceptions.filter((e) => e.severity === "Warning").length;
  const injected = rows.filter((r) => r.injected).length;
  const passRate = round(((rows.length - rowsWithExceptions) / rows.length) * 100, 1);
  const byRule = new Map<string, number>();
  for (const e of exceptions) byRule.set(e.rule, (byRule.get(e.rule) ?? 0) + 1);
  const thresholdWarnings = rowLevel.filter((e) => e.rule.startsWith("R5")).length - rows.filter((r) => r.injected === "stage_mismatch").length;

  const explanation = [
    `Each of the ${rows.length} synthetic report rows is mapped from its source product code to a regulatory category, then checked against rules R1–R6; R7 reconciles the report total with the ledger control total.`,
    `${rowsWithExceptions} rows raised exceptions (${rowErrors} errors, ${warnings} warnings)${reportLevel}; ${fmt(passRate, 1)}% of rows passed every rule.`,
    `${injected} rows received a deliberately injected defect at the ${fmt(i.errorRatePct, 0)}% defect rate — this is how the demonstration shows exception handling; real reports would surface their own issues.`,
    thresholdWarnings > 0
      ? `${thresholdWarnings} stage warnings come purely from the configured thresholds (${i.stage2DpdThreshold}/${i.stage3DpdThreshold} days) differing from the 30/90-day bands the source system used — changing a rule changes the exceptions without any data change.`
      : `Stage assignments are consistent with the configured ${i.stage2DpdThreshold}/${i.stage3DpdThreshold}-day thresholds apart from injected defects.`,
    reconciles
      ? `The report total reconciles with the ledger: difference ${fmt(difference, 1)}k is within the ${fmt(i.reconciliationTolerance, 0)}k tolerance.`
      : `The report total does not reconcile: difference ${fmt(difference, 1)}k exceeds the ${fmt(i.reconciliationTolerance, 0)}k tolerance, so the submission should be held for review.`,
  ];

  const evidence = [
    `Synthetic report generated deterministically from seed ${i.seed}; account references are synthetic.`,
    `Mapping table (synthetic v1): ${Object.entries(PRODUCT_MAPPING).map(([k, v]) => `${k} → ${v}`).join(", ")}.`,
    `Permitted reporting currencies: ${CURRENCIES.join(", ")}.`,
    ...[...byRule.entries()].map(([rule, n]) => `${rule}: ${n} exception${n === 1 ? "" : "s"}.`),
    `Control totals: reported ${fmt(reportedTotal, 1)}k, ledger ${fmt(ledgerTotal, 1)}k (synthetic currency, thousands).`,
  ];

  return {
    summary: `${rowsWithExceptions} of ${rows.length} rows raised ${rowErrors} errors and ${warnings} warnings; the control total ${reconciles ? "reconciles" : "does not reconcile"} (difference ${fmt(difference, 1)}k, tolerance ${fmt(i.reconciliationTolerance, 0)}k).`,
    metrics: [
      { key: "rows_validated", label: "Rows validated", value: rows.length, format: "integer" },
      { key: "rows_with_exceptions", label: "Rows with exceptions", value: rowsWithExceptions, format: "integer", better: "lower" },
      { key: "errors", label: "Errors", value: errors, format: "integer", better: "lower" },
      { key: "warnings", label: "Warnings", value: warnings, format: "integer", better: "lower" },
      { key: "pass_rate", label: "Row pass rate", value: passRate, format: "percent", better: "higher" },
      { key: "reconciliation_difference", label: "Control-total difference", value: difference, format: "amount", hint: reconciles ? "Within tolerance" : "Outside tolerance" },
    ],
    rows: {
      title: "Exceptions",
      columns: [
        { key: "rowRef", label: "Row" },
        { key: "rule", label: "Rule" },
        { key: "severity", label: "Severity" },
        { key: "field", label: "Field" },
        { key: "value", label: "Value" },
        { key: "message", label: "Message" },
      ],
      data: exceptions.map((e) => ({ ...e })),
      emptyMessage: "No exceptions — every row passed every rule and the control total reconciles.",
    },
    explanation,
    evidence,
  };
}

export const engine: EngineDefinition<typeof inputSchema> = {
  key: "riva",
  name: "Report validation",
  inputSchema,
  fields,
  run,
};
