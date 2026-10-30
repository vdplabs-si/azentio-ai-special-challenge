"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hrefWith } from "@/components/portal/collab/url";

const ALL = "__all";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Label for the "no filter" option; omit to make the filter mandatory (first option is the default). */
  allLabel?: string;
}

/**
 * URL-driven filters: every change updates the query string (resetting the cursor) so the
 * server re-renders with the same visibility rules. Search is debounced.
 */
export function FilterBar({
  filters,
  searchKey = "q",
  searchPlaceholder = "Search…",
  showSearch = true,
}: {
  filters: FilterDef[];
  searchKey?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQ = sp.get(searchKey) ?? "";
  const [q, setQ] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    // Keep the input in sync with back/forward navigation.
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  const push = (overrides: Record<string, string | undefined>) =>
    startTransition(() => router.push(hrefWith(pathname, new URLSearchParams(sp.toString()), { ...overrides, cursor: undefined }), { scroll: false }));

  useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => push({ [searchKey]: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on input changes
  }, [q]);

  const active = filters.some((f) => sp.get(f.key)) || Boolean(urlQ);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      {showSearch && (
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
            maxLength={100}
          />
        </div>
      )}
      {filters.map((f) => {
        const value = sp.get(f.key) ?? (f.allLabel ? ALL : (f.options[0]?.value ?? ALL));
        return (
          <Select key={f.key} value={value} onValueChange={(v) => push({ [f.key]: v === ALL ? undefined : v })}>
            <SelectTrigger aria-label={f.label} className="min-w-36">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent position="popper">
              {f.allLabel && <SelectItem value={ALL}>{f.allLabel}</SelectItem>}
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            push(Object.fromEntries([...filters.map((f) => [f.key, undefined]), [searchKey, undefined]]));
          }}
        >
          <X aria-hidden /> Clear
        </Button>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" />}
    </div>
  );
}
