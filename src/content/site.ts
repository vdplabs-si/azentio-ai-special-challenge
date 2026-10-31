/**
 * Verified copy for the public azentio.ai website.
 *
 * Sources:
 *  - Reference prototype: https://azentio-ai-ipad.ssaha999.chatgpt.site/ (headlines, section copy, routes).
 *  - Azentio corporate site: https://www.azentio.com/ (company description, regions, 2026 recognitions,
 *    careers, academy and social links) — checked October 2026.
 * Do not add statistics, customer names, testimonials, certifications or awards that are not listed here.
 */

export const SITE_NAME = "azentio.ai";
export const DISCLAIMER = "Product details are indicative and subject to validation.";

export const AZENTIO = {
  home: "https://www.azentio.com/",
  about: "https://www.azentio.com/about-azentio",
  leadership: "https://www.azentio.com/our-leadership",
  presence: "https://www.azentio.com/our-presence",
  careers: "https://www.azentio.com/careers",
  academy: "https://www.azentio.com/our-academy",
  talentCommunity: "https://www.azentio.com/join-our-talent-community",
  contact: "https://www.azentio.com/contact-us",
  insights: "https://www.azentio.com/insights",
  awards: "https://www.azentio.com/insights/awards-and-analyst-reports",
} as const;

export const SOCIAL = [
  { label: "X (Twitter)", handle: "@AzentioSoftware", href: "https://twitter.com/AzentioSoftware" },
  { label: "YouTube", handle: "@azentiosoftware", href: "https://www.youtube.com/@azentiosoftware" },
  { label: "LinkedIn", handle: "azentio-software", href: "https://sg.linkedin.com/company/azentio-software" },
] as const;

export const YOUTUBE_CHANNEL = "https://www.youtube.com/@azentiosoftware";

/** Verbatim from https://www.azentio.com/ */
export const COMPANY_DESCRIPTION =
  "At Azentio, we deliver purpose-built, intelligence-driven technology designed to transform Banking, Insurance, Capital Markets and ERP. By combining cutting-edge innovation with deep domain expertise, we empower businesses to accelerate growth, enhance operational efficiency, and stay ahead.";

/** Verbatim from https://www.azentio.com/ */
export const REGIONS_LINE = "Proven impact across the Middle East, Africa, and South East Asia";
export const REGIONS_SERVED = ["Middle East", "Africa", "South East Asia"] as const;

/** Verbatim from https://www.azentio.com/careers */
export const CAREERS_INTRO =
  "At Azentio, we're on a mission to drive innovation and make a meaningful impact in the world of FinTech and InsurTech.";

// ───────────────────────────── Navigation ─────────────────────────────

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}
export interface NavGroup {
  label: string;
  items: NavLink[];
}
export type NavEntry = NavLink | NavGroup;

export const isNavGroup = (e: NavEntry): e is NavGroup => "items" in e;

export const MAIN_NAV: NavEntry[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  {
    label: "Innovation",
    items: [
      { label: "AI Lab", href: "/lab", description: "Experiments, prototypes and the Playground." },
      { label: "Technology", href: "/technology", description: "Architecture, security and governance." },
      { label: "Hackathons", href: "/hackathon/register", description: "Register interest in an open hackathon." },
    ],
  },
  {
    label: "Explore",
    items: [
      { label: "Solutions", href: "/solutions", description: "Banking, insurance, capital markets, risk and ERP." },
      { label: "Media & Videos", href: "/media", description: "Product showcases and recorded sessions." },
      { label: "Insights", href: "/insights", description: "Perspectives and 2026 recognitions." },
      { label: "azentio.ai Live", href: "/live", description: "Public live sessions and recordings." },
    ],
  },
  { label: "About", href: "/about" },
];

