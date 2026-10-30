/**
 * Keyword similarity used for duplicate hints (moderation) and suggested theme groupings.
 * Deliberately simple and explainable: token Jaccard over title + body (+ topics).
 * Results are hints that a human must verify — never evidence of prevalence or causation.
 * Pure module — unit-tested.
 */

const STOPWORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does for from had has have how in into is it its " +
    "may might more most not of on or our over so such than that the their them then there these they this those " +
    "to too under up very was we were what when where which while who why will with would you your also about " +
    "across after again all any because before between both each few further here just only other out own same " +
    "some through until via within without using use used per new many much"
  ).split(/\s+/),
);

/** Lowercase word tokens (≥3 chars, no stopwords, digits-only tokens dropped). */
export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().normalize("NFKD").split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw);
  }
  return out;
}

/** |A ∩ B| / |A ∪ B| — 0 when both are empty. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimilarityCandidate {
  id: string;
  title: string;
  body: string;
  topics?: readonly string[];
}

export interface SimilarityHit {
  id: string;
  title: string;
  score: number;
}

const features = (c: { title: string; body: string; topics?: readonly string[] }) => {
  const s = tokenize(`${c.title} ${c.body}`);
  for (const t of c.topics ?? []) s.add(`#${t.toLowerCase()}`);
  return s;
};

/** Top-k most similar candidates by token Jaccard (score rounded to 2 dp). */
export function topSimilar(
  target: { title: string; body: string; topics?: readonly string[] },
  candidates: readonly SimilarityCandidate[],
  k = 3,
  minScore = 0.05,
): SimilarityHit[] {
  const t = features(target);
  return candidates
    .map((c) => ({ id: c.id, title: c.title, score: jaccard(t, features(c)) }))
    .filter((h) => h.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k)
    .map((h) => ({ ...h, score: Math.round(h.score * 100) / 100 }));
}

export interface GroupingItem {
  id: string;
  title: string;
  body?: string;
  topics: readonly string[];
}

export interface SuggestedGrouping {
  /** Human label derived from shared topics/keywords — a suggestion, not a finding. */
  label: string;
  sharedTopics: string[];
  memberIds: string[];
  /** Mean pairwise similarity inside the group (0–1). */
  cohesion: number;
}

/**
 * Single-link clustering of shared copies by topic + title keyword overlap.
 * Topic tags are weighted by repeating them, so items that share tags group first.
 */
export function suggestGroupings(
  items: readonly GroupingItem[],
  { threshold = 0.2, minSize = 2, maxGroups = 12 }: { threshold?: number; minSize?: number; maxGroups?: number } = {},
): SuggestedGrouping[] {
  const feats = items.map((i) => {
    const s = tokenize(i.title);
    for (const t of i.topics) {
      s.add(`#${t.toLowerCase()}`);
      s.add(`##${t.toLowerCase()}`);
    }
    return s;
  });
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const sim: number[][] = items.map(() => []);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const s = jaccard(feats[i]!, feats[j]!);
      sim[i]![j] = s;
      if (s >= threshold) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });

  const out: SuggestedGrouping[] = [];
  for (const idxs of groups.values()) {
    if (idxs.length < minSize) continue;
    const topicFreq = new Map<string, number>();
    for (const i of idxs) for (const t of new Set(items[i]!.topics.map((x) => x.toLowerCase()))) topicFreq.set(t, (topicFreq.get(t) ?? 0) + 1);
    const sharedTopics = [...topicFreq.entries()]
      .filter(([, n]) => n >= Math.max(2, Math.ceil(idxs.length / 2)))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t)
      .slice(0, 5);
    let pairs = 0;
    let total = 0;
    for (let a = 0; a < idxs.length; a++)
      for (let b = a + 1; b < idxs.length; b++) {
        const [x, y] = idxs[a]! < idxs[b]! ? [idxs[a]!, idxs[b]!] : [idxs[b]!, idxs[a]!];
        total += sim[x]![y] ?? 0;
        pairs++;
      }
    const label = sharedTopics.length
      ? sharedTopics.slice(0, 3).join(" · ")
      : commonKeywords(idxs.map((i) => items[i]!.title)).slice(0, 3).join(" · ") || "Related contributions";
    out.push({
      label,
      sharedTopics,
      memberIds: idxs.map((i) => items[i]!.id),
      cohesion: pairs ? Math.round((total / pairs) * 100) / 100 : 0,
    });
  }
  return out.sort((a, b) => b.memberIds.length - a.memberIds.length || b.cohesion - a.cohesion).slice(0, maxGroups);
}

function commonKeywords(texts: string[]): string[] {
  const freq = new Map<string, number>();
  for (const t of texts) for (const tok of tokenize(t)) freq.set(tok, (freq.get(tok) ?? 0) + 1);
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}
