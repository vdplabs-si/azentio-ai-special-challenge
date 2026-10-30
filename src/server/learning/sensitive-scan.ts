/**
 * Heuristic scan for restricted information in contributions (PDF §07).
 * Runs on save/submit (server) and live in the form (client). Results are stored in
 * Observation.sensitiveFlags, shown to the author and highlighted for moderators.
 *
 * An automated scan is NOT a privacy guarantee: it finds common patterns only.
 * Pure module — safe for client and server, unit-tested.
 */

export type SensitiveKind =
  | "email"
  | "phone"
  | "iban"
  | "card_number"
  | "account_number"
  | "credential"
  | "currency_amount"
  | "specific_date"
  | "restricted_term";

export type ScanField = "title" | "body" | "topics" | "links";

export interface SensitiveFlag {
  kind: SensitiveKind;
  field: ScanField;
  /** Character offset of the match within the field text. */
  index: number;
  /** Length of the match (used to highlight for moderators). */
  length: number;
  /** Masked excerpt — never the raw value. */
  excerpt: string;
}

export const SENSITIVE_KIND_LABELS: Record<SensitiveKind, string> = {
  email: "Email address",
  phone: "Phone number",
  iban: "IBAN",
  card_number: "Payment card number",
  account_number: "Account-like number",
  credential: "Credential or secret",
  currency_amount: "Exact currency amount",
  specific_date: "Specific calendar date",
  restricted_term: "Restricted term (e.g. confidential, NDA, pricing)",
};

export const SENSITIVE_KIND_ADVICE: Record<SensitiveKind, string> = {
  email: "Remove personal or customer email addresses.",
  phone: "Remove phone numbers.",
  iban: "Remove bank account identifiers.",
  card_number: "Remove payment card numbers.",
  account_number: "Remove account, customer or transaction reference numbers.",
  credential: "Never paste passwords, API keys, tokens or private keys.",
  currency_amount: "Prefer ranges or percentages over exact amounts.",
  specific_date: "Prefer a month, quarter or half-year over exact dates.",
  restricted_term: "Check that no confidential, contractual or pricing terms are disclosed.",
};

const MAX_FLAGS = 50;

/** Mask a value keeping a couple of characters for recognition. */
export function maskValue(raw: string): string {
  const s = raw.trim();
  if (s.length <= 4) return "•".repeat(s.length);
  const keep = s.length >= 10 ? 2 : 1;
  return s.slice(0, keep) + "•".repeat(Math.min(s.length - keep * 2, 12)) + s.slice(-keep);
}

function maskEmail(raw: string): string {
  const [local = "", domain = ""] = raw.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 1)}•••@${host.slice(0, 1)}•••${tld}`;
}

/** Luhn checksum used by payment card numbers. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** ISO 13616 mod-97 check for IBANs. */
export function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : ch;
    for (const c of chunk) remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

interface Detector {
  kind: SensitiveKind;
  pattern: RegExp;
  /** Return false to drop a match (e.g. failed checksum). */
  accept?: (match: string) => boolean;
  mask?: (match: string) => string;
}

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const CURRENCY_CODES = "USD|EUR|GBP|AED|SAR|QAR|KWD|BHD|OMR|JOD|EGP|INR|PKR|BDT|LKR|MYR|SGD|IDR|THB|PHP|NGN|KES|ZAR|CHF|JPY|CNY";

/**
 * Order matters: earlier detectors claim their character ranges first, so a valid card
 * number is not also reported as a generic account number.
 */
const DETECTORS: Detector[] = [
  {
    kind: "credential",
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g,
    mask: () => "-----BEGIN … PRIVATE KEY-----",
  },
  {
    kind: "credential",
    pattern: /\b(?:password|passwd|pwd|passcode|secret|client[_-]?secret|api[_ -]?key|access[_ -]?key|auth[_ -]?token|token)\b\s*[:=]\s*\S+/gi,
    mask: (m) => `${m.split(/[:=]/)[0]!.trim()}=••••`,
  },
  { kind: "credential", pattern: /\bbearer\s+[A-Za-z0-9\-._~+/]{8,}=*/gi, mask: () => "Bearer ••••" },
  {
    kind: "credential",
    pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g,
  },
  { kind: "credential", pattern: /\bapi[ _-]?keys?\b/gi, mask: (m) => m },
  { kind: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mask: maskEmail },
  {
    kind: "iban",
    pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g,
    accept: ibanValid,
  },
  {
    kind: "card_number",
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    accept: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    },
  },
  {
    kind: "specific_date",
    pattern: new RegExp(
      [
        String.raw`\b\d{4}-\d{2}-\d{2}\b`,
        String.raw`\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b`,
        String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:${MONTHS})\.?,?\s+\d{4}\b`,
        String.raw`\b(?:${MONTHS})\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b`,
      ].join("|"),
      "gi",
    ),
    mask: (m) => m,
  },
  {
    kind: "phone",
    pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\b\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}\b|\+\d{8,15}\b/g,
  },
  {
    kind: "currency_amount",
    pattern: new RegExp(
      String.raw`(?:[$€£¥₹]\s?|\b(?:${CURRENCY_CODES})\s?)\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|mn|bn|million|billion|thousand)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k|m|mn|bn|million|billion|thousand)?\s?(?:${CURRENCY_CODES}|dollars|euros|pounds|dirhams|riyals|rupees)\b`,
      "gi",
    ),
    mask: (m) => m.replace(/\d/g, "#"),
  },
  { kind: "account_number", pattern: /\b\d{8,}\b/g },
  {
    kind: "restricted_term",
    pattern:
      /\b(?:confidential|strictly private|nda|non[- ]disclosure|proprietary|trade secret|internal use only|do not share|pricing|price list|discount rate|contract value|commercial terms)\b/gi,
    mask: (m) => m,
  },
];

