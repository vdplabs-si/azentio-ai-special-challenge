import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthedActor } from "@/lib/authz/actor";
import { db } from "@/lib/db";
import { airaConfigured, env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { log } from "@/lib/log";
import { AppError, forbidden } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rate-limit";
import { assert, can } from "@/lib/authz/permissions";
import { contentAudienceWhere, sharedFeedWhere } from "@/lib/authz/visibility";

/**
 * AIRA — AI-assisted synthesis over APPROVED, de-identified shared contributions and
 * audience-permitted content, via OpenRouter (plain fetch, no vendor SDK).
 *
 * Privacy contract: the provider payload is built ONLY from records returned by
 * `sharedFeedWhere(actor)` (published shared copies) and `contentAudienceWhere(actor)`,
 * with explicit field allow-lists. No private observations, record IDs, tenant IDs,
 * author/attribution data or employee-only content (for non-employees) ever leaves.
 * Retrieval runs live on every question, so withdrawn/suspended contributions are excluded
 * immediately.
 */

export const NOT_CONFIGURED_MESSAGE = "AIRA is not configured on this deployment (OPENROUTER_API_KEY).";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_SHARED = 8;
const MAX_CONTENT = 4;
const SHARED_BODY_CHARS = 1500;
const CONTENT_BODY_CHARS = 1200;

export const airaQuestionSchema = z.object({
  question: z.string().trim().min(5, "Ask a question of at least 5 characters.").max(1000, "Keep questions under 1,000 characters."),
});

export interface AiraCitation {
  ref: string;
  id: string;
  title: string;
  kind: "shared_observation" | "content";
  href: string;
}

export interface AiraAnswer {
  answer: string;
  citations: AiraCitation[];
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
  retrieval: { shared: number; content: number; keywordMatched: boolean; terms: string[] };
}

export function airaStatus(actor: AuthedActor) {
  assert(can.useAira(actor), "AIRA is available to authorised learning participants only.");
  const configured = airaConfigured();
  return { configured, model: configured ? env().OPENROUTER_MODEL : null, message: configured ? null : NOT_CONFIGURED_MESSAGE };
}

// ── Retrieval ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does doing for from had has have how i if in into is it its " +
    "me my of on or our out over per so such than that the their them then there these they this those to too under up " +
    "us very was we were what when where which while who whom why will with would you your about across after again " +
    "against all also any because before between both each few more most other same should some only own just any " +
    "tell show give explain describe summarise summarize please list there's what's whats help know"
  ).split(/\s+/),
);

/** Lower-cased distinct keywords (≥3 chars, no stopwords), at most 8. Exported for tests/UI. */
export function questionTerms(question: string) {
  const terms: string[] = [];
  for (const raw of question.toLowerCase().split(/[^\p{L}\p{N}-]+/u)) {
    const t = raw.replace(/^-+|-+$/g, "");
    if (t.length < 3 || STOPWORDS.has(t) || terms.includes(t)) continue;
    terms.push(t);
    if (terms.length >= 8) break;
  }
  return terms;
}

const sharedSelect = {
  id: true,
  title: true,
  body: true,
  type: true,
  industry: true,
  region: true,
  periodLabel: true,
  confidence: true,
  evidenceType: true,
  topics: true,
  offering: { select: { name: true } },
} satisfies Prisma.SharedObservationSelect;

const contentSelect = { id: true, slug: true, title: true, summary: true, body: true, type: true } satisfies Prisma.ContentItemSelect;

async function retrieve(actor: AuthedActor, terms: string[]) {
  const ci = (t: string) => ({ contains: t, mode: "insensitive" as const });
  const sharedMatch: Prisma.SharedObservationWhereInput = terms.length
    ? { OR: terms.flatMap((t) => [{ title: ci(t) }, { body: ci(t) }, { industry: ci(t) }, { topics: { has: t } }]) }
    : { id: { in: [] } };
  // Tenant-specific CLIENT_ORGS briefings are deliberately excluded from the provider payload;
  // EMPLOYEE content only passes contentAudienceWhere for verified employees.
  const contentScope: Prisma.ContentItemWhereInput = { audience: { in: ["PUBLIC", "CLIENT_ALL", "EMPLOYEE"] } };
  const contentMatch: Prisma.ContentItemWhereInput = terms.length
    ? { OR: terms.flatMap((t) => [{ title: ci(t) }, { summary: ci(t) }, { body: ci(t) }]) }
    : { id: { in: [] } };

  const [matchedShared, content] = await Promise.all([
    db.sharedObservation.findMany({
      where: { AND: [sharedFeedWhere(actor), sharedMatch] },
      select: sharedSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: MAX_SHARED,
    }),
    db.contentItem.findMany({
      where: { AND: [contentAudienceWhere(actor), contentScope, contentMatch] },
      select: contentSelect,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      take: MAX_CONTENT,
    }),
  ]);
  let shared = matchedShared;
  const keywordMatched = matchedShared.length > 0;
  if (!keywordMatched) {
    // Fallback: most recent approved contributions (still under the same live filter).
    shared = await db.sharedObservation.findMany({
      where: sharedFeedWhere(actor),
      select: sharedSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: MAX_SHARED,
    });
  }
  return { shared, content, keywordMatched };
}

