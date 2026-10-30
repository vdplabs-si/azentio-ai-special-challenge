"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import type { SharedDTO } from "@/server/learning/dto";
import { OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EvidenceOption {
  id: string;
  title: string;
  periodLabel?: string;
  region?: string;
  type?: SharedDTO["type"];
}

/**
 * Pick supporting evidence from APPROVED shared copies only (searches the live shared feed API,
 * which applies sharedFeedWhere). The server re-validates every id on save.
 */
export function EvidencePicker({
  value,
  onChange,
  max = 100,
  invalid,
  describedBy,
}: {
  value: EvidenceOption[];
  onChange: (next: EvidenceOption[]) => void;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const inputId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EvidenceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pageSize: "10" });
        if (q.trim()) params.set("q", q.trim());
        const res = await apiFetch<{ items: SharedDTO[] }>(`/api/v1/shared-observations?${params}`, { signal: ctrl.signal });
        setResults(res.items.map((i) => ({ id: i.id, title: i.title, periodLabel: i.periodLabel, region: i.region, type: i.type })));
        setError(null);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const selected = new Set(value.map((v) => v.id));
  const meta = (o: EvidenceOption) => [o.type ? OBSERVATION_TYPE_LABELS[o.type] : null, o.region, o.periodLabel].filter(Boolean).join(" · ");

  return (
    <div className="grid gap-3">
      <div className="rounded-lg border">
        <p className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          Selected evidence ({value.length}/{max}) — approved shared contributions only
        </p>
        {value.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No contributions linked yet.</p>
        ) : (
          <ul className="divide-y">
            {value.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <Link href={`/portal/learning/${o.id}`} target="_blank" className="block truncate text-sm font-medium text-brand-ink hover:underline">
                    {o.title}
                  </Link>
                  {meta(o) && <p className="text-xs text-muted-foreground">{meta(o)}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((v) => v.id !== o.id))} aria-label={`Remove ${o.title}`}>
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          Find approved contributions
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={inputId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shared titles and descriptions"
            className="pl-8"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border" aria-live="polite" aria-busy={loading}>
          {error ? (
            <p className="px-3 py-3 text-sm text-destructive">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{loading ? "Searching…" : "No approved contributions match."}</p>
          ) : (
            <ul className="divide-y">
              {results.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-brand-ink">{o.title}</p>
                    {meta(o) && <p className="text-xs text-muted-foreground">{meta(o)}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selected.has(o.id) || value.length >= max}
                    onClick={() => onChange([...value, o])}
                  >
                    {selected.has(o.id) ? "Added" : (
                      <>
                        <Plus aria-hidden /> Add
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
