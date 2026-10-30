"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { INDUSTRY_OPTIONS, OBSERVATION_TYPE_LABELS, REGION_OPTIONS } from "@/server/learning/labels";
import { SHARED_FILTER_KEYS } from "@/server/learning/schemas";
import { toQueryString } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FeedFilterValues = Partial<Record<(typeof SHARED_FILTER_KEYS)[number], string>>;

const ALL = "__all";

/** Filter bar for the approved shared feed. Filters live in the URL so they can be saved and shared. */
export function FeedFilters({ initial, offerings }: { initial: FeedFilterValues; offerings: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState<FeedFilterValues>(initial);
  const set = (k: keyof FeedFilterValues, value: string) => setV((cur) => ({ ...cur, [k]: value === ALL ? "" : value }));

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const next = v.periodFrom && v.periodTo && v.periodTo < v.periodFrom ? { ...v, periodTo: v.periodFrom } : v;
    setV(next);
    router.push(`/portal/learning${toQueryString({ ...next })}`);
  }

  function clear() {
    setV({});
    router.push("/portal/learning");
  }

  const active = SHARED_FILTER_KEYS.some((k) => initial[k]);

  return (
    <form onSubmit={apply} className="grid gap-3 rounded-lg border bg-card p-4" aria-label="Filter shared learning">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="feed-q" className="sr-only">
            Search title and description
          </Label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="feed-q"
            value={v.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search titles and descriptions"
            className="pl-8"
            maxLength={200}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          {active && (
            <Button type="button" variant="ghost" onClick={clear}>
              <X aria-hidden /> Clear
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect id="feed-type" label="Type" value={v.type} onChange={(x) => set("type", x)}>
          {Object.entries(OBSERVATION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect id="feed-offering" label="Offering" value={v.offering} onChange={(x) => set("offering", x)}>
          {offerings.map((o) => (
            <SelectItem key={o.slug} value={o.slug}>
              {o.name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect id="feed-industry" label="Industry" value={v.industry} onChange={(x) => set("industry", x)}>
          {INDUSTRY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect id="feed-region" label="Region" value={v.region} onChange={(x) => set("region", x)}>
          {REGION_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </FilterSelect>
        <div className="grid gap-1.5">
          <Label htmlFor="feed-topic" className="text-xs text-muted-foreground">
            Topic
          </Label>
          <Input id="feed-topic" value={v.topic ?? ""} onChange={(e) => set("topic", e.target.value.toLowerCase())} placeholder="e.g. covenants" maxLength={40} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="feed-from" className="text-xs text-muted-foreground">
            Observation period from
          </Label>
          <Input id="feed-from" type="date" value={v.periodFrom ?? ""} onChange={(e) => set("periodFrom", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="feed-to" className="text-xs text-muted-foreground">
            Observation period to
          </Label>
          <Input id="feed-to" type="date" value={v.periodTo ?? ""} min={v.periodFrom || undefined} onChange={(e) => set("periodTo", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Periods are coarsened to half-years at publication, so date filters match the start of each shared period.
      </p>
    </form>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Any ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any {label.toLowerCase()}</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
