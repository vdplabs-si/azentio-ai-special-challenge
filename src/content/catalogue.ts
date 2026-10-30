/**
 * Offering catalogue (reference data). Synced idempotently into the Offering table by
 * `npm run db:sync-catalogue` so entitlements, observations and ideas can reference it.
 *
 * Sources:
 *  - azentio.ai AI offerings: the official reference prototype (azentio-ai-ipad.ssaha999.chatgpt.site),
 *    plus "Financial Analysis Intelligence" named in the Build Labs problem statement.
 *  - Enterprise product lines: navigation and copy published on https://www.azentio.com/ (Oct 2026).
 * Product details are indicative and subject to validation, as stated on the prototype.
 */

export type IndustrySlug = "banking" | "capital-markets" | "risk-compliance" | "insurance" | "erp" | "cross-industry";

export interface OfferingDef {
  slug: string;
  name: string;
  category: string;
  industry: IndustrySlug;
  summary: string;
  description: string;
  capabilities: string[];
  sandbox: boolean; // has a guided Playground scenario
  sourceUrl: string;
}

const PROTOTYPE = "https://azentio-ai-ipad.ssaha999.chatgpt.site/products/";
const AZ = "https://www.azentio.com";

export const AI_OFFERINGS: OfferingDef[] = [
  {
    slug: "credit-strategy-simulator",
    name: "Credit Strategy Simulator",
    category: "Credit policy intelligence",
    industry: "banking",
    summary: "Simulate credit policy changes before deployment.",
    description:
      "Preview how a proposed credit policy change could affect approvals, risk exposure and portfolio outcomes before it reaches production.",
    capabilities: ["Policy rule simulation", "Approval-rate impact", "Risk exposure preview", "Side-by-side scenario comparison"],
    sandbox: true,
    sourceUrl: `${PROTOTYPE}credit-strategy-simulator/`,
  },
  {
    slug: "sme-credit-decisioning",
    name: "SME Credit Decisioning Workbench",
    category: "Explainable credit intelligence",
    industry: "banking",
    summary: "Financial analysis, policy evaluation, risk review and recommendations in one workbench.",
    description:
      "Unites financial analysis, policy evaluation, risk review and credit recommendations in a single workbench, with evidence and human review at every step.",
    capabilities: ["Financial ratio analysis", "Policy evaluation", "Evidence-backed recommendation", "Human review and approval"],
    sandbox: true,
    sourceUrl: `${PROTOTYPE}sme-credit-decisioning/`,
  },
  {
    slug: "similar-portfolio-intelligence",
    name: "Similar Portfolio Intelligence",
    category: "Contextual portfolio insights",
    industry: "banking",
    summary: "Benchmark applications against relevant historical portfolio segments.",
    description:
      "Compares an application with relevant historical portfolio segments to surface patterns, risk signals and comparable outcomes.",
    capabilities: ["Peer-segment matching", "Risk signal surfacing", "Comparable outcome review", "Portfolio context"],
    sandbox: true,
    sourceUrl: `${PROTOTYPE}similar-portfolio-intelligence/`,
  },
  {
    slug: "riva",
    name: "RIVA",
    category: "Reporting intelligence, validation & analytics",
    industry: "cross-industry",
    summary: "A configurable reporting environment connecting data sources.",
    description:
      "A configurable reporting environment that connects data sources, with field mapping, validation and simpler reporting workflows.",
    capabilities: ["Source-to-report field mapping", "Validation rules", "Exception review", "Reporting workflow"],
    sandbox: true,
    sourceUrl: `${PROTOTYPE}riva/`,
  },
  {
    slug: "financial-analysis-intelligence",
    name: "Financial Analysis Intelligence",
    category: "Explainable financial analysis",
    industry: "banking",
    summary: "Explainable analysis of borrower financial statements.",
    description:
      "Analyses borrower financial statements and explains period-over-period comparisons, so credit teams can see why a metric moved — including seasonal effects.",
    capabilities: ["Statement spreading", "Period comparison", "Seasonality-aware explanation", "Analyst review"],
    sandbox: true,
    sourceUrl: "https://www.azentio.com/",
  },
];

