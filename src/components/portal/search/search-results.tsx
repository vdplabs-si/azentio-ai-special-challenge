import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText, FolderKanban, Library, Lightbulb, ListChecks, NotebookPen, Radio, Shapes } from "lucide-react";
import type { SearchGroup, SearchResult } from "@/server/services/search";
import { SEARCH_GROUPS } from "@/server/services/search";

const GROUP_META: Record<SearchGroup, { label: string; icon: LucideIcon }> = {
  projects: { label: "Projects", icon: FolderKanban },
  tasks: { label: "Tasks", icon: ListChecks },
  documents: { label: "Documents", icon: FileText },
  observations: { label: "My & organisation observations", icon: NotebookPen },
  shared: { label: "Shared learning", icon: Library },
  themes: { label: "Themes", icon: Shapes },
  ideas: { label: "Improvement ideas", icon: Lightbulb },
  content: { label: "Knowledge, releases & insights", icon: BookOpen },
  sessions: { label: "Live sessions", icon: Radio },
};

/** Results grouped by resource type. Only non-empty groups render; the server already filtered by visibility. */
export function SearchResults({ result }: { result: SearchResult }) {
  const groups = SEARCH_GROUPS.filter((g) => result.groups[g].length > 0);
  return (
    <div className="grid gap-4">
      <nav aria-label="Result groups" className="flex flex-wrap gap-2 text-xs">
        {groups.map((g) => (
          <a key={g} href={`#results-${g}`} className="rounded-full border bg-card px-3 py-1 text-brand-ink hover:border-brand-green/60">
            {GROUP_META[g].label} <span className="tabular-nums text-muted-foreground">({result.groups[g].length})</span>
          </a>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => {
          const { label, icon: Icon } = GROUP_META[g];
          const hits = result.groups[g];
          return (
            <section key={g} id={`results-${g}`} aria-label={label} className="scroll-mt-20 rounded-lg border bg-card">
              <header className="flex items-center gap-2 border-b px-4 py-3">
                <Icon className="size-4 text-success" aria-hidden />
                <h2 className="text-sm font-semibold text-brand-ink">{label}</h2>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {hits.length}
                  {hits.length >= result.perGroupLimit ? "+" : ""}
                </span>
              </header>
              <ul className="divide-y">
                {hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="block px-4 py-2.5 hover:bg-brand-light focus-visible:bg-brand-light focus-visible:outline-none">
                      <span className="block truncate text-sm font-medium text-brand-ink">{h.title}</span>
                      {h.meta.length > 0 && <span className="block truncate text-xs text-muted-foreground">{h.meta.join(" · ")}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {hits.length >= result.perGroupLimit && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  Showing the first {result.perGroupLimit} matches — refine your search to narrow results.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
