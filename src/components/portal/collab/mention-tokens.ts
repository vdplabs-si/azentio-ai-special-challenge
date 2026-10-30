/**
 * @mention parsing — pure, shared by the server (resolution/normalisation) and the client
 * (safe rendering). Two input forms are recognised:
 *   - `@[Display Name](userId)` — inserted by the mention picker
 *   - `@person@example.com`     — typed by hand; resolved server-side to a token
 * Bodies are never rendered as HTML; tokens become styled spans via `tokenizeMentions`.
 */

export const MAX_MENTIONS = 20;

// Group 1: name, group 2: user id (cuid-ish), group 3: email (only after start / whitespace / punctuation).
const TOKEN_RE = /@\[([^\]\n]{1,100})\]\(([A-Za-z0-9_-]{6,64})\)|(^|[\s(,;:])@([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24})/g;

export type MentionPart =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; userId: string }
  | { type: "email"; email: string };

/** Split a body into text and mention parts (emails are only recognised in the `@email` form). */
export function tokenizeMentions(body: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (m[2] !== undefined) {
      if (start > last) parts.push({ type: "text", value: body.slice(last, start) });
      parts.push({ type: "mention", name: m[1]!.trim(), userId: m[2] });
      last = start + m[0].length;
    } else if (m[4] !== undefined) {
      const prefix = m[3] ?? "";
      const tokenStart = start + prefix.length;
      if (tokenStart > last) parts.push({ type: "text", value: body.slice(last, tokenStart) });
      parts.push({ type: "email", email: m[4].toLowerCase() });
      last = start + m[0].length;
    }
  }
  if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
  return mergeText(parts);
}

function mergeText(parts: MentionPart[]) {
  const out: MentionPart[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (p.type === "text" && prev?.type === "text") prev.value += p.value;
    else out.push(p.type === "text" ? { ...p } : p);
  }
  return out;
}

/** Unique user ids and emails referenced by a body (capped at MAX_MENTIONS in total). */
export function extractMentionRefs(body: string) {
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const p of tokenizeMentions(body)) {
    if (ids.size + emails.size >= MAX_MENTIONS) break;
    if (p.type === "mention") ids.add(p.userId);
    else if (p.type === "email") emails.add(p.email);
  }
  return { ids: [...ids], emails: [...emails] };
}

/** Escape characters that would break a `@[name](id)` token. */
export const tokenName = (name: string) => name.replace(/[\[\]\n()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "user";
export const mentionToken = (name: string, userId: string) => `@[${tokenName(name)}](${userId})`;

/**
 * Rewrite a body so that only permitted mentions remain tokens:
 * permitted ids/emails become `@[Current Name](id)`; anything else is downgraded to plain text
 * (prevents spoofed display names and dangling ids).
 */
export function normaliseMentions(
  body: string,
  allowed: { byId: ReadonlyMap<string, { id: string; name: string }>; byEmail: ReadonlyMap<string, { id: string; name: string }> },
) {
  return tokenizeMentions(body)
    .map((p) => {
      if (p.type === "text") return p.value;
      if (p.type === "mention") {
        const u = allowed.byId.get(p.userId);
        return u ? mentionToken(u.name, u.id) : `@${tokenName(p.name)}`;
      }
      const u = allowed.byEmail.get(p.email);
      return u ? mentionToken(u.name, u.id) : `@${p.email}`;
    })
    .join("");
}

/** Find an in-progress `@query` immediately before the caret (for the mention picker). */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/[\s(,;:]/.test(before.charAt(at - 1))) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\s\[\]()]/.test(query)) return null;
  return { start: at, query };
}