export const FOOTER_COLUMNS: { title: string; links: (NavLink & { external?: boolean })[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Products", href: "/products" },
      { label: "Solutions", href: "/solutions" },
      { label: "AI Lab", href: "/lab" },
      { label: "Technology", href: "/technology" },
      { label: "Hackathons", href: "/hackathon/register" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Media & Videos", href: "/media" },
      { label: "Live", href: "/live" },
      { label: "Insights", href: "/insights" },
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Request a demo", href: "/connect" },
      { label: "Sign in", href: "/login" },
      { label: "Portal", href: "/portal" },
      { label: "azentio.com", href: AZENTIO.home, external: true },
      { label: "Contact Azentio", href: AZENTIO.contact, external: true },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
];

// ───────────────────────────── Section copy (about, media, live, solutions) ─────────────────────────────

export const WHO_WE_ARE = {
  eyebrow: "Who we are",
  title: "Intelligence, Engineered for the Real World.",
  paragraphs: [
    "AI creates value when it moves beyond experimentation and becomes part of how businesses operate.",
    "We build intelligent applications that bring together domain knowledge, advanced AI, intuitive interfaces and enterprise-grade engineering — so intelligence is embedded in the work itself, not bolted on beside it.",
  ],
  pillars: [
    { title: "Domain knowledge", text: "Grounded in how banks, insurers, capital market firms and enterprises actually operate." },
    { title: "Advanced AI", text: "Models, agents and analytics applied where they measurably help a decision or workflow." },
    { title: "Usable interfaces", text: "Workbenches that show the evidence behind every recommendation." },
    { title: "Enterprise engineering", text: "Security, access control, auditability and integration from day one." },
  ],
};

export type CapabilityIcon = "decisioning" | "documents" | "agents" | "analytics" | "platform" | "trust";

export interface Capability {
  key: CapabilityIcon;
  title: string;
  subtitle: string;
  description: string;
  points: string[];
}

export const CAPABILITIES: Capability[] = [
  {
    key: "decisioning",
    title: "Intelligent Decisioning",
    subtitle: "Policy to recommendation",
    description: "Turn policies, evidence, and data into informed recommendations.",
    points: ["Policy-based evaluation", "Risk, financial and historical analysis", "Policy simulation", "Evidence-backed output"],
  },
  {
    key: "documents",
    title: "Document Intelligence",
    subtitle: "Documents to structured data",
    description: "Extract, interpret, and validate complex information.",
    points: ["Classify and extract", "Cross-document validation", "Inconsistency detection", "Structured output"],
  },
  {
    key: "agents",
    title: "AI Agents & Automation",
    subtitle: "Tasks to connected workflows",
    description: "Connect intelligence with workflows and human oversight.",
    points: ["Task interpretation", "Workflow coordination", "Multi-step automation", "Human approvals and audit trails"],
  },
  {
    key: "analytics",
    title: "Analytics & Insights",
    subtitle: "Data to actionable insight",
    description: "Transform data into actionable intelligence.",
    points: ["Data unification", "Trend and root-cause analysis", "Portfolio comparison", "Scenario simulation"],
  },
  {
    key: "platform",
    title: "Configurable AI Platforms",
    subtitle: "Adapt the platform",
    description: "Adapt solutions to evolving business requirements.",
    points: ["Rule configuration", "Database and API mapping", "Templates and modules", "Versioning and approvals"],
  },
  {
    key: "trust",
    title: "Trusted Enterprise AI",
    subtitle: "Governed enterprise intelligence",
    description: "Design for security, accountability, and traceability.",
    points: ["Enterprise SSO and RBAC", "Data protection", "Audit records", "Human oversight"],
  },
];

export const MEDIA_TEASER = {
  eyebrow: "See intelligence in action",
  title: "Don't Just Imagine What AI Can Do.",
  emphasis: "See It.",
  description: "Explore real product experiences, intelligent workflows, and ideas brought to life through engineering.",
  cta: { label: "Watch product showcases", href: "/media" },
};

export const IDEAS_IN_MOTION = {
  eyebrow: "What's happening",
  title: "Ideas in Motion.",
  cards: [
    { label: "AI Lab", title: "Experiment Boldly. Engineer Purposefully.", href: "/lab", cta: "Visit the AI Lab" },
    { label: "azentio.ai Live", title: "Conversations Where Intelligence Comes Alive.", href: "/live", cta: "See live sessions" },
    { label: "Perspectives", title: "Ideas Worth Exploring. Perspectives Worth Sharing.", href: "/insights", cta: "Read insights" },
  ],
};

export const CLOSING_CTA = {
  eyebrow: "Build what's next",
  title: "The Next Intelligent Idea Starts Here.",
  description: "Explore our products, share a challenge, or collaborate to turn ambitious ideas into working AI solutions.",
  cta: { label: "Start a Conversation", href: "/connect" },
};

// ───────────────────────────── Recognition (verified, azentio.com, 2026) ─────────────────────────────

export interface Recognition {
  title: string;
  detail: string;
  product?: string;
}

export const RECOGNITION_SOURCE = AZENTIO.home;

export const RECOGNITIONS: Recognition[] = [
  {
    title: "Category Leader",
    detail: "Chartis RiskTech AML Transaction Monitoring Solutions 2026",
    product: "AMLOCK",
  },
  {
    title: "Best Islamic Core Banking Software 2026",
    detail: "iMAL, at the Global Islamic Finance Awards (GIFA)",
    product: "iMAL",
  },
  {
    title: "Noteworthy Solution",
    detail: "Celent 2026 P&C Claims Administration Systems reports for APAC and EMEA",
  },
  {
    title: "Category Leader in two Chartis RiskTech 2026 quadrants",
    detail: "Sanctions screening / watchlist and adverse media monitoring",
    product: "AMLOCK",
  },
  {
    title: "Category Leader in four Chartis RiskTech 2026 quadrants",
    detail: "Credit lending operations",
  },
  {
    title: "Leader",
    detail: "QKS SPARK Matrix AML 2026",
  },
];

// ───────────────────────────── Solutions ─────────────────────────────

/** Indicative mapping of azentio.ai capability areas to each industry (framing, not product claims). */
export const INDUSTRY_CAPABILITIES: Record<string, CapabilityIcon[]> = {
  banking: ["decisioning", "documents", "analytics"],
  "capital-markets": ["analytics", "decisioning", "platform"],
  "risk-compliance": ["documents", "analytics", "trust"],
  insurance: ["documents", "agents", "analytics"],
  erp: ["analytics", "agents", "platform"],
};

// ───────────────────────────── AI Lab & Technology ─────────────────────────────

export const LAB = {
  eyebrow: "AI Lab",
  title: "Experiment Boldly. Engineer Purposefully.",
  lead: "Where emerging technologies meet practical challenges. We experiment, prototype, validate and refine ideas before they become products.",
  pillars: [
    { title: "Inside the Lab", text: "Rapid prototyping and real-world experimentation, with every idea tested against a practical problem." },
    { title: "What we're exploring", text: "Agentic AI, small language models, multimodal intelligence, and AI-assisted engineering." },
    { title: "Build stories", text: "From problem statement to experiment to working prototype — and what we learned along the way." },
    { title: "Hackathons & collaboration", text: "Innovation challenges and working sessions where employees, clients and partners build together." },
  ],
};

export const TECHNOLOGY = {
  eyebrow: "Technology & trust",
  title: "Built for Intelligence. Engineered for Trust.",
  lead: "Dependable data, careful orchestration, safe integration, managed execution and open governance — at every layer.",
  pillars: [
    { title: "Enterprise Integration", text: "Connect applications, data, business rules and enterprise services through managed interfaces." },
    { title: "AI Orchestration", text: "Combine models, workflows, agents and rule-based logic with sign-off by people." },
    { title: "Security by Design", text: "Single sign-on, role-based permissions, encryption in transit, audit logs and secure rollout." },
    { title: "Responsible AI", text: "Explainability, oversight, traceability and human control. Security-testing claims need verified evidence." },
  ],
  layers: [
    { title: "Experience", text: "Workbenches, copilots and APIs" },
    { title: "Orchestration & business logic", text: "Workflows, agents, rules and approvals" },
    { title: "Intelligence & data", text: "Model intelligence, enterprise data and system integration" },
    { title: "Trust, security & governance", text: "SSO, RBAC, encryption, audit and monitoring" },
  ],
};

// ───────────────────────────── Homepage (governed-flow narrative) ─────────────────────────────
// Describes what the portal actually enforces (src/server/learning, src/lib/authz); keep in sync.

export const HOME_HERO = {
  title: "Credit and risk AI that improves from what institutions learn together.",
  lead: "Your teams share an observation only when you choose to. We review and de-identify it before any other institution sees it, then turn the patterns into product improvements you can follow.",
} as const;

export const HOME_STEPS = [
  { title: "Contribute", text: "Each institution's observations stay inside its own workspace until a person decides to share one." },
  { title: "Review", text: "A moderator removes identifying detail and coarsens region and period, or returns it with questions." },
  { title: "Share and improve", text: "Approved learning reaches every participating institution and feeds improvement ideas you can follow." },
] as const;

export const GOVERNANCE = {
  title: "Governed by design, not by promise",
  lead: "Every contribution follows the same lifecycle, and every transition is recorded in an audit trail.",
  lifecycle: [
    { state: "Draft", text: "Private to its author. Saving never shares anything." },
    { state: "Submitted", text: "Proposed to the learning community, with consent recorded for this version." },
    { state: "Reviewed", text: "A moderator redacts, coarsens, returns or rejects it, and tells the author why." },
    { state: "Published", text: "A separate de-identified copy is shared. The original stays private." },
  ],
  withdraw: "Authors can withdraw at any time. A withdrawn copy leaves feeds, search and AI answers immediately.",
  consents: [
    "Store and process the observation",
    "Publish a reviewed, de-identified version",
    "Name your organisation on the shared copy",
    "Allow use in future model training",
  ],
  consentNote: "Each consent is recorded separately for each version. Joining a workspace is never consent, and no model is trained on contributions today.",
  cohort: "Theme counts appear only once at least three different institutions have contributed.",
} as const;
