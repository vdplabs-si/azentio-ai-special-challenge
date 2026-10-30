/** Date helpers for <input type="date"> round-trips (pure; local-time semantics in the browser). */
import { format, isValid } from "date-fns";

/** "yyyy-MM-dd" → ISO at local start of day, "" → null. */
export function dateInputToStartIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isValid(d) ? d.toISOString() : null;
}

/** "yyyy-MM-dd" → ISO at local end of day (a due date is due by the end of that day), "" → null. */
export function dateInputToEndIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return isValid(d) ? d.toISOString() : null;
}

/** Date | ISO string | null → "yyyy-MM-dd" for a date input. */
export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

export function formatDate(value: Date | string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  const d = new Date(value);
  return isValid(d) ? format(d, pattern) : "—";
}

export function formatDateTime(value: Date | string | null | undefined) {
  return formatDate(value, "d MMM yyyy, HH:mm");
}
