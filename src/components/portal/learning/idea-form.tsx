"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import type { IdeaStatus, IdeaVisibility, Priority } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ideaCreateSchema, ideaSchema } from "@/server/learning/schemas";
import {
  IDEA_STATUS_EXPLANATIONS,
  IDEA_STATUS_LABELS,
  IDEA_VISIBILITY_LABELS,
  PRIORITY_LABELS,
  THEME_STATUS_LABELS,
} from "@/server/learning/labels";
import { EvidencePicker, type EvidenceOption } from "@/components/portal/learning/evidence-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface IdeaFormValues {
  title: string;
  problemStatement: string;
  proposedOutcome: string;
  offeringId: string;
  themeId: string;
  ownerId: string;
  team: string;
  priority: Priority;
  visibility: IdeaVisibility;
  publicStatusNote: string;
  internalNotes: string;
  status?: IdeaStatus;
}

type Field = keyof IdeaFormValues | "evidenceIds";
type Errors = Partial<Record<Field, string>>;
const NONE = "__none";

/** Create or edit an improvement idea (product owners only; the server enforces it). */
export function IdeaForm({
  ideaId,
  initial,
  initialEvidence,
  offerings,
  themes,
  owners,
}: {
  ideaId?: string;
  initial: IdeaFormValues;
  initialEvidence: EvidenceOption[];
  offerings: { id: string; name: string }[];
  themes: { id: string; title: string; status: keyof typeof THEME_STATUS_LABELS }[];
  owners: { id: string; name: string; title: string | null }[];
}) {
  const router = useRouter();
  const [v, setV] = useState<IdeaFormValues>(initial);
  const [evidence, setEvidence] = useState<EvidenceOption[]>(initialEvidence);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof IdeaFormValues>(k: K, value: IdeaFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...v, themeId: v.themeId || null, evidenceIds: evidence.map((x) => x.id) };
    const parsed = ideaId ? ideaSchema.safeParse(payload) : ideaCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      const next: Errors = {};
      for (const [k, msgs] of Object.entries(fe)) if (msgs?.[0]) next[k as Field] = msgs[0];
      if (!v.offeringId) next.offeringId = "Choose an offering.";
      if (!v.ownerId) next.ownerId = "Choose an owner.";
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const res = ideaId
        ? await apiFetch<{ id: string }>(`/api/v1/ideas/${ideaId}`, { method: "PATCH", body: parsed.data })
        : await apiFetch<{ id: string }>("/api/v1/ideas", { body: parsed.data });
      toast.success(ideaId ? "Idea updated" : "Idea created");
      router.push(`/portal/ideas/${res.id}`);
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
      <p id={`idea-${k}-error`} className="text-xs text-destructive">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: Field) => ({ "aria-invalid": Boolean(errors[k]) || undefined, "aria-describedby": errors[k] ? `idea-${k}-error` : undefined });

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-brand-ink">The idea</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="idea-title">Title</Label>
          <Input id="idea-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={150} {...aria("title")} />
          {err("title")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="idea-problem">Problem statement</Label>
          <Textarea id="idea-problem" rows={4} value={v.problemStatement} onChange={(e) => set("problemStatement", e.target.value)} maxLength={3000} {...aria("problemStatement")} />
          {err("problemStatement")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="idea-outcome">Proposed outcome</Label>
          <Textarea id="idea-outcome" rows={3} value={v.proposedOutcome} onChange={(e) => set("proposedOutcome", e.target.value)} maxLength={3000} {...aria("proposedOutcome")} />
          {err("proposedOutcome")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="idea-offering">Offering</Label>
            <Select value={v.offeringId || undefined} onValueChange={(x) => set("offeringId", x)}>
              <SelectTrigger id="idea-offering" className="w-full" {...aria("offeringId")}>
                <SelectValue placeholder="Choose an offering" />
              </SelectTrigger>
              <SelectContent>
                {offerings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("offeringId")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="idea-theme">Theme (optional)</Label>
            <Select value={v.themeId || NONE} onValueChange={(x) => set("themeId", x === NONE ? "" : x)}>
              <SelectTrigger id="idea-theme" className="w-full" {...aria("themeId")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No theme</SelectItem>
                {themes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                    {t.status !== "PUBLISHED" ? ` (${THEME_STATUS_LABELS[t.status].toLowerCase()})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Participants only see the theme title if the theme is published.</p>
            {err("themeId")}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-brand-ink">Ownership and status</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="idea-owner">Owner</Label>
            <Select value={v.ownerId || undefined} onValueChange={(x) => set("ownerId", x)}>
              <SelectTrigger id="idea-owner" className="w-full" {...aria("ownerId")}>
                <SelectValue placeholder="Choose an Azentio employee" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                    {o.title ? ` — ${o.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The owner&apos;s name and team are shown to participants if the idea is shared.</p>
            {err("ownerId")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="idea-team">Team</Label>
            <Input id="idea-team" value={v.team} onChange={(e) => set("team", e.target.value)} maxLength={80} placeholder="e.g. Lending product" {...aria("team")} />
            {err("team")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="idea-priority">Priority (internal only)</Label>
            <Select value={v.priority} onValueChange={(x) => set("priority", x as Priority)}>
              <SelectTrigger id="idea-priority" className="w-full" {...aria("priority")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("priority")}
          </div>
          {!ideaId && (
            <div className="grid gap-1.5">
              <Label htmlFor="idea-status">Initial status</Label>
              <Select value={v.status ?? "PROPOSED"} onValueChange={(x) => set("status", x as IdeaStatus)}>
                <SelectTrigger id="idea-status" className="w-full" {...aria("status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {IDEA_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{IDEA_STATUS_EXPLANATIONS[v.status ?? "PROPOSED"]}</p>
              {err("status")}
            </div>
          )}
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Visibility</legend>
          <RadioGroup value={v.visibility} onValueChange={(x) => set("visibility", x as IdeaVisibility)}>
            {(Object.keys(IDEA_VISIBILITY_LABELS) as IdeaVisibility[]).map((vis) => (
              <div key={vis} className="flex items-start gap-2">
                <RadioGroupItem id={`idea-vis-${vis}`} value={vis} className="mt-0.5" />
                <Label htmlFor={`idea-vis-${vis}`} className="grid gap-0.5 font-normal">
                  <span className="font-medium">{IDEA_VISIBILITY_LABELS[vis]}</span>
                  <span className="text-xs text-muted-foreground">
                    {vis === "INTERNAL"
                      ? "Only Azentio employees can see this idea."
                      : "Participants see the title, status, offering, owner and team, last update, public status note and published theme title — never internal notes, priority or evidence."}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {err("visibility")}
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="idea-public-note">Public status note</Label>
          <Textarea
            id="idea-public-note"
            rows={3}
            value={v.publicStatusNote}
            onChange={(e) => set("publicStatusNote", e.target.value)}
            maxLength={1000}
            placeholder="Audience-appropriate update for participants. No client names, private material or internal detail."
            {...aria("publicStatusNote")}
          />
          {err("publicStatusNote")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="idea-internal-notes">Internal notes (employees only)</Label>
          <Textarea id="idea-internal-notes" rows={3} value={v.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} maxLength={5000} {...aria("internalNotes")} />
          <p className="text-xs text-muted-foreground">Never shown to clients.</p>
          {err("internalNotes")}
        </div>
      </section>

      <fieldset className="grid gap-3 rounded-lg border bg-card p-5">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Supporting contribution references</legend>
        <p className="text-sm text-muted-foreground">
          Link approved shared copies only. When a shared idea changes status, contributors of linked evidence are notified with the theme and
          decision — never other clients&apos; information.
        </p>
        <EvidencePicker value={evidence} onChange={setEvidence} max={50} invalid={Boolean(errors.evidenceIds)} describedBy={errors.evidenceIds ? "idea-evidenceIds-error" : undefined} />
        {err("evidenceIds")}
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : ideaId ? "Save idea" : "Create idea"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
