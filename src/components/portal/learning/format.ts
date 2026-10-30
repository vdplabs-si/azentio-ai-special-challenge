import { format, formatDistanceToNowStrict } from "date-fns";

/** "14 Mar 2026" */
export const formatDate = (iso: string | Date | null | undefined) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
/** "14 Mar 2026, 10:42" */
export const formatDateTime = (iso: string | Date | null | undefined) => (iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "—");
/** "3 days ago" */
export const fromNow = (iso: string | Date) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

/** Build a query string from a filter object, omitting empty values. */
export function toQueryString(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v) !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