/** Scan one text field. Overlapping matches are attributed to the first detector that claimed them. */
export function scanText(text: string, field: ScanField = "body"): SensitiveFlag[] {
  if (!text) return [];
  const claimed: [number, number][] = [];
  const overlaps = (s: number, e: number) => claimed.some(([cs, ce]) => s < ce && e > cs);
  const flags: SensitiveFlag[] = [];
  for (const d of DETECTORS) {
    d.pattern.lastIndex = 0;
    for (const m of text.matchAll(d.pattern)) {
      const value = m[0];
      const start = m.index ?? 0;
      const end = start + value.length;
      if (!value.trim() || overlaps(start, end)) continue;
      if (d.accept && !d.accept(value)) continue;
      claimed.push([start, end]);
      flags.push({ kind: d.kind, field, index: start, length: value.length, excerpt: (d.mask ?? maskValue)(value) });
    }
  }
  return flags.sort((a, b) => a.index - b.index);
}

export interface ScanInput {
  title?: string;
  body?: string;
  topics?: readonly string[];
  links?: readonly string[];
}

/** Scan a contribution's text fields. Links are scanned for embedded credentials/emails only. */
export function scanContribution(input: ScanInput): SensitiveFlag[] {
  const flags = [
    ...scanText(input.title ?? "", "title"),
    ...scanText(input.body ?? "", "body"),
    ...scanText((input.topics ?? []).join(", "), "topics"),
    ...scanText((input.links ?? []).join(" "), "links").filter((f) => f.kind === "credential" || f.kind === "email"),
  ];
  return flags.slice(0, MAX_FLAGS);
}

/** Count flags by kind for summaries. */
export function summariseFlags(flags: readonly SensitiveFlag[]) {
  const out = new Map<SensitiveKind, number>();
  for (const f of flags) out.set(f.kind, (out.get(f.kind) ?? 0) + 1);
  return [...out.entries()].map(([kind, count]) => ({ kind, count, label: SENSITIVE_KIND_LABELS[kind] }));
}

/** Safely read flags persisted as JSON (unknown shape from the database). */
export function parseFlags(value: unknown): SensitiveFlag[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is SensitiveFlag =>
      !!f &&
      typeof f === "object" &&
      typeof (f as SensitiveFlag).kind === "string" &&
      typeof (f as SensitiveFlag).index === "number" &&
      typeof (f as SensitiveFlag).excerpt === "string",
  ).map((f) => ({ ...f, field: f.field ?? "body", length: typeof f.length === "number" ? f.length : 0 }));
}
