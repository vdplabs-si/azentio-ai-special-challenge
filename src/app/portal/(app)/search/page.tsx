import type { Metadata } from "next";
import { SearchX, Search as SearchIcon } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { AppError } from "@/lib/api/errors";
import { search, type SearchResult } from "@/server/services/search";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { SearchResults } from "@/components/portal/search/search-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";

  let result: SearchResult | null = null;
  let problem: string | null = null;
  if (q.length >= 2 && q.length <= 100) {
    try {
      result = await search(actor, q);
    } catch (e) {
      if (e instanceof AppError && (e.code === "rate_limited" || e.code === "validation_failed")) problem = e.message;
      else throw e;
    }
  } else if (q.length > 100) {
    problem = "Keep searches under 100 characters.";
  } else if (q.length === 1) {
    problem = "Enter at least 2 characters.";
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Overview"
        title="Search"
        description="Search projects, tasks, documents, your observations, shared learning, themes, ideas, knowledge and live sessions. Results only include records you are authorised to see."
      />
      <form method="get" action="/portal/search" role="search" className="flex max-w-2xl gap-2">
        <label htmlFor="portal-search" className="sr-only">
          Search the portal
        </label>
        <Input id="portal-search" name="q" defaultValue={q} placeholder="e.g. working capital, onboarding, release" minLength={2} maxLength={100} className="h-9" autoFocus />
        <Button type="submit" size="lg">
          <SearchIcon aria-hidden /> Search
        </Button>
      </form>

      {problem && <Notice tone="warning">{problem}</Notice>}

      {!q && !problem && (
        <EmptyState icon={SearchIcon} title="Start typing to search" description="Enter at least two characters. Search matches titles and short descriptions." />
      )}

      {result &&
        (result.total === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`No results for “${result.query}”`}
            description="Nothing you are authorised to see matches this search. Try a shorter or different term."
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {result.total} result{result.total === 1 ? "" : "s"} for <strong className="text-brand-ink">“{result.query}”</strong>
            </p>
            <SearchResults result={result} />
          </>
        ))}
    </div>
  );
}
