/** Engine keys (stored in PlaygroundScenario.engine). Dependency-free so seed scripts can import it. */
export const ENGINE_KEYS = [
  "credit-strategy-simulator",
  "sme-credit-decisioning",
  "similar-portfolio-intelligence",
  "riva",
  "financial-analysis-intelligence",
] as const;

export type EngineKey = (typeof ENGINE_KEYS)[number];
