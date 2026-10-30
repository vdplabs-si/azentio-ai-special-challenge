/** Dates on the public site are shown in UTC so server and client render identically. */
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

export const formatDate = (d: Date) => date.format(d);
export const formatDateShort = (d: Date) => dateShort.format(d);
export const formatDateTime = (d: Date) => `${dateShort.format(d)}, ${time.format(d)} UTC`;
export const isoDate = (d: Date) => d.toISOString();

export function formatDateRange(start: Date, end: Date) {
  const a = formatDateShort(start);
  const b = formatDateShort(end);
  return a === b ? a : `${a} – ${b}`;
}
