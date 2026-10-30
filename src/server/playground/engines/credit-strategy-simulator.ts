/**
 * Credit Strategy Simulator — compares a proposed credit policy against a baseline policy
 * over a synthetic applicant pool generated from a seeded PRNG.
 */
import type { z } from "zod";
import { defineInputs, numberInput, type EngineDefinition, type EngineResult } from "./types";
import { bell, fmt, mulberry32, pad, round, sum } from "./math";

const LGD = 0.45;

const spec = defineInputs({
  seed: numberInput({ label: "Synthetic pool seed", min: 1, max: 9999, step: 1, int: true, help: "Changes which synthetic applicants are generated." }),
  poolSize: numberInput({ label: "Applicants in pool", min: 20, max: 80, step: 1, int: true }),
  baselineMinScore: numberInput({ label: "Baseline · minimum score", min: 500, max: 800, step: 5, int: true, unit: "pts" }),
  baselineMaxDti: numberInput({ label: "Baseline · maximum DTI", min: 10, max: 80, step: 1, unit: "%" }),
  baselineMinDscr: numberInput({ label: "Baseline · minimum DSCR", min: 0.8, max: 2.5, step: 0.05, unit: "x" }),
  minScore: numberInput({ label: "Proposed · minimum score", min: 500, max: 800, step: 5, int: true, unit: "pts" }),
  maxDti: numberInput({ label: "Proposed · maximum DTI", min: 10, max: 80, step: 1, unit: "%", help: "Debt-to-income ratio ceiling." }),
  minDscr: numberInput({ label: "Proposed · minimum DSCR", min: 0.8, max: 2.5, step: 0.05, unit: "x", help: "Debt service coverage floor." }),
});

export const inputSchema = spec.schema;
export const fields = spec.fields;
export type CreditStrategyInputs = z.infer<typeof inputSchema>;

export const defaultInputs: CreditStrategyInputs = {
  seed: 42,
  poolSize: 40,
  baselineMinScore: 600,
  baselineMaxDti: 45,
  baselineMinDscr: 1.2,
  minScore: 640,
  maxDti: 40,
  minDscr: 1.3,
};

export interface Applicant {
  id: string;
  score: number;
  dti: number; // %
  dscr: number; // x
  amount: number; // synthetic currency, thousands
  pd: number; // 0–1 synthetic probability of default
}

interface Policy {
  minScore: number;
  maxDti: number;
  minDscr: number;
}

/** Deterministic synthetic applicant pool. */
export function generateApplicants(seed: number, size: number): Applicant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: size }, (_, i) => {
    const score = Math.round(540 + 260 * bell(rng));
    const dti = round(12 + 50 * rng(), 1);
    const dscr = round(0.7 + 1.9 * bell(rng, 2), 2);
    const amount = Math.round(10 + 240 * rng() ** 1.5);
    const z = -2.4 - 0.015 * (score - 660) + 0.045 * (dti - 35) - 1.1 * (dscr - 1.4);
    const pd = round(1 / (1 + Math.exp(-z)), 4);
    return { id: `APP-${pad(i + 1)}`, score, dti, dscr, amount, pd };
  });
}

function failures(a: Applicant, p: Policy) {
  const f: string[] = [];
  if (a.score < p.minScore) f.push(`Score < ${p.minScore}`);
  if (a.dti > p.maxDti) f.push(`DTI > ${fmt(p.maxDti, 1)}%`);
  if (a.dscr < p.minDscr) f.push(`DSCR < ${fmt(p.minDscr)}x`);
  return f;
}

function portfolioStats(approved: Applicant[], poolSize: number) {
  const exposure = sum(approved.map((a) => a.amount));
  const expectedLoss = sum(approved.map((a) => a.pd * LGD * a.amount));
  return {
    count: approved.length,
    approvalRate: round((approved.length / poolSize) * 100, 1),
    exposure: round(exposure, 1),
    expectedLoss: round(expectedLoss, 1),
    elRate: exposure > 0 ? round((expectedLoss / exposure) * 100, 2) : 0,
    avgPd: approved.length ? round((sum(approved.map((a) => a.pd)) / approved.length) * 100, 2) : 0,
  };
}

