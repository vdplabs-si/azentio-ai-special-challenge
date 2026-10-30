"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import type { ThemeStatus } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { themeSchema } from "@/server/learning/schemas";
import { THEME_STATUS_LABELS } from "@/server/learning/labels";
import { EvidencePicker, type EvidenceOption } from "@/components/portal/learning/evidence-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ThemeFormValues {
  title: string;
  summary: string;
  limitations: string;
  status: ThemeStatus;
  offeringIds: string[];
}

type Field = keyof ThemeFormValues | "evidenceIds";
type Errors = Partial<Record<Field, string>>;

/** Create or edit a theme. Validated with the shared themeSchema; the server re-validates evidence visibility. */
export function ThemeForm({
  themeId,
  initial,
  initialEvidence,
  offerings,
}: {
  themeId?: string;
  initial: ThemeFormValues;
  initialEvidence: EvidenceOption[];
  offerings: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState<ThemeFormValues>(initial);
  const [evidence, setEvidence] = useState<EvidenceOption[]>(initialEvidence);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ThemeFormValues>(k: K, value: ThemeFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = themeSchema.safeParse({ ...v, evidenceIds: evidence.map((x) => x.id) });
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      const next: Errors = {};
      for (const [k, msgs] of Object.entries(fe)) if (msgs?.[0]) next[k as Field] = msgs[0];
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const res = themeId
        ? await apiFetch<{ id: string }>(`/api/v1/themes/${themeId}`, { method: "PATCH", body: parsed.data })
        : await apiFetch<{ id: string }>("/api/v1/themes", { body: parsed.data });
      toast.success(themeId ? "Theme updated" : "Theme created");
      router.push(`/portal/themes/${res.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        const next: Errors = {};
        for (const [k, msgs] of Object.entries(err.fieldErrors)) next[k as Field] = msgs[0];
        setErrors(next);
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: Field) =>
    errors[k] ? (
      <p id={`theme-${k}-error`} className="text-xs text-destructive">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: Field) => ({ "aria-invalid": Boolean(errors[k]) || undefined, "aria-describedby": errors[k] ? `theme-${k}-error` : undefined });

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="theme-title">Theme title</Label>
          <Input id="theme-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={150} {...aria("title")} />
          {err("title")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="theme-summary">Summary</Label>
          <Textarea id="theme-summary" rows={5} value={v.summary} onChange={(e) => set("summary", e.target.value)} maxLength={3000} {...aria("summary")} />
          <p className="text-xs text-muted-foreground">Describe the pattern in the evidence. Avoid claims of prevalence or causation.</p>
          {err("summary")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="theme-limitations">Limitations</Label>
          <Textarea
            id="theme-limitations"
            rows={3}
            value={v.limitations}
            onChange={(e) => set("limitations", e.target.value)}
            maxLength={3000}
            placeholder="e.g. Small sample, mostly anecdotal evidence, limited to two regions."
            {...aria("limitations")}
          />
          {err("limitations")}
        </div>
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="theme-status">Status</Label>
          <Select value={v.status} onValueChange={(x) => set("status", x as ThemeStatus)}>
            <SelectTrigger id="theme-status" className="w-full" {...aria("status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(THEME_STATUS_LABELS) as ThemeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {THEME_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Only published themes are visible to client participants.</p>
          {err("status")}
        </div>
      </section>

      <fieldset className="grid gap-3 rounded-lg border bg-card p-5">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Relevant offerings</legend>
        {offerings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offerings are available.</p>
        ) : (
          <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
            {offerings.map((o) => {
              const checked = v.offeringIds.includes(o.id);
              return (
                <div key={o.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`theme-off-${o.id}`}
                    checked={checked}
                    onCheckedChange={(c) =>
                      set("offeringIds", c === true ? [...v.offeringIds, o.id] : v.offeringIds.filter((x) => x !== o.id))
                    }
                  />
                  <Label htmlFor={`theme-off-${o.id}`} className="font-normal">
                    {o.name}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
        {err("offeringIds")}
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border bg-card p-5">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Supporting approved contributions</legend>
        <p className="text-sm text-muted-foreground">
          Only published shared copies can be linked. If a contributor withdraws one, it stops counting as evidence immediately.
        </p>
        <EvidencePicker value={evidence} onChange={setEvidence} max={100} invalid={Boolean(errors.evidenceIds)} describedBy={errors.evidenceIds ? "theme-evidenceIds-error" : undefined} />
        {err("evidenceIds")}
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : themeId ? "Save theme" : "Create theme"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
