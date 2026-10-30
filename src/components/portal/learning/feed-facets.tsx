import Link from "next/link";
import type { CohortValue, FacetBucket } from "@/server/learning/cohort";
import type { SharedFacets } from "@/server/services/shared-feed";
import { cn } from "@/lib/utils";
import { CohortText } from "@/components/portal/learning/badges";
import { toQueryString } from "@/components/portal/learning/format";
import type { FeedFilterValues } from "@/components/portal/learning/feed-filters";

/** Narrow the facet organisation summary to a CohortValue (never exposes a suppressed number). */
export function asCohort(o: SharedFacets["organisations"]): CohortValue {
  return o.suppressed || o.value === null ? { suppressed: true, value: null, min: o.min } : { suppressed: false, value: o.value, min: o.min };
}

const GROUPS: { key: "type" | "region" | "industry" | "offering" | "topic"; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "offering", label: "Offering" },
  { key: "industry", label: "Industry" },
  { key: "region", label: "Region" },
  { key: "topic", label: "Topic" },
];

/**
 * Facets computed server-side with the same where clause as the results. Buckets whose distinct
 * contributing organisations are below the cohort minimum show no count.
 */
export function FeedFacets({ facets, filters }: { facets: SharedFacets; filters: FeedFilterValues }) {
  return (
    <nav aria-label="Refine results" className="grid gap-5">
      <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-brand-ink">
        <p className="font-semibold">Contributing organisations</p>
        <p className="mt-0.5">
          <CohortText value={asCohort(facets.organisations)} />
        </p>
        <p className="mt-1.5 text-muted-foreground">
          Counts are suppressed when fewer than {facets.minCohort} organisations contribute. Repeated posts from one organisation count once.
        </p>
      </div>
      {GROUPS.map((g) => (
        <FacetGroup key={g.key} label={g.label} name={g.key} buckets={facets[g.key]} filters={filters} min={facets.minCohort} />
      ))}
    </nav>
  );
}

function FacetGroup({
  label,
  name,
  buckets,
  filters,
  min,
}: {
  label: string;
  name: keyof FeedFilterValues;
  buckets: FacetBucket[];
  filters: FeedFilterValues;
  min: number;
}) {
  if (buckets.length === 0) return null;
  const selected = filters[name];
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <ul className="grid gap-0.5">
        {buckets.slice(0, 12).map((b) => {
          const isSelected = selected === b.value;
          const href = `/portal/learning${toQueryString({ ...filters, [name]: isSelected ? undefined : b.value, page: undefined })}`;
          return (
            <li key={b.value}>
              <Link
                href={href}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "bg-accent font-medium text-brand-ink",
                )}
              >
                <span className="min-w-0 truncate">{b.label}</span>
                {b.suppressed ? (
                  <span className="shrink-0 text-[0.7rem] text-muted-foreground" title={`Fewer than ${min} organisations — count suppressed`}>
                    &lt;{min} orgs
                  </span>
                ) : (
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{b.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
