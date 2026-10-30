import { format } from "date-fns";

/** Display helpers shared by admin pages and dialogs (pure; safe on server and client). */
export const fmtDateTime = (d: Date | string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy, HH:mm") : "—");
export const fmtDate = (d: Date | string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy") : "—");

/** Value for <input type="datetime-local"> in the browser's local time zone. */
export const toLocalInput = (d: Date | string | null | undefined) => (d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm") : "");
/** Value for <input type="date">. */
export const toDateInput = (d: Date | string | null | undefined) => (d ? format(new Date(d), "yyyy-MM-dd") : "");
/** Convert a local datetime/date input value to an ISO string (or null when empty). */
export const fromLocalInput = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const humanize = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Flatten Next.js searchParams to single string values. */
export function flatParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string" && val !== "") out[k] = val;
  }
  return out;
}
