"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portal/page";
import { PersonAvatar, RelativeTime } from "@/components/portal/collab/ui";
import { describeActivity, type ActivityEntry } from "@/components/portal/collab/activity-text";

/** Audit-backed project activity, newest first, with cursor "load more". */
export function ActivityFeed({ projectId, initial, initialCursor }: { projectId: string; initial: ActivityEntry[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: ActivityEntry[]; nextCursor: string | null }>(`/api/v1/projects/${projectId}/activity?cursor=${encodeURIComponent(cursor)}`);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) return <EmptyState icon={History} title="No activity yet" description="Changes to this project, its tasks, discussions and documents will appear here." />;

  return (
    <div className="grid gap-3">
      <ol className="relative grid gap-0 rounded-lg border bg-card">
        {items.map((e) => (
          <li key={e.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
            <PersonAvatar name={e.actor?.name ?? "System"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-brand-ink">
                <span className="font-medium">{e.actor?.name ?? "System"}</span> {describeActivity(e)}
              </p>
              <RelativeTime value={e.createdAt} />
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {cursor && (
        <Button variant="outline" size="sm" className="justify-self-center" onClick={more} disabled={busy}>
          {busy ? "Loading…" : "Load older activity"}
        </Button>
      )}
    </div>
  );
}
