"use client";

/**
 * Renders a timestamp in the viewer's own locale and time zone. The server render uses the
 * server's zone, so the text is allowed to differ during hydration.
 */
export function LocalDateTime({ value, dateOnly = false, className }: { value: string | Date; dateOnly?: boolean; className?: string }) {
  const d = new Date(value);
  const text = d.toLocaleString(undefined, dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
