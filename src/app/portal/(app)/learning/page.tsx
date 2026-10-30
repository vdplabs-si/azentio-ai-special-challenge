import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Download, Library, ShieldCheck } from "lucide-react";
import { learningPageActor } from "@/server/learning/guard";
import { SHARED_FILTER_KEYS, sharedListQuery } from "@/server/learning/schemas";
import { listBookmarks, listSavedSearches, listSharedFeed } from "@/server/services/shared-feed";
import { listOfferingOptions } from "@/server/services/observations";
import { cn } from "@/lib/utils";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { CohortText, SharedBadge } from "@/components/portal/learning/badges";
import { SharedCard } from "@/components/portal/learning/shared-card";
import { FeedFilters, type FeedFilterValues } from "@/components/portal/learning/feed-filters";
import { asCohort, FeedFacets } from "@/components/portal/learning/feed-facets";
import { SavedSearches } from "@/components/portal/learning/saved-searches";
import { toQueryString } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";

// Shared learning is always read live: withdrawal and moderation take effect on the next request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared learning" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SharedLearningPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await learningPageActor();
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
      .filter((e): e is readonly [string, string] => typeof e[1] === "string" && e[1] !== "" && isQueryKey(e[0])),
  );
  const parsed = sharedListQuery.safeParse(flat);
  const query = parsed.success ? parsed.data : sharedListQuery.parse({});
  const view = raw.view === "bookmarks" ? "bookmarks" : "feed";

  const filters: FeedFilterValues = {};
  for (const key of SHARED_FILTER_KEYS) {
    const v = query[key];
    if (v) filters[key] = v;
  }
  const hasFilters = Object.keys(filters).length > 0;

  const [feed, bookmarks, saved, offerings] = await Promise.all([
    view === "feed" ? listSharedFeed(actor, query) : Promise.resolve(null),
    view === "bookmarks" ? listBookmarks(actor) : Promise.resolve(null),
    listSavedSearches(actor),
    listOfferingOptions(),
  ]);

  const exportHref = `/api/v1/shared-observations/export${toQueryString({ ...filters })}`;
  const pageHref = (page: number) => `/portal/learning${toQueryString({ ...filters, page: page > 1 ? page : undefined })}`;

  return (
    <div className="grid gap-6">
      <div className="border-t-4 border-t-brand-green pt-4">
        <PageHeader
          eyebrow="Collective learning"
          title="Shared learning"
          description="Reviewed, de-identified contributions from approved participants across organisations. Private sources, contributor identities and organisation details are never shown here."
          actions={
            <>
              <SharedBadge />
              {view === "feed" && (
                <Button asChild variant="outline">
                  <a href={exportHref} download>
                    <Download aria-hidden /> Export CSV
                  </a>
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Shared learning views" className="inline-flex rounded-lg border bg-card p-1 text-sm">
          <ViewTab href={`/portal/learning${toQueryString({ ...filters })}`} active={view === "feed"}>
            Approved feed
          </ViewTab>
          <ViewTab href="/portal/learning?view=bookmarks" active={view === "bookmarks"}>
            My bookmarks
          </ViewTab>
        </nav>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          Every item was reviewed by a moderator. Popularity is not market prevalence.
        </p>
      </div>

      {!parsed.success && (
        <Notice tone="warning" title="Some filters were ignored">
          One or more filter values in the address were invalid, so the unfiltered feed is shown.
        </Notice>
      )}

      {view === "bookmarks" ? (
        <section aria-label="Bookmarked shared contributions" className="grid gap-3">
          {bookmarks && bookmarks.filter((b) => b.shared).length > 0 ? (
            bookmarks
              .filter((b) => b.shared)
              .map((b) => <SharedCard key={b.id} item={b.shared!} />)
          ) : (
            <EmptyState
              icon={Library}
              title="No bookmarks"
              description="Bookmark shared contributions to find them again. Contributions that are withdrawn or unpublished disappear from this list immediately."
              action={
                <Button asChild variant="outline">
                  <Link href="/portal/learning">Browse the feed</Link>
                </Button>
              }
            />
          )}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="order-2 grid content-start gap-6 lg:order-1">
            {feed && <FeedFacets facets={feed.facets} filters={filters} />}
            <SavedSearches
              items={saved.map((s) => ({ id: s.id, name: s.name, liveCount: s.liveCount, filters: pickFilters(s.filters) }))}
              current={filters}
              hasFilters={hasFilters}
            />
          </aside>
          <div className="order-1 grid content-start gap-4 lg:order-2">
            <FeedFilters key={JSON.stringify(filters)} initial={filters} offerings={offerings.map((o) => ({ slug: o.slug, name: o.name }))} />
            {feed && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className="text-brand-ink">
                    <span className="font-semibold tabular-nums">{feed.total}</span> approved contribution{feed.total === 1 ? "" : "s"}
                    <span className="text-muted-foreground">
                      {" "}
                      · from <CohortText value={asCohort(feed.facets.organisations)} />
                    </span>
                  </p>
                  {feed.pageCount > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Page {feed.page} of {feed.pageCount}
                    </p>
                  )}
                </div>
                {feed.items.length === 0 ? (
                  <EmptyState
                    icon={Library}
                    title={hasFilters ? "No contributions match these filters" : "No shared contributions yet"}
                    description={
                      hasFilters
                        ? "Try removing a filter or broadening the period."
                        : "When moderators publish reviewed contributions from participants, they appear here."
                    }
                    action={
                      hasFilters ? (
                        <Button asChild variant="outline">
                          <Link href="/portal/learning">Clear filters</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid gap-3">
                    {feed.items.map((item) => (
                      <SharedCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
                {feed.pageCount > 1 && (
                  <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
                    {feed.page > 1 ? (
                      <Button asChild variant="outline">
                        <Link href={pageHref(feed.page - 1)}>
                          <ChevronLeft aria-hidden /> Previous
                        </Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                    {feed.page < feed.pageCount && (
                      <Button asChild variant="outline">
                        <Link href={pageHref(feed.page + 1)}>
                          Next <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    )}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const QUERY_KEYS = new Set<string>([...SHARED_FILTER_KEYS, "page", "pageSize"]);
function isQueryKey(key: string) {
  return QUERY_KEYS.has(key);
}

function pickFilters(f: Record<string, unknown>): FeedFilterValues {
  const out: FeedFilterValues = {};
  for (const key of SHARED_FILTER_KEYS) {
    const v = f[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

function ViewTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-success/10 text-success" : "text-muted-foreground hover:text-brand-ink",
      )}
    >
      {children}
    </Link>
  );
}
