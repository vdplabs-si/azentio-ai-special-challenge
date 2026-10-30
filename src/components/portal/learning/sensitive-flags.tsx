import { ShieldAlert } from "lucide-react";
import { SENSITIVE_KIND_ADVICE, SENSITIVE_KIND_LABELS, type SensitiveFlag } from "@/server/learning/sensitive-scan";
import { SENSITIVE_DISCLAIMER } from "@/server/learning/labels";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<SensitiveFlag["field"], string> = { title: "Title", body: "Description", topics: "Topics", links: "Links" };

/** Warning list for scan results. Shows masked excerpts only. */
export function SensitiveFlagList({
  flags,
  audience = "author",
  className,
}: {
  flags: readonly SensitiveFlag[];
  audience?: "author" | "moderator";
  className?: string;
}) {
  if (flags.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        The automated scan found no common sensitive patterns. {SENSITIVE_DISCLAIMER}
      </p>
    );
  }
  const kinds = [...new Set(flags.map((f) => f.kind))];
  return (
    <div role="alert" className={cn("rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm text-brand-ink", className)}>
      <p className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="size-4 text-warning" aria-hidden />
        {audience === "author"
          ? `Possible restricted information found (${flags.length})`
          : `${flags.length} automated flag${flags.length === 1 ? "" : "s"} — review before publishing`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {flags.slice(0, 20).map((f, i) => (
          <li key={`${f.field}-${f.index}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[0.85rem]">
            <span className="font-medium">{SENSITIVE_KIND_LABELS[f.kind]}</span>
            <span className="text-muted-foreground">in {FIELD_LABELS[f.field] ?? f.field}</span>
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{f.excerpt}</code>
          </li>
        ))}
      </ul>
      {flags.length > 20 && <p className="mt-1 text-xs text-muted-foreground">…and {flags.length - 20} more.</p>}
      {audience === "author" && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {kinds.map((k) => (
            <li key={k}>{SENSITIVE_KIND_ADVICE[k]}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs font-medium">{SENSITIVE_DISCLAIMER}</p>
    </div>
  );
}

/** Render text with scan matches highlighted (used for moderators and authors). Plain text only — no HTML. */
export function HighlightedText({ text, flags, field, className }: { text: string; flags: readonly SensitiveFlag[]; field: SensitiveFlag["field"]; className?: string }) {
  const ranges = flags
    .filter((f) => f.field === field && f.length > 0 && f.index >= 0 && f.index + f.length <= text.length)
    .sort((a, b) => a.index - b.index);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.index < cursor) return;
    if (r.index > cursor) parts.push(text.slice(cursor, r.index));
    parts.push(
      <mark key={i} title={SENSITIVE_KIND_LABELS[r.kind]} className="rounded-sm bg-warning/30 px-0.5 text-brand-ink ring-1 ring-warning/60">
        {text.slice(r.index, r.index + r.length)}
      </mark>,
    );
    cursor = r.index + r.length;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <span className={cn("whitespace-pre-wrap", className)}>{parts}</span>;
}
