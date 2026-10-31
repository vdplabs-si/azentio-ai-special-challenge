"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { savedSearchSchema } from "@/server/learning/schemas";
import { toQueryString } from "@/components/portal/learning/format";
import type { FeedFilterValues } from "@/components/portal/learning/feed-filters";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SavedSearchView {
  id: string;
  name: string;
  filters: FeedFilterValues;
  liveCount: number;
}

/** Saved searches are stored as filter objects and re-run live (counts reflect withdrawals immediately). */
export function SavedSearches({ items, current, hasFilters }: { items: SavedSearchView[]; current: FeedFilterValues; hasFilters: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, query: current };
    const parsed = savedSearchSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the name.");
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/saved-searches", { body: parsed.data });
      toast.success("Search saved");
      setName("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.name) setError(err.fieldErrors.name[0] ?? null);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/v1/saved-searches/${id}`, { method: "DELETE" });
      toast.success("Saved search deleted");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="saved-searches-h" className="grid gap-3">
      <h3 id="saved-searches-h" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Bookmark className="size-3.5" aria-hidden /> Saved searches
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved searches yet.</p>
      ) : (
        <ul className="grid gap-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent">
              <Link href={`/portal/learning${toQueryString({ ...s.filters })}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                {s.name}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Live result count">
                {s.liveCount}
              </span>
              <ConfirmButton
                variant="ghost"
                size="xs"
                title="Delete saved search?"
                description={`“${s.name}” will be removed. This doesn't affect any shared contributions.`}
                confirmLabel="Delete"
                onConfirm={() => remove(s.id)}
              >
                <Trash2 aria-hidden />
                <span className="sr-only">Delete {s.name}</span>
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      {hasFilters ? (
        <form onSubmit={save} className="grid gap-1.5">
          <Label htmlFor="saved-search-name" className="text-xs">
            Save the current filters
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="saved-search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this search"
              maxLength={80}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "saved-search-error" : undefined}
            />
            <Button type="submit" size="default" variant="outline" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
          {error && (
            <p id="saved-search-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Apply filters to save a search.</p>
      )}
    </section>
  );
}
