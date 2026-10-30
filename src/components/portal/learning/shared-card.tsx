import Link from "next/link";
import { Building2, CalendarRange, MapPin } from "lucide-react";
import type { SharedDTO } from "@/server/learning/dto";
import { CONFIDENCE_LABELS, EVIDENCE_TYPE_LABELS, industryLabel, OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/portal/learning/format";

/** Summary card for an approved shared copy. Renders DTO fields only. */
export function SharedCard({ item, className, compact = false }: { item: SharedDTO; className?: string; compact?: boolean }) {
  return (
    <article className={cn("rounded-lg border border-l-4 border-l-brand-green bg-card p-4 transition-colors hover:border-brand-green/60", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide text-success">{OBSERVATION_TYPE_LABELS[item.type]}</span>
        <span aria-hidden>·</span>
        <span>{CONFIDENCE_LABELS[item.confidence]}</span>
        <span aria-hidden>·</span>
        <span>{EVIDENCE_TYPE_LABELS[item.evidenceType]}</span>
      </div>
      <h3 className="mt-1.5 font-semibold text-brand-ink">
        <Link href={`/portal/learning/${item.id}`} className="hover:underline focus-visible:underline focus-visible:outline-none">
          {item.title}
        </Link>
      </h3>
      {!compact && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden /> {item.region}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarRange className="size-3.5" aria-hidden /> {item.periodLabel}
        </span>
        <span>{industryLabel(item.industry)}</span>
        {item.offering && <span>{item.offering.name}</span>}
        <span className="inline-flex items-center gap-1">
          <Building2 className="size-3.5" aria-hidden /> {item.attributionLabel ?? "Unattributed"}
        </span>
        <span>Published {formatDate(item.publishedAt)}</span>
      </div>
      {!compact && item.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
          {item.topics.map((t) => (
            <li key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs text-brand-ink">
              {t}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