export const PRODUCT_LINES: OfferingDef[] = [
  // Banking
  { slug: "imal-islamic-banking", name: "iMAL Islamic Banking", category: "Core banking", industry: "banking", summary: "Islamic core banking system.", description: "Azentio iMAL supports Islamic financial institutions modernising their core technology, expanding product capabilities and responding to regulatory and customer expectations.", capabilities: ["Shari'ah-compliant core banking", "Product configuration", "Regulatory alignment"], sandbox: false, sourceUrl: `${AZ}/banking/imal-islamic-banking` },
  { slug: "lending", name: "Lending", category: "Lending", industry: "banking", summary: "Digital lending and loan management.", description: "Loan origination and management software for banks and lenders.", capabilities: ["Origination", "Loan servicing", "Credit lending operations"], sandbox: false, sourceUrl: `${AZ}/banking/lending` },
  { slug: "digital-banking", name: "Digital", category: "Digital banking", industry: "banking", summary: "Digital banking channels.", description: "Digital banking solutions from Azentio's banking portfolio.", capabilities: ["Digital channels", "Customer self-service"], sandbox: false, sourceUrl: `${AZ}/banking/digital` },
  { slug: "factoring-supply-chain-finance", name: "Factoring & Supply Chain Finance", category: "Trade & SCF", industry: "banking", summary: "Factoring and supply chain finance.", description: "Factoring and supply chain finance solutions from Azentio's banking portfolio.", capabilities: ["Factoring", "Supply chain finance"], sandbox: false, sourceUrl: `${AZ}/banking/factoring-supply-chain-finance` },
  // Capital markets
  { slug: "mfund-plus", name: "Azentio MFund Plus", category: "Fund management", industry: "capital-markets", summary: "Capital markets fund management platform.", description: "Part of Azentio's capital markets portfolio.", capabilities: ["Fund administration"], sandbox: false, sourceUrl: `${AZ}/capital-markets/azentio-mfund-plus` },
  { slug: "mfund-iss", name: "Azentio MFund ISS", category: "Investor servicing", industry: "capital-markets", summary: "Capital markets investor servicing.", description: "Part of Azentio's capital markets portfolio.", capabilities: ["Investor servicing"], sandbox: false, sourceUrl: `${AZ}/capital-markets/azentio-mfund-iss` },
  { slug: "mfund-plus-wms", name: "Azentio MFund Plus WMS", category: "Wealth management", industry: "capital-markets", summary: "Wealth management system.", description: "Wealth management from Azentio's capital markets portfolio.", capabilities: ["Wealth advisory", "Portfolio management"], sandbox: false, sourceUrl: `${AZ}/capital-markets/azentio-mfund-plus-wms-wealth-mgmt` },
  // Risk & compliance (AMLOCK)
  { slug: "amlock-transaction-monitoring", name: "AMLOCK Transaction Monitoring", category: "Financial crime compliance", industry: "risk-compliance", summary: "AML transaction monitoring.", description: "Transaction monitoring within AMLOCK, Azentio's financial crime compliance platform.", capabilities: ["Transaction monitoring", "Alert investigation"], sandbox: false, sourceUrl: `${AZ}/risk-compliance/transaction-monitoring` },
  { slug: "amlock-sanctions-screening", name: "AMLOCK Sanctions Screening", category: "Financial crime compliance", industry: "risk-compliance", summary: "Name and transaction screening.", description: "Evaluate individuals and entities against major international sanctions lists such as OFAC, EU and UN.", capabilities: ["Name screening", "Transaction screening", "Adverse media monitoring"], sandbox: false, sourceUrl: `${AZ}/risk-compliance/sanctions-screening` },
  { slug: "kyc-onboarding", name: "KYC & Onboarding", category: "Financial crime compliance", industry: "risk-compliance", summary: "Customer due diligence and onboarding.", description: "KYC and onboarding from Azentio's risk & compliance portfolio.", capabilities: ["KYC", "Customer onboarding"], sandbox: false, sourceUrl: `${AZ}/risk-compliance/kyc-onboarding` },
  { slug: "regulatory-reporting", name: "Regulatory Reporting", category: "Regulatory compliance", industry: "risk-compliance", summary: "Regulatory reporting.", description: "Regulatory reporting from Azentio's risk & compliance portfolio.", capabilities: ["Regulatory returns"], sandbox: false, sourceUrl: `${AZ}/risk-compliance/regulatory-reporting` },
  { slug: "trade-based-aml", name: "Trade-Based Anti-Money Laundering", category: "Financial crime compliance", industry: "risk-compliance", summary: "Trade-based AML.", description: "Trade-based anti-money laundering from Azentio's risk & compliance portfolio.", capabilities: ["Trade-based AML"], sandbox: false, sourceUrl: `${AZ}/risk-compliance/trade-based-anti-money-laundering` },
  // Insurance
  { slug: "insurance-general", name: "General Insurance", category: "Insurance core", industry: "insurance", summary: "General insurance platform.", description: "General insurance from Azentio's insurance portfolio.", capabilities: ["Policy administration", "Claims"], sandbox: false, sourceUrl: `${AZ}/insurance/general` },
  { slug: "insurance-health", name: "Health Insurance", category: "Insurance core", industry: "insurance", summary: "Health insurance platform.", description: "Health insurance from Azentio's insurance portfolio.", capabilities: ["Health policy administration"], sandbox: false, sourceUrl: `${AZ}/insurance/health` },
  { slug: "claim-automation", name: "Claim Automation", category: "Claims", industry: "insurance", summary: "Insurance claim automation.", description: "Claim automation from Azentio's insurance portfolio.", capabilities: ["Claims processing automation"], sandbox: false, sourceUrl: `${AZ}/insurance/claim-automation` },
  // ERP
  { slug: "orion-distribution-cloud", name: "Orion Distribution Cloud", category: "Industry cloud ERP", industry: "erp", summary: "ERP for distribution businesses.", description: "Azentio ERP industry cloud for distribution.", capabilities: ["Inventory", "Procurement", "Financials"], sandbox: false, sourceUrl: `${AZ}/erp/orion-distribution-cloud` },
  { slug: "orion-contracting-cloud", name: "Orion Contracting Cloud", category: "Industry cloud ERP", industry: "erp", summary: "ERP for contracting businesses.", description: "Azentio ERP industry cloud for contracting.", capabilities: ["Project costing", "Financials"], sandbox: false, sourceUrl: `${AZ}/erp/orion-contracting-cloud` },
  { slug: "orion-manufacturing-cloud", name: "Orion Manufacturing Cloud", category: "Industry cloud ERP", industry: "erp", summary: "ERP for manufacturing businesses.", description: "Azentio ERP industry cloud for manufacturing.", capabilities: ["Production", "Procurement", "Financials"], sandbox: false, sourceUrl: `${AZ}/erp/orion-manufacturing-cloud` },
];

export const OFFERINGS: OfferingDef[] = [...AI_OFFERINGS, ...PRODUCT_LINES];

export const INDUSTRIES: { slug: IndustrySlug; name: string; tagline: string; sourceUrl: string }[] = [
  { slug: "banking", name: "Banking", tagline: "Enables financial institutions to continually redefine themselves.", sourceUrl: `${AZ}/banking` },
  { slug: "capital-markets", name: "Capital markets", tagline: "Helping capital market firms embrace technologies.", sourceUrl: `${AZ}/capital-markets` },
  { slug: "risk-compliance", name: "Risk & compliance", tagline: "Ensuring compliance and mitigating risks seamlessly worldwide.", sourceUrl: `${AZ}/risk-compliance` },
  { slug: "insurance", name: "Insurance", tagline: "Allowing insurance companies to significantly reduce costs.", sourceUrl: `${AZ}/insurance` },
  { slug: "erp", name: "Azentio ERP", tagline: "Providing exceptional industry cloud solutions.", sourceUrl: `${AZ}/erp` },
];

export const REGIONS = ["Middle East", "Africa", "South Asia", "South East Asia", "Europe", "Other"] as const;