type Shared = Awaited<ReturnType<typeof retrieve>>["shared"][number];
type Content = Awaited<ReturnType<typeof retrieve>>["content"][number];

interface Source {
  ref: string;
  citation: AiraCitation;
  text: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const words = (v: string) => v.replace(/_/g, " ").toLowerCase();

function buildSources(shared: Shared[], content: Content[]): Source[] {
  const out: Source[] = [];
  for (const s of shared) {
    const ref = `S${out.length + 1}`;
    const meta = [
      `type: ${words(s.type)}`,
      `industry: ${s.industry}`,
      `region: ${s.region}`,
      `period: ${s.periodLabel}`,
      `contributor confidence: ${words(s.confidence)}`,
      `evidence type: ${words(s.evidenceType)}`,
      s.offering ? `offering: ${s.offering.name}` : null,
      s.topics.length ? `topics: ${s.topics.join(", ")}` : null,
    ].filter(Boolean);
    out.push({
      ref,
      citation: { ref, id: s.id, title: s.title, kind: "shared_observation", href: `/portal/learning/${s.id}` },
      text: `[${ref}] Approved shared contribution — "${s.title}"\n(${meta.join("; ")})\n${clip(s.body, SHARED_BODY_CHARS)}`,
    });
  }
  for (const c of content) {
    const ref = `S${out.length + 1}`;
    out.push({
      ref,
      citation: { ref, id: c.id, title: c.title, kind: "content", href: `/portal/knowledge/${c.slug}` },
      text: `[${ref}] Published ${words(c.type)} — "${c.title}"\nSummary: ${c.summary}\n${clip(c.body, CONTENT_BODY_CHARS)}`,
    });
  }
  return out;
}

const SYSTEM_PROMPT = [
  "You are AIRA, the azentio.ai collective-learning research assistant.",
  "Answer ONLY from the numbered sources provided in the user message. Do not use outside knowledge, and never invent sources, figures or organisations.",
  "Cite every claim with the source reference in square brackets, e.g. [S1] or [S2][S4]. Only cite references that appear in the sources.",
  "If the sources do not contain enough evidence to answer, say so plainly and describe what evidence is missing.",
  "Preserve uncertainty: carry through each contribution's stated confidence and evidence type, and note when evidence is anecdotal or from a single contribution.",
  "Never present the number of similar contributions (popularity) as market prevalence, and never infer causation from co-occurrence.",
  "Do not make or recommend credit, lending, investment or other business decisions; you may summarise what the sources say for a human to evaluate.",
  "Do not speculate about who contributed a source or which organisation they belong to.",
  "Be concise: at most about 250 words, using short paragraphs or bullet points.",
].join("\n");

function userPrompt(question: string, sources: Source[], keywordMatched: boolean) {
  const scope = keywordMatched
    ? "Sources were retrieved by keyword match against the question."
    : "No approved contribution matched the question's keywords; the shared contributions below are simply the most recent ones and may not be relevant.";
  const body = sources.length ? sources.map((s) => s.text).join("\n\n---\n\n") : "(No sources are available.)";
  return `Question:\n${question}\n\n${scope}\n\nSources:\n\n${body}`;
}

// ── Citation post-processing ──────────────────────────────────────────────

/**
 * Normalise grouped citations ("[S1, S3]" → "[S1][S3]") and strip any reference that does not
 * map to a retrieved source. Returns the cleaned answer and the cited refs in first-use order.
 */
export function sanitiseCitations(answer: string, validRefs: readonly string[]) {
  const valid = new Set(validRefs);
  const grouped = answer.replace(/\[(\s*S\d+\s*(?:[,;]\s*S\d+\s*)+)\]/gi, (_m, inner: string) =>
    inner
      .split(/[,;]/)
      .map((r) => `[${r.trim().toUpperCase()}]`)
      .join(""),
  );
  const cited: string[] = [];
  const cleaned = grouped
    .replace(/\[\s*(S\d+)\s*\]/gi, (_m, ref: string) => {
      const r = ref.toUpperCase();
      if (!valid.has(r)) return "";
      if (!cited.includes(r)) cited.push(r);
      return `[${r}]`;
    })
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { answer: cleaned, cited };
}

// ── Provider call ─────────────────────────────────────────────────────────

interface ProviderResponse {
  model?: string;
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function providerError(status: number): AppError {
  if (status === 401 || status === 403) return new AppError("unavailable", "AIRA is unavailable: the AI provider rejected this deployment's credentials.");
  if (status === 402) return new AppError("unavailable", "AIRA is unavailable: the AI provider account has insufficient credit.");
  if (status === 429)
    return new AppError("rate_limited", "AIRA's AI provider is receiving too many requests. Please wait a moment and try again.", { retryAfterSeconds: 30 });
  if (status >= 500) return new AppError("unavailable", "AIRA's AI provider is temporarily unavailable. Please try again shortly.");
  return new AppError("unavailable", "AIRA could not complete this request with the configured AI provider.");
}

async function callProvider(system: string, user: string) {
  const e = env();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": e.AUTH_URL,
        "X-Title": "azentio.ai AIRA",
      },
      body: JSON.stringify({
        model: e.OPENROUTER_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 700,
        provider: { data_collection: "deny", ...(e.OPENROUTER_ZDR === "1" ? { zdr: true } : {}) },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    // Never log the key, prompt or source bodies — only the failure class.
    log.warn("AIRA provider request failed", { reason: timeout ? "timeout" : "network" });
    throw new AppError("unavailable", timeout ? "AIRA timed out waiting for the AI provider. Please try again." : "AIRA could not reach the AI provider. Please try again.");
  }
  if (!res.ok) {
    log.warn("AIRA provider returned an error", { status: res.status });
    await res.body?.cancel().catch(() => undefined);
    throw providerError(res.status);
  }
  let json: ProviderResponse;
  try {
    json = (await res.json()) as ProviderResponse;
  } catch {
    log.warn("AIRA provider returned invalid JSON", { status: res.status });
    throw new AppError("unavailable", "AIRA received an unreadable response from the AI provider.");
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    log.warn("AIRA provider returned an empty answer", { status: res.status });
    throw new AppError("unavailable", "AIRA received an empty response from the AI provider. Please try again.");
  }
  return {
    content,
    model: typeof json.model === "string" ? json.model : e.OPENROUTER_MODEL,
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? null,
      completionTokens: json.usage?.completion_tokens ?? null,
      totalTokens: json.usage?.total_tokens ?? null,
    },
  };
}

// ── Entry point ───────────────────────────────────────────────────────────

export async function askAira(actor: AuthedActor, input: z.infer<typeof airaQuestionSchema>): Promise<AiraAnswer> {
  if (!can.useAira(actor)) throw forbidden("AIRA is available to authorised learning participants only.");
  if (!airaConfigured()) throw new AppError("unavailable", NOT_CONFIGURED_MESSAGE);
  await rateLimit(`aira:${actor.user.id}`, 10, 60);

  const terms = questionTerms(input.question);
  const { shared, content, keywordMatched } = await retrieve(actor, terms);
  const sources = buildSources(shared, content);

  if (sources.length === 0) {
    // Nothing approved to synthesise from — answer honestly without calling the provider.
    return {
      answer:
        "There are no approved shared contributions or permitted published content available to answer this question yet, so AIRA cannot provide a synthesis. Nothing was sent to the AI provider.",
      citations: [],
      model: env().OPENROUTER_MODEL,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null },
      retrieval: { shared: 0, content: 0, keywordMatched: false, terms },
    };
  }

  const result = await callProvider(SYSTEM_PROMPT, userPrompt(input.question, sources, keywordMatched));
  const { answer, cited } = sanitiseCitations(result.content, sources.map((s) => s.ref));
  const byRef = new Map(sources.map((s) => [s.ref, s.citation]));
  const citations = cited.map((r) => byRef.get(r)!).filter(Boolean);

  await audit({
    actorId: actor.user.id,
    action: "aira.query",
    entityType: "Aira",
    // Counts only — never the question, the sources or the answer.
    metadata: { sharedSources: shared.length, contentSources: content.length, cited: citations.length, keywordMatched, model: result.model },
  });

  return {
    answer,
    citations,
    model: result.model,
    usage: result.usage,
    retrieval: { shared: shared.length, content: content.length, keywordMatched, terms },
  };
}