export function run(inputs: CreditStrategyInputs): EngineResult {
  const pool = generateApplicants(inputs.seed, inputs.poolSize);
  const baseline: Policy = { minScore: inputs.baselineMinScore, maxDti: inputs.baselineMaxDti, minDscr: inputs.baselineMinDscr };
  const proposed: Policy = { minScore: inputs.minScore, maxDti: inputs.maxDti, minDscr: inputs.minDscr };

  const evaluated = pool.map((a) => {
    const bf = failures(a, baseline);
    const pf = failures(a, proposed);
    return { a, before: bf.length === 0, after: pf.length === 0, reasons: pf };
  });
  const before = portfolioStats(evaluated.filter((e) => e.before).map((e) => e.a), pool.length);
  const after = portfolioStats(evaluated.filter((e) => e.after).map((e) => e.a), pool.length);
  const newlyDeclined = evaluated.filter((e) => e.before && !e.after);
  const newlyApproved = evaluated.filter((e) => !e.before && e.after);
  const retained = evaluated.filter((e) => e.before && e.after);

  const failScore = pool.filter((a) => a.score < proposed.minScore).length;
  const failDti = pool.filter((a) => a.dti > proposed.maxDti).length;
  const failDscr = pool.filter((a) => a.dscr < proposed.minDscr).length;

  const stricter = proposed.minScore >= baseline.minScore && proposed.maxDti <= baseline.maxDti && proposed.minDscr >= baseline.minDscr;
  const looser = proposed.minScore <= baseline.minScore && proposed.maxDti >= baseline.maxDti && proposed.minDscr <= baseline.minDscr;
  const policyText = (p: Policy) => `score ≥ ${p.minScore}, DTI ≤ ${fmt(p.maxDti, 1)}%, DSCR ≥ ${fmt(p.minDscr)}x`;
  const avgPd = (xs: typeof evaluated) => (xs.length ? round((sum(xs.map((e) => e.a.pd)) / xs.length) * 100, 2) : 0);

  const explanation = [
    `Under the baseline policy (${policyText(baseline)}) ${before.count} of ${pool.length} synthetic applicants are approved (${fmt(before.approvalRate, 1)}%).`,
    `Under the proposed policy (${policyText(proposed)}) ${after.count} are approved (${fmt(after.approvalRate, 1)}%): ${newlyDeclined.length} newly declined and ${newlyApproved.length} newly approved.`,
    stricter
      ? "Every proposed threshold is at least as strict as the baseline, so the approved set can only shrink or stay the same."
      : looser
        ? "Every proposed threshold is at least as permissive as the baseline, so the approved set can only grow or stay the same."
        : "The proposal tightens some thresholds and relaxes others, so applicants move in both directions.",
    `The expected-loss proxy moves from ${fmt(before.expectedLoss, 1)}k to ${fmt(after.expectedLoss, 1)}k on approved exposure of ${fmt(before.exposure, 0)}k → ${fmt(after.exposure, 0)}k (loss rate ${fmt(before.elRate)}% → ${fmt(after.elRate)}%).`,
  ];
  if (newlyDeclined.length > 0) {
    explanation.push(
      `Applicants removed by the proposal have an average synthetic PD of ${fmt(avgPd(newlyDeclined))}% versus ${fmt(avgPd(retained))}% for applicants approved under both policies.`,
    );
  }
  if (newlyApproved.length > 0) {
    explanation.push(`Applicants added by the proposal have an average synthetic PD of ${fmt(avgPd(newlyApproved))}%.`);
  }
  explanation.push("A lower loss rate usually comes at the cost of approval volume — the simulator shows the trade-off; it does not choose the policy.");

  const evidence = [
    `Synthetic pool: ${pool.length} applicants generated deterministically from seed ${inputs.seed}; no real customer data is used.`,
    `Rule failures under the proposed policy: score ${failScore}, DTI ${failDti}, DSCR ${failDscr} (an applicant can fail several rules).`,
    `Expected-loss proxy = synthetic PD × fixed LGD ${LGD * 100}% × exposure. The PD is an illustrative logistic function of score, DTI and DSCR — not a calibrated model.`,
    "Exposure and loss figures are in synthetic currency units (thousands).",
  ];

  const order = (e: (typeof evaluated)[number]) => (e.before !== e.after ? 0 : 1);
  const data = [...evaluated]
    .sort((x, y) => order(x) - order(y) || x.a.id.localeCompare(y.a.id))
    .map((e) => ({
      id: e.a.id,
      score: e.a.score,
      dti: e.a.dti,
      dscr: e.a.dscr,
      amount: e.a.amount,
      pd: round(e.a.pd * 100, 2),
      baseline: e.before ? "Approve" : "Decline",
      proposed: e.after ? "Approve" : "Decline",
      change: e.before === e.after ? "Unchanged" : e.after ? "Newly approved" : "Newly declined",
      reasons: e.reasons.length ? e.reasons.join("; ") : "—",
    }));

  return {
    summary: `The proposed policy approves ${after.count} of ${pool.length} applicants (${fmt(after.approvalRate, 1)}%) versus ${before.count} (${fmt(before.approvalRate, 1)}%) under the baseline; the expected-loss proxy moves from ${fmt(before.expectedLoss, 1)}k to ${fmt(after.expectedLoss, 1)}k.`,
    metrics: [
      { key: "approval_rate", label: "Approval rate", value: after.approvalRate, before: before.approvalRate, beforeLabel: "Baseline", format: "percent" },
      { key: "approved_count", label: "Approved applicants", value: after.count, before: before.count, beforeLabel: "Baseline", format: "integer" },
      { key: "approved_exposure", label: "Approved exposure", value: after.exposure, before: before.exposure, beforeLabel: "Baseline", format: "amount" },
      { key: "expected_loss", label: "Expected-loss proxy", value: after.expectedLoss, before: before.expectedLoss, beforeLabel: "Baseline", format: "amount", better: "lower" },
      { key: "expected_loss_rate", label: "Expected-loss rate", value: after.elRate, before: before.elRate, beforeLabel: "Baseline", format: "percent", better: "lower" },
      { key: "average_pd", label: "Average PD of approved", value: after.avgPd, before: before.avgPd, beforeLabel: "Baseline", format: "percent", better: "lower" },
    ],
    rows: {
      title: "Synthetic applicants (changed decisions first)",
      columns: [
        { key: "id", label: "Applicant" },
        { key: "score", label: "Score", format: "integer" },
        { key: "dti", label: "DTI", format: "percent" },
        { key: "dscr", label: "DSCR", format: "ratio" },
        { key: "amount", label: "Amount", format: "amount" },
        { key: "pd", label: "Synthetic PD", format: "percent" },
        { key: "baseline", label: "Baseline" },
        { key: "proposed", label: "Proposed" },
        { key: "change", label: "Change" },
        { key: "reasons", label: "Proposed-policy failures" },
      ],
      data,
    },
    explanation,
    evidence,
  };
}

export const engine: EngineDefinition<typeof inputSchema> = {
  key: "credit-strategy-simulator",
  name: "Credit policy simulation",
  inputSchema,
  fields,
  run,
};
