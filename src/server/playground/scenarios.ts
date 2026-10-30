/**
 * Playground scenario catalogue (reference data). Seeded into the PlaygroundScenario table
 * by the integrator's seed script, which runs under plain Node/tsx — so this file must stay
 * dependency-free: no "server-only", db, env or "@/" alias imports (type-only imports are erased).
 *
 * Every scenario uses SYNTHETIC inputs only. `inputs` must validate against the engine's
 * zod schema (enforced by tests/unit/playground/scenarios.test.ts).
 */
import type { EngineKey } from "./engines/keys";

export type ScenarioAudienceKey = "EMPLOYEE" | "CLIENT_ENTITLED";

export interface PlaygroundScenarioDef {
  slug: string;
  offeringSlug: string;
  name: string;
  description: string;
  engine: EngineKey;
  inputs: Record<string, number | string>;
  audience: ScenarioAudienceKey;
}

export const PLAYGROUND_SCENARIOS: PlaygroundScenarioDef[] = [
  {
    slug: "credit-policy-tightening",
    offeringSlug: "credit-strategy-simulator",
    name: "Tighten an SME credit policy",
    description:
      "Preview how raising the minimum score, lowering the DTI ceiling and raising the DSCR floor would change approvals, approved exposure and the expected-loss proxy on a synthetic applicant pool — before the change reaches production.",
    engine: "credit-strategy-simulator",
    audience: "CLIENT_ENTITLED",
    inputs: { seed: 42, poolSize: 40, baselineMinScore: 600, baselineMaxDti: 45, baselineMinDscr: 1.2, minScore: 640, maxDti: 40, minDscr: 1.3 },
  },
  {
    slug: "credit-approval-expansion-prototype",
    offeringSlug: "credit-strategy-simulator",
    name: "Internal prototype · approval expansion stress test",
    description:
      "Employee-only prototype: relax every threshold to explore how much approval volume a growth strategy buys and what it costs in expected loss on a larger synthetic pool. Used internally to calibrate demonstration narratives.",
    engine: "credit-strategy-simulator",
    audience: "EMPLOYEE",
    inputs: { seed: 314, poolSize: 80, baselineMinScore: 640, baselineMaxDti: 40, baselineMinDscr: 1.3, minScore: 600, maxDti: 50, minDscr: 1.1 },
  },
  {
    slug: "sme-working-capital-review",
    offeringSlug: "sme-credit-decisioning",
    name: "Review a working-capital facility request",
    description:
      "A synthetic trading SME requests a five-year facility. See the DSCR, current ratio and leverage computed from its financials, each policy check with the evidence behind it, and an indicative outcome that always requires human review.",
    engine: "sme-credit-decisioning",
    audience: "CLIENT_ENTITLED",
    inputs: {
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
    },
  },
  {
    slug: "sme-sector-stress-prototype",
    offeringSlug: "sme-credit-decisioning",
    name: "Internal prototype · agribusiness stress case",
    description:
      "Employee-only prototype exploring how a sector revenue stress interacts with tight liquidity for a synthetic agribusiness borrower — a deliberately borderline case for training reviewers.",
    engine: "sme-credit-decisioning",
    audience: "EMPLOYEE",
    inputs: {
      sector: "agribusiness",
      annualRevenue: 6500,
      ebitdaMarginPct: 14,
      existingDebt: 1800,
      existingDebtService: 380,
      requestedAmount: 900,
      tenorYears: 4,
      interestRatePct: 10.5,
      currentAssets: 1900,
      currentLiabilities: 1700,
      policyMinDscr: 1.25,
      policyMinCurrentRatio: 1.15,
      policyMaxLeverage: 3.5,
    },
  },
  {
    slug: "similar-portfolio-benchmark",
    offeringSlug: "similar-portfolio-intelligence",
    name: "Benchmark an application against comparable segments",
    description:
      "Find the five synthetic historical portfolio segments most similar to a mid-sized trading SME application and review their default and arrears outcomes against the portfolio — as context for a reviewer, not a prediction.",
    engine: "similar-portfolio-intelligence",
    audience: "CLIENT_ENTITLED",
    inputs: { seed: 7, industry: "trading", annualRevenue: 8500, yearsInBusiness: 9, leverage: 2.8, dscr: 1.45, collateralCoveragePct: 80, industryWeight: 1 },
  },
  {
    slug: "riva-loan-book-validation",
    offeringSlug: "riva",
    name: "Validate a quarterly loan-book report",
    description:
      "Map a synthetic loan-book extract to regulatory categories and run validation rules — product mapping, currency, balances, provisions, staging and control-total reconciliation — to produce an exceptions list for review before submission.",
    engine: "riva",
    audience: "CLIENT_ENTITLED",
    inputs: { seed: 2026, rowCount: 40, errorRatePct: 12, stage2DpdThreshold: 30, stage3DpdThreshold: 90, reconciliationTolerance: 50 },
  },
  {
    slug: "seasonality-context-cash-flow",
    offeringSlug: "financial-analysis-intelligence",
    name: "Seasonality context: is the latest quarter really a decline?",
    description:
      "A synthetic SME's revenue peaks in August. Compare the latest quarter with the previous one naively and after seasonal adjustment, and see why a naive period comparison can point the wrong way.",
    engine: "financial-analysis-intelligence",
    audience: "CLIENT_ENTITLED",
    inputs: {
      seed: 11,
      baseMonthlyRevenue: 480,
      underlyingGrowthPct: 12,
      seasonalAmplitudePct: 35,
      peakMonth: "aug",
      contributionMarginPct: 38,
      fixedMonthlyCosts: 120,
      noisePct: 2,
      comparison: "quarter",
    },
  },
];
