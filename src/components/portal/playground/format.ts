import type { CellValue, ValueFormat } from "@/server/playground/engines/types";

// Fixed locale so server-rendered and hydrated output match exactly.
const formatters = new Map<number, Intl.NumberFormat>();
function nf(dp: number) {
  let f = formatters.get(dp);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { maximumFractionDigits: dp });
    formatters.set(dp, f);
  }
  return f;
}

/** Format an engine value for display. Amounts are synthetic currency units in thousands. */
export function formatValue(v: CellValue | undefined, format: ValueFormat = "number", unit?: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  switch (format) {
    case "percent":
      return `${nf(2).format(v)}%`;
    case "amount":
      return `${nf(1).format(v)}k`;
    case "ratio":
      return `${nf(2).format(v)}x`;
    case "integer":
      return nf(0).format(v);
    case "text":
      return String(v);
    default:
      return `${nf(3).format(v)}${unit ? ` ${unit}` : ""}`;
  }
}

/** Signed difference between two numeric metric values (percent → percentage points). */
export function formatDelta(before: number, after: number, format: ValueFormat, unit?: string) {
  const d = after - before;
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  const abs = Math.abs(d);
  if (format === "percent") return `${sign}${nf(2).format(abs)} pp`;
  if (format === "amount") return `${sign}${nf(1).format(abs)}k`;
  if (format === "ratio") return `${sign}${nf(2).format(abs)}x`;
  if (format === "integer") return `${sign}${nf(0).format(abs)}`;
  return `${sign}${nf(3).format(abs)}${unit ? ` ${unit}` : ""}`;
}

const TONES: Record<string, "good" | "bad" | "warn"> = {
  PASS: "good",
  Approve: "good",
  "Newly approved": "good",
  FAIL: "bad",
  Decline: "bad",
  "Newly declined": "bad",
  Error: "bad",
  Warning: "warn",
};

export const cellTone = (v: CellValue) => (typeof v === "string" ? TONES[v] : undefined);
