/** URL / search-param helpers shared by server pages and client filter controls (pure). */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** First value of a search param. */
export const param = (sp: SearchParamsRecord, key: string) => {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
};

/** Build `path?query` from current params with overrides (`undefined`/"" removes a key). */
export function hrefWith(path: string, current: SearchParamsRecord | URLSearchParams, overrides: Record<string, string | undefined | null>) {
  const next = new URLSearchParams();
  if (current instanceof URLSearchParams) current.forEach((v, k) => next.append(k, v));
  else for (const [k, v] of Object.entries(current)) if (typeof v === "string") next.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Narrow an arbitrary string to one of `values`, else undefined. */
export function oneOf<T extends string>(value: string | undefined, values: readonly T[]): T | undefined {
  return value !== undefined && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}
