"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { REJECT_CATEGORIES, REJECT_CATEGORY_LABELS, sharedCopySchema, LIMITS } from "@/server/learning/schemas";
import { REGION_OPTIONS } from "@/server/learning/labels";
import { scanContribution } from "@/server/learning/sensitive-scan";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { TopicInput } from "@/components/portal/learning/topic-input";
import { SensitiveFlagList } from "@/components/portal/learning/sensitive-flags";

type Action = "PUBLISH" | "RETURN_FOR_CLARIFICATION" | "REJECT";
type CopyErrors = Partial<Record<"title" | "body" | "region" | "topics" | "publicReason" | "acknowledgedFlags", string>>;

export interface SuggestedCopy {
  title: string;
  body: string;
  region: string;
  periodGranularity: "half" | "year";
  topics: string[];
  attributeOrganisation: boolean;
}

/**
 * Moderator workspace: edit the de-identified shared copy (pre-filled from the source) and decide.
 * Only the reviewed fields here are published — never author, tenant, links, notes or flags.
 */
export function ModerationReview({
  observationId,
  version,
  canDecide,
  suggested,
  consentAllowsAttribution,
  organisationName,
  sourceFlagCount,
  periodPreview,
  liveVersion,
}: {
  observationId: string;
  version: number;
  canDecide: boolean;
  suggested: SuggestedCopy;
  consentAllowsAttribution: boolean;
  organisationName: string;
  sourceFlagCount: number;
  periodPreview: { half: string; year: string };
  liveVersion: number | null;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action>("PUBLISH");
  const [copy, setCopy] = useState<SuggestedCopy>(suggested);
  const [acknowledged, setAcknowledged] = useState(false);
  const [publicReason, setPublicReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [category, setCategory] = useState<(typeof REJECT_CATEGORIES)[number]>("DUPLICATE");
  const [errors, setErrors] = useState<CopyErrors>({});
  const [busy, setBusy] = useState(false);

  const deferred = useDeferredValue(copy);
  const copyFlags = useMemo(() => scanContribution({ title: deferred.title, body: deferred.body, topics: deferred.topics }), [deferred]);
  const needsAck = sourceFlagCount > 0 || copyFlags.length > 0;
  const attribution = consentAllowsAttribution && copy.attributeOrganisation ? organisationName : null;

  const set = <K extends keyof SuggestedCopy>(k: K, v: SuggestedCopy[K]) => setCopy((c) => ({ ...c, [k]: v }));

  function validate(): Record<string, unknown> | null {
    const next: CopyErrors = {};
    if (action === "PUBLISH") {
      const parsed = sharedCopySchema.safeParse({ ...copy, attributeOrganisation: consentAllowsAttribution && copy.attributeOrganisation });
      if (!parsed.success) for (const i of parsed.error.issues) next[i.path[0] as keyof CopyErrors] ??= i.message;
      if (needsAck && !acknowledged) next.acknowledgedFlags = "Tick “I reviewed the flagged content” to publish a flagged contribution.";
      setErrors(next);
      if (Object.keys(next).length || !parsed.success) return null;
      return {
        action,
        version,
        sharedCopy: parsed.data,
        acknowledgedFlags: acknowledged,
        ...(publicReason.trim() ? { publicReason: publicReason.trim() } : {}),
        ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
      };
    }
    if (publicReason.trim().length < 10) next.publicReason = "Give the contributor a reason of at least 10 characters.";
    setErrors(next);
    if (Object.keys(next).length) return null;
    return {
      action,
      version,
      publicReason: publicReason.trim(),
      ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
      ...(action === "REJECT" ? { category } : {}),
    };
  }

  async function decide(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/moderation/observations/${observationId}/decision`, { body });
      toast.success(
        action === "PUBLISH" ? "Published. The contributor has been notified." : action === "REJECT" ? "Decision recorded and the contributor notified." : "Returned for clarification.",
      );
      router.push("/portal/moderation");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors;
        const mapped: CopyErrors = {};
        for (const [k, msgs] of Object.entries(fe)) {
          const key = k === "sharedCopy" ? "body" : k;
          mapped[key as keyof CopyErrors] = msgs[0];
        }
        if (Object.keys(mapped).length) setErrors(mapped);
      }
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: keyof CopyErrors) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-lg border border-l-4 border-l-brand-green bg-card p-5" aria-labelledby="copy-heading">
        <div>
          <p className="eyebrow">Proposed shared copy</p>
          <h2 id="copy-heading" className="mt-1 text-base font-semibold text-brand-ink">
            What approved participants will see
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Redact identifying details. Type, offering, industry, evidence type and confidence are copied from the source; the period is coarsened
            automatically. Author, organisation ID, links, consent, notes and scan flags are never published.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="copy-title">Title</Label>
          <Input id="copy-title" value={copy.title} maxLength={LIMITS.titleMax} disabled={!canDecide} onChange={(e) => set("title", e.target.value)} aria-invalid={Boolean(errors.title) || undefined} />
          {err("title")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="copy-body">Body (redacted)</Label>
          <Textarea id="copy-body" rows={10} value={copy.body} maxLength={LIMITS.bodyMax} disabled={!canDecide} onChange={(e) => set("body", e.target.value)} aria-invalid={Boolean(errors.body) || undefined} />
          <p className="text-xs text-muted-foreground">
            {copy.body.length}/{LIMITS.bodyMax} characters
          </p>
          {err("body")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="copy-region">Broad region</Label>
            <Select value={copy.region} onValueChange={(v) => set("region", v)} disabled={!canDecide}>
              <SelectTrigger id="copy-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGION_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("region")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="copy-period">Period shown</Label>
            <Select value={copy.periodGranularity} onValueChange={(v) => set("periodGranularity", v as "half" | "year")} disabled={!canDecide}>
              <SelectTrigger id="copy-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="half">Half-year — {periodPreview.half}</SelectItem>
                <SelectItem value="year">Year — {periodPreview.year}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="copy-topics">Topics</Label>
          {canDecide ? (
            <TopicInput id="copy-topics" value={copy.topics} onChange={(v) => set("topics", v)} invalid={Boolean(errors.topics)} />
          ) : (
            <p className="text-sm">{copy.topics.join(", ") || "—"}</p>
          )}
          {err("topics")}
        </div>
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch
            id="copy-attribution"
            checked={consentAllowsAttribution && copy.attributeOrganisation}
            onCheckedChange={(v) => set("attributeOrganisation", v)}
            disabled={!canDecide || !consentAllowsAttribution}
          />
          <div className="grid gap-0.5">
            <Label htmlFor="copy-attribution">Attribute to {organisationName}</Label>
            <p className="text-xs text-muted-foreground">
              {consentAllowsAttribution
                ? "The contributor opted in to attribution for this version. Approve only if naming the organisation is appropriate."
                : "Not available — the contributor did not consent to attribution for this version. The copy will be unattributed."}
            </p>
            <p className="text-xs">Shown as: {attribution ?? "Unattributed"}</p>
          </div>
        </div>
        <SensitiveFlagList flags={copyFlags} audience="moderator" />
      </section>

      {canDecide && (
        <section className="grid gap-4 rounded-lg border bg-card p-5" aria-labelledby="decision-heading">
          <h2 id="decision-heading" className="text-base font-semibold text-brand-ink">
            Decision on version {version}
          </h2>
          <RadioGroup value={action} onValueChange={(v) => setAction(v as Action)} className="gap-2 sm:grid-cols-3" aria-label="Decision">
            {(
              [
                ["PUBLISH", "Publish shared copy"],
                ["RETURN_FOR_CLARIFICATION", "Return for clarification"],
                ["REJECT", liveVersion ? "Decline amendment" : "Reject"],
              ] as const
            ).map(([v, l]) => (
              <div key={v} className="flex items-center gap-2 rounded-md border p-2.5 has-[[data-state=checked]]:border-brand-navy has-[[data-state=checked]]:bg-brand-light">
                <RadioGroupItem id={`decision-${v}`} value={v} />
                <Label htmlFor={`decision-${v}`} className="font-normal">
                  {l}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {action === "REJECT" && (
            <div className="grid gap-1.5">
              <Label htmlFor="reject-category">Reason category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v as typeof category);
                  if (!publicReason.trim()) setPublicReason(`${REJECT_CATEGORY_LABELS[v as typeof category]}.`);
                }}
              >
                <SelectTrigger id="reject-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {REJECT_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {liveVersion && (
                <p className="text-xs text-muted-foreground">
                  Declining keeps the currently published version (v{liveVersion}) as the shared copy. To remove that copy, use a report decision.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="public-reason">
              Message to the contributor {action === "PUBLISH" ? "(optional)" : "(required)"}
            </Label>
            <Textarea id="public-reason" rows={3} maxLength={1000} value={publicReason} onChange={(e) => setPublicReason(e.target.value)} aria-invalid={Boolean(errors.publicReason) || undefined} />
            <p className="text-xs text-muted-foreground">Shown to the contributor in their timeline and notification.</p>
            {err("publicReason")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="internal-note">Internal note (optional)</Label>
            <Textarea id="internal-note" rows={2} maxLength={2000} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            <p className="text-xs text-muted-foreground">Moderators only — never shown to the contributor or participants.</p>
          </div>

          {action === "PUBLISH" && needsAck && (
            <div className="flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-3">
              <Checkbox id="ack-flags" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" aria-invalid={Boolean(errors.acknowledgedFlags) || undefined} />
              <div className="grid gap-0.5">
                <Label htmlFor="ack-flags">I reviewed the flagged content</Label>
                <p className="text-xs text-muted-foreground">
                  {sourceFlagCount} flag{sourceFlagCount === 1 ? "" : "s"} on the source, {copyFlags.length} remaining in the shared copy. The scan is not a
                  privacy guarantee.
                </p>
                {err("acknowledgedFlags")}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {action === "PUBLISH" ? (
              <ConfirmButton
                variant="default"
                title="Publish this shared copy?"
                confirmLabel="Publish"
                disabled={busy}
                description={
                  liveVersion
                    ? `Approved participants will see only the reviewed fields above. The current shared copy (v${liveVersion}) will be marked superseded.`
                    : "Approved participants will see only the reviewed fields above. The contributor can withdraw it at any time."
                }
                onConfirm={async () => {
                  const body = validate();
                  if (!body) {
                    toast.error("Fix the highlighted fields first.");
                    return;
                  }
                  await decide(body);
                }}
              >
                Publish shared copy
              </ConfirmButton>
            ) : (
              <Button
                disabled={busy}
                variant={action === "REJECT" ? "destructive" : "default"}
                onClick={() => {
                  const body = validate();
                  if (body) void decide(body);
                }}
              >
                {busy ? "Saving…" : action === "REJECT" ? (liveVersion ? "Decline amendment" : "Reject contribution") : "Return for clarification"}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
