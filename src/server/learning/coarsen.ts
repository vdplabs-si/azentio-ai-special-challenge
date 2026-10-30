/**
 * De-identification helpers applied when a moderator publishes a shared copy (PDF §09):
 * geographic detail is coarsened to broad REGIONS and periods to half-year (or year) labels.
 * Pure module — unit-tested.
 */
import { REGIONS } from "@/content/catalogue";

export type Region = (typeof REGIONS)[number];

/** Country / city / sub-region terms mapped to the broad regions used in shared copies. */
const LOCATION_TERMS: Record<Exclude<Region, "Other">, string[]> = {
  "Middle East": [
    "middle east", "mena", "gcc", "gulf", "uae", "united arab emirates", "emirates", "dubai", "abu dhabi", "sharjah",
    "saudi", "saudi arabia", "ksa", "riyadh", "jeddah", "dammam", "qatar", "doha", "kuwait", "bahrain", "manama",
    "oman", "muscat", "jordan", "amman", "lebanon", "beirut", "iraq", "baghdad", "erbil", "egypt", "cairo",
    "alexandria", "turkey", "türkiye", "istanbul", "ankara",
  ],
  Africa: [
    "africa", "sub-saharan", "nigeria", "lagos", "abuja", "kenya", "nairobi", "south africa", "johannesburg",
    "cape town", "ghana", "accra", "morocco", "casablanca", "rabat", "tunisia", "tunis", "algeria", "algiers",
    "tanzania", "dar es salaam", "uganda", "kampala", "ethiopia", "addis ababa", "rwanda", "kigali", "senegal",
    "dakar", "zambia", "lusaka", "mauritius", "botswana", "namibia", "ivory coast", "côte d'ivoire", "abidjan",
  ],
  "South Asia": [
    "south asia", "india", "mumbai", "delhi", "new delhi", "bangalore", "bengaluru", "chennai", "hyderabad", "pune",
    "kolkata", "pakistan", "karachi", "lahore", "islamabad", "bangladesh", "dhaka", "sri lanka", "colombo", "nepal",
    "kathmandu", "maldives", "bhutan", "afghanistan",
  ],
  "South East Asia": [
    "south east asia", "southeast asia", "asean", "malaysia", "kuala lumpur", "singapore", "indonesia", "jakarta",
    "thailand", "bangkok", "philippines", "manila", "vietnam", "viet nam", "hanoi", "ho chi minh", "brunei",
    "cambodia", "phnom penh", "myanmar", "yangon", "laos",
  ],
  Europe: [
    "europe", "eu", "united kingdom", "uk", "england", "scotland", "london", "ireland", "dublin", "germany",
    "berlin", "frankfurt", "munich", "france", "paris", "netherlands", "amsterdam", "belgium", "brussels",
    "luxembourg", "switzerland", "zurich", "geneva", "spain", "madrid", "italy", "milan", "rome", "portugal",
    "lisbon", "poland", "warsaw", "sweden", "stockholm", "norway", "denmark", "finland", "austria", "vienna",
    "greece", "athens", "cyprus",
  ],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Map free-text geography (a REGIONS value, country or city) to a broad REGIONS value. */
export function coarsenRegion(input: string | null | undefined): Region {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "Other";
  const exact = REGIONS.find((r) => r.toLowerCase() === raw);
  if (exact) return exact;
  for (const [region, terms] of Object.entries(LOCATION_TERMS) as [Region, string[]][]) {
    if (terms.some((t) => new RegExp(`(^|[^a-z])${escape(t)}($|[^a-z])`, "i").test(raw))) return region;
  }
  return "Other";
}

export interface LocationMention {
  term: string;
  region: Region;
  index: number;
}

/**
 * Find country/city-level place names in free text so a moderator can redact them.
 * Broad region names themselves are not reported.
 */
export function findLocationMentions(text: string): LocationMention[] {
  const out: LocationMention[] = [];
  const broad = new Set(REGIONS.map((r) => r.toLowerCase()).concat(["middle east", "africa", "europe", "south asia", "south east asia", "southeast asia", "mena", "gcc", "asean", "eu"]));
  for (const [region, terms] of Object.entries(LOCATION_TERMS) as [Region, string[]][]) {
    for (const t of terms) {
      if (broad.has(t) || t.length < 3) continue;
      const re = new RegExp(`(^|[^\\p{L}])(${escape(t)})(?=$|[^\\p{L}])`, "giu");
      for (const m of text.matchAll(re)) {
        out.push({ term: m[2]!, region, index: (m.index ?? 0) + m[1]!.length });
      }
    }
  }
  // Drop mentions fully inside a longer mention (e.g. "delhi" within "new delhi").
  const sorted = out.sort((a, b) => a.index - b.index || b.term.length - a.term.length);
  return sorted.filter(
    (m, i) => !sorted.some((o, j) => j !== i && o.index <= m.index && o.index + o.term.length >= m.index + m.term.length && o.term.length > m.term.length),
  );
}

export type PeriodGranularity = "half" | "year";

export interface CoarsePeriod {
  label: string;
  periodStart: Date;
}

const half = (d: Date) => (d.getUTCMonth() < 6 ? 1 : 2);
const halfStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), half(d) === 1 ? 0 : 6, 1));

/**
 * Coarsen an observation period: "2026 H1" (periodStart = 1 Jan 2026 UTC) or, if the period
 * spans halves, "2025 H2–2026 H1". With granularity "year": "2026" / "2025–2026".
 */
export function coarsenPeriod(start: Date, end?: Date | null, granularity: PeriodGranularity = "half"): CoarsePeriod {
  const e = end && end.getTime() >= start.getTime() ? end : start;
  if (granularity === "year") {
    const sy = start.getUTCFullYear();
    const ey = e.getUTCFullYear();
    return { label: sy === ey ? `${sy}` : `${sy}–${ey}`, periodStart: new Date(Date.UTC(sy, 0, 1)) };
  }
  const sLabel = `${start.getUTCFullYear()} H${half(start)}`;
  const eLabel = `${e.getUTCFullYear()} H${half(e)}`;
  return { label: sLabel === eLabel ? sLabel : `${sLabel}–${eLabel}`, periodStart: halfStart(start) };
}
