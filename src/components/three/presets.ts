/**
 * Scene configuration shared by the server (poster choice) and the WebGL canvas. Plain data
 * and pure functions only — no `three` import — so it is safe anywhere and unit-testable.
 *
 * The scene tells the collective-learning story:
 *   institutions (green, each inside its own boundary) → review membrane (observations are
 *   coarsened as they cross and turn mint) → shared learning surface → pulses back to everyone.
 */

export type ScenePreset = "home" | "surface" | "membrane" | "institutions" | "lab";
export type Tier = "high" | "mid" | "low";

export const POSTERS: Record<ScenePreset, string> = {
  home: "/art/hero-network.svg",
  surface: "/art/hero-network.svg",
  membrane: "/art/layers.svg",
  institutions: "/art/layers.svg",
  lab: "/art/lab-orbit.svg",
};

/** Industries map onto the five institution clusters (left → right). */
export const INDUSTRY_CLUSTER: Record<string, number> = {
  banking: 0,
  insurance: 1,
  "capital-markets": 2,
  "risk-compliance": 3,
  erp: 4,
};

export const PARTICLES: Record<"narrative" | "backdrop", Record<Tier, number>> = {
  narrative: { high: 10_000, mid: 6_000, low: 2_500 },
  backdrop: { high: 4_000, mid: 3_000, low: 2_000 },
};

export const DPR_MAX: Record<Tier, number> = { high: 1.75, mid: 1.5, low: 1.25 };

/** Fixed story position (0 = contribute, 0.5 = review, 1 = shared) for presets not driven by scroll. */
export const FIXED_PROGRESS: Record<ScenePreset, number> = {
  home: 0,
  surface: 1,
  membrane: 0.46,
  institutions: 0.04,
  lab: 1,
};

/** Still frame used under prefers-reduced-motion: every stage visible at once. */
export const STILL_PROGRESS = 0.72;

export type SurfaceKind = "seasonal" | "terraced" | "sigmoid" | "peaks" | "band";
export interface SurfaceShape {
  kind: SurfaceKind;
  cycles: number;
  amplitude: number;
  phase: number;
  steps: number;
  peaks: { u: number; v: number; r: number }[];
}

/** Shapes that echo what each AI offering does; other slugs get a seeded seasonal surface. */
const NAMED_SHAPES: Record<string, Partial<SurfaceShape>> = {
  // Seasonal SME cash flow (the Build Labs scenario): two seasons a year.
  "financial-analysis-intelligence": { kind: "seasonal", cycles: 2, amplitude: 0.75, phase: 0.2 },
  // Strategy cut-offs read as terraces.
  "credit-strategy-simulator": { kind: "terraced", cycles: 1.3, amplitude: 0.8, steps: 5 },
  // An approve / refer boundary.
  "sme-credit-decisioning": { kind: "sigmoid", amplitude: 0.7 },
  // Portfolios that resemble each other form neighbouring peaks.
  "similar-portfolio-intelligence": { kind: "peaks", amplitude: 0.85 },
  // A validation threshold band.
  riva: { kind: "band", amplitude: 0.6 },
};

/** FNV-1a 32-bit hash. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function surfaceShape(seed: string): SurfaceShape {
  const rand = mulberry32(hashSeed(seed));
  const base: SurfaceShape = {
    kind: "seasonal",
    cycles: 1.5 + rand() * 2,
    amplitude: 0.4 + rand() * 0.4,
    phase: rand(),
    steps: 4,
    peaks: Array.from({ length: 4 }, () => ({ u: 0.15 + rand() * 0.7, v: 0.2 + rand() * 0.6, r: 0.08 + rand() * 0.08 })),
  };
  return { ...base, ...NAMED_SHAPES[seed] };
}

/** Height of the shared surface at (u, v) ∈ [0,1]²; used for the wire mesh and particle landing points. */
export function surfaceHeight(shape: SurfaceShape, u: number, v: number): number {
  const envelope = Math.sin(Math.PI * v) * (0.55 + 0.45 * Math.sin(Math.PI * u));
  const wave = Math.sin(2 * Math.PI * (u * shape.cycles + shape.phase));
  let h: number;
  switch (shape.kind) {
    case "terraced": {
      const raw = (wave * 0.5 + 0.5) * envelope;
      h = Math.round(raw * shape.steps) / shape.steps;
      break;
    }
    case "sigmoid":
      h = (1 / (1 + Math.exp(-(u - 0.5) * 14)) - 0.5) * 1.6 * envelope + 0.08 * wave * envelope;
      break;
    case "peaks":
      h = shape.peaks.reduce((acc, p) => acc + Math.exp(-((u - p.u) ** 2 + (v - p.v) ** 2) / (2 * p.r * p.r)), 0) * 0.9;
      break;
    case "band":
      h = Math.exp(-(((u - 0.62) / 0.05) ** 2)) * envelope + 0.12 * wave * envelope;
      break;
    default:
      h = wave * envelope;
  }
  return h * shape.amplitude;
}

/** Device tier from coarse capability signals (pure, so it can be unit-tested). */
export function chooseTier(caps: { cores: number; memoryGb: number; wide: boolean }): Tier {
  if (caps.cores <= 4 || !caps.wide) return "low";
  if (caps.cores >= 8 && caps.memoryGb >= 8) return "high";
  return "mid";
}
