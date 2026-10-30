/**
 * Small-cohort suppression (PDF §10): counts of DISTINCT contributing organisations below the
 * configured minimum (LEARNING_MIN_COHORT, default 3) are never displayed, so a small sample
 * can't be used to infer which organisation contributed. Pure module — unit-tested.
 */

export type CohortValue = { suppressed: false; value: number; min: number } | { suppressed: true; value: null; min: number };

/** Return the count only when it meets the minimum; otherwise a suppressed marker (count withheld). */
export function suppressIfBelow(count: number, min: number): CohortValue {
  const m = Math.max(2, Math.floor(min));
  if (!Number.isFinite(count) || count < m) return { suppressed: true, value: null, min: m };
  return { suppressed: false, value: Math.floor(count), min: m };
}

/** Display text, e.g. "4 organisations" or "Fewer than 3 organisations — count suppressed". */
export function cohortLabel(v: CohortValue, noun = "organisations"): string {
  return v.suppressed ? `Fewer than ${v.min} ${noun} — count suppressed` : `${v.value} ${v.value === 1 ? noun.replace(/s$/, "") : noun}`;
}

/** Count distinct, non-empty keys (e.g. organisation IDs). Repeated posts by one org count once. */
export function distinctCount(keys: Iterable<string | null | undefined>): number {
  const s = new Set<string>();
  for (const k of keys) if (k) s.add(k);
  return s.size;
}

export interface FacetBucket {
  value: string;
  label: string;
  /** Contribution count; null when the bucket's distinct organisations are below the minimum. */
  count: number | null;
  suppressed: boolean;
}

/**
 * Build facet buckets from rows carrying a bucket key and the (server-side only) contributing
 * organisation. Organisation identifiers never leave this function.
 */
export function buildFacet(
  rows: readonly { keys: readonly string[]; org: string }[],
  min: number,
  label: (value: string) => string = (v) => v,
): FacetBucket[] {
  const byKey = new Map<string, { n: number; orgs: Set<string> }>();
  for (const r of rows) {
    for (const k of new Set(r.keys)) {
      if (!k) continue;
      const b = byKey.get(k) ?? { n: 0, orgs: new Set<string>() };
      b.n++;
      b.orgs.add(r.org);
      byKey.set(k, b);
    }
  }
  const buckets: FacetBucket[] = [...byKey.entries()].map(([value, b]) => {
    const c = suppressIfBelow(b.orgs.size, min);
    return { value, label: label(value), count: c.suppressed ? null : b.n, suppressed: c.suppressed };
  });
  // Shown counts first (largest first); suppressed buckets alphabetically so order leaks nothing.
  return buckets.sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    if (!a.suppressed && !b.suppressed && a.count !== b.count) return (b.count ?? 0) - (a.count ?? 0);
    return a.label.localeCompare(b.label);
  });
}
