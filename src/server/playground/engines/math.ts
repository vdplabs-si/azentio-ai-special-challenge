/** Deterministic numeric helpers for synthetic data generation. */

/** mulberry32 — small, fast, seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round = (x: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
};

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Bell-ish value in [0, 1) (mean of n uniforms). */
export function bell(rng: () => number, n = 3) {
  let s = 0;
  for (let i = 0; i < n; i++) s += rng();
  return s / n;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Percentage change, or null when the base is too close to zero to be meaningful. */
export function pctChange(from: number, to: number) {
  if (Math.abs(from) < 1e-6) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
/** Fixed-locale number formatting for explanation strings (stable across environments). */
export const fmt = (x: number, dp = 2) => nf.format(round(x, dp));
export const pad = (n: number, w = 3) => String(n).padStart(w, "0");
