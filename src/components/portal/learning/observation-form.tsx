"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ObservationStatus } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import {
  LIMITS,
  latestAllowedDate,
  observationInputSchema,
  type ObservationFormValues,
  type ObservationInput,
} from "@/server/learning/schemas";
import {
  CONFIDENCE_LABELS,
  EVIDENCE_TYPE_LABELS,
  INDUSTRY_OPTIONS,
  OBSERVATION_TYPE_LABELS,
  PRIVACY_PROMPT,
  REGION_OPTIONS,
  SENSITIVE_DISCLAIMER,
} from "@/server/learning/labels";
import { scanContribution } from "@/server/learning/sensitive-scan";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TopicInput } from "@/components/portal/learning/topic-input";
import { SensitiveFlagList } from "@/components/portal/learning/sensitive-flags";
import { ConsentFields, EMPTY_CONSENT, validateConsent, type ConsentErrors, type ConsentValues } from "@/components/portal/learning/consent-fields";

type Mode = "create" | "edit" | "amend";
type SharingChoice = "private" | "org" | "community";
const NONE = "__none";

function Field({ id, label, error, hint, children, className }: { id: string; label: string; error?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ? `grid gap-1.5 ${className}` : "grid gap-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function LinkListInput({ value, onChange, errors }: { value: string[]; onChange: (v: string[]) => void; errors: (string | undefined)[] }) {
  return (
    <div className="grid gap-2">
      {value.map((link, i) => (
        <div key={i} className="grid gap-1">
          <div className="flex gap-2">
            <Input
              id={`obs-link-${i}`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={link}
              aria-label={`Supporting link ${i + 1}`}
              aria-invalid={Boolean(errors[i]) || undefined}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          </div>
          {errors[i] && <p className="text-xs text-destructive">{errors[i]}</p>}
        </div>
      ))}
      {value.length < LIMITS.linksMax && (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...value, ""])}>
          <Plus aria-hidden /> Add link
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Up to {LIMITS.linksMax} https links (file attachments are not supported). Links stay with your private source and are never
        copied to the shared version.
      </p>
    </div>
  );
}

/**
 * Structured contribution form (PDF §07) for create, edit (DRAFT/RETURNED) and amend (PUBLISHED).
 * Validates with the same zod schema as the server. Saving never shares.
 */
export function ObservationForm({
  mode,
  observationId,
  status,
  initial,
  offerings,
  organisationName,
  initialConsent,
}: {
  mode: Mode;
  observationId?: string;
  status?: ObservationStatus;
  initial?: Partial<ObservationFormValues>;
  offerings: { id: string; name: string }[];
  organisationName: string;
  initialConsent?: Partial<ConsentValues> | null;
}) {
  const router = useRouter();
  const isReturned = mode === "edit" && status === "RETURNED";
  const offersChoice = mode === "create" || (mode === "edit" && status === "DRAFT");
  const [choice, setChoice] = useState<SharingChoice>(initial?.orgVisible ? "org" : "private");
  const [consent, setConsent] = useState<ConsentValues>({
    ...EMPTY_CONSENT,
    attributeOrganisation: initialConsent?.attributeOrganisation ?? false,
    futureTraining: initialConsent?.futureTraining ?? false,
  });
  const [consentErrors, setConsentErrors] = useState<ConsentErrors>({});
  const [intent, setIntent] = useState<"save" | "submit">("save");

  const form = useForm<ObservationFormValues, unknown, ObservationInput>({
    resolver: zodResolver(observationInputSchema),
    defaultValues: {
      title: "",
      body: "",
      offeringId: null,
      periodStart: "",
      periodEnd: "",
      topics: [],
      links: [],
      orgVisible: false,
      ...initial,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const [title, body, topics, links] = useWatch({ control: form.control, name: ["title", "body", "topics", "links"] });
  const deferred = useDeferredValue({ title, body, topics, links });
  const flags = useMemo(
    () => scanContribution({ title: deferred.title ?? "", body: deferred.body ?? "", topics: deferred.topics ?? [], links: deferred.links ?? [] }),
    [deferred],
  );

  const showConsent = mode === "amend" || isReturned || (offersChoice && choice === "community");
  const maxDate = latestAllowedDate().slice(0, 10);

  function selectChoice(next: SharingChoice) {
    setChoice(next);
    if (next === "private") form.setValue("orgVisible", false);
    if (next === "org") form.setValue("orgVisible", true);
  }

  async function onValid(values: ObservationInput, action: "save" | "submit") {
    const wantsSubmit = action === "submit";
    let parsedConsent: ReturnType<typeof validateConsent>["consent"] = null;
    if (wantsSubmit || mode === "amend") {
      const r = validateConsent(consent);
      setConsentErrors(r.errors);
      if (!r.consent) {
        toast.error("Confirm the required sharing permissions (a) and (b) first.");
        return;
      }
      parsedConsent = r.consent;
    }
    const payload = { ...values, offeringId: values.offeringId || null };
    try {
      let id = observationId;
      let newVersion = false;
      if (mode === "create") {
        const res = await apiFetch<{ id: string }>("/api/v1/observations", { body: payload });
        id = res.id;
      } else {
        const res = await apiFetch<{ newVersion: boolean }>(`/api/v1/observations/${id}`, {
          method: "PATCH",
          body: mode === "amend" ? { ...payload, consent: parsedConsent } : payload,
        });
        newVersion = res.newVersion;
      }
      if (wantsSubmit && mode !== "amend") {
        try {
          await apiFetch(`/api/v1/observations/${id}/submit`, { body: { consent: parsedConsent } });
          toast.success("Submitted for moderator review. Nothing is shared until a moderator publishes a reviewed copy.");
        } catch (e) {
          toast.error(`Saved privately, but the submission failed: ${errorMessage(e)}`);
        }
      } else if (mode === "amend" && !newVersion) {
        toast.info("No material changes — nothing was resubmitted and your published copy is unchanged.");
      } else if (mode === "amend") {
        toast.success("Amendment submitted for review. Your published copy stays as-is until a moderator approves the new version.");
      } else {
        toast.success("Saved privately — nothing was shared.");
      }
      router.push(`/portal/observations/${id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field === "consent") setConsentErrors({ storeAndProcess: msgs[0] });
          else form.setError(field as FieldPath<ObservationFormValues>, { message: msgs[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  }

  const submitWith = (next: "save" | "submit") => () => {
    setIntent(next);
    void form.handleSubmit((values) => onValid(values, next), () => toast.error("Please fix the highlighted fields."))();
  };

  const linkErrors = Array.from({ length: LIMITS.linksMax }, (_, i) => (errors.links as unknown as { message?: string }[] | undefined)?.[i]?.message);

  return (
    <form className="grid gap-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <div role="note" className="flex gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm text-brand-ink">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-semibold">Before you write: keep restricted information out</p>
          <p className="mt-1 leading-relaxed">{PRIVACY_PROMPT} Describe patterns, not people or deals.</p>
          <p className="mt-1 text-xs font-medium">{SENSITIVE_DISCLAIMER}</p>
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border border-l-4 border-l-brand-navy bg-card p-5">
        <h2 className="text-base font-semibold text-brand-ink">Contribution</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Field id="obs-type" label="Type" error={errors.type?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="obs-type" className="w-full" aria-invalid={Boolean(errors.type) || undefined}>
                    <SelectValue placeholder="Choose a contribution type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OBSERVATION_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="offeringId"
            render={({ field }) => (
              <Field id="obs-offering" label="Offering (optional)" error={errors.offeringId?.message}>
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                  <SelectTrigger id="obs-offering" className="w-full">
                    <SelectValue placeholder="Not specific to an offering" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specific to an offering</SelectItem>
                    {offerings.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <Field id="obs-title" label="Title" error={errors.title?.message} hint={`${LIMITS.titleMin}–${LIMITS.titleMax} characters. Summarise the pattern, not a customer.`}>
          <Input id="obs-title" maxLength={LIMITS.titleMax} aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
        </Field>

        <Field
          id="obs-body"
          label="Description"
          error={errors.body?.message}
          hint={`${(body ?? "").length}/${LIMITS.bodyMax} characters (minimum ${LIMITS.bodyMin}).`}
        >
          <Textarea id="obs-body" rows={8} maxLength={LIMITS.bodyMax} aria-invalid={Boolean(errors.body) || undefined} {...form.register("body")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="industry"
            render={({ field }) => (
              <Field id="obs-industry" label="Industry" error={errors.industry?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="obs-industry" className="w-full" aria-invalid={Boolean(errors.industry) || undefined}>
                    <SelectValue placeholder="Choose an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="region"
            render={({ field }) => (
              <Field id="obs-region" label="Broad region" error={errors.region?.message} hint="Use a broad region — avoid naming cities or institutions.">
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="obs-region" className="w-full" aria-invalid={Boolean(errors.region) || undefined}>
                    <SelectValue placeholder="Choose a region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Field id="obs-start" label="Observation period start" error={errors.periodStart?.message}>
            <Input id="obs-start" type="date" max={maxDate} aria-invalid={Boolean(errors.periodStart) || undefined} {...form.register("periodStart")} />
          </Field>
          <Field id="obs-end" label="Observation period end" error={errors.periodEnd?.message} hint="On or after the start; not in the future.">
            <Input id="obs-end" type="date" max={maxDate} aria-invalid={Boolean(errors.periodEnd) || undefined} {...form.register("periodEnd")} />
          </Field>
          <Controller
            control={form.control}
            name="evidenceType"
            render={({ field }) => (
              <Field id="obs-evidence" label="Evidence type" error={errors.evidenceType?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="obs-evidence" className="w-full" aria-invalid={Boolean(errors.evidenceType) || undefined}>
                    <SelectValue placeholder="How do you know?" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVIDENCE_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="confidence"
            render={({ field }) => (
              <Field id="obs-confidence" label="Confidence" error={errors.confidence?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="obs-confidence" className="w-full" aria-invalid={Boolean(errors.confidence) || undefined}>
                    <SelectValue placeholder="How confident are you?" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONFIDENCE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="topics"
          render={({ field }) => (
            <div className="grid gap-1.5">
              <Label htmlFor="obs-topics">Topics (optional)</Label>
              <TopicInput id="obs-topics" value={field.value ?? []} onChange={field.onChange} invalid={Boolean(errors.topics)} />
              {errors.topics && <p className="text-xs text-destructive">{errors.topics.message ?? "Check your topics."}</p>}
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="links"
          render={({ field }) => (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Supporting links (optional)</p>
              <LinkListInput value={field.value ?? []} onChange={field.onChange} errors={linkErrors} />
              {errors.links?.message && <p className="text-xs text-destructive">{errors.links.message}</p>}
            </div>
          )}
        />

        <SensitiveFlagList flags={flags} audience="author" />
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">Who can see this?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything starts as a private draft. Broadening visibility always needs your explicit choice, and sharing beyond{" "}
            {organisationName} also needs moderator review.
          </p>
        </div>

        {offersChoice ? (
          <RadioGroup value={choice} onValueChange={(v) => selectChoice(v as SharingChoice)} aria-label="Sharing choice" className="gap-3">
            {(
              [
                ["private", "Private to me (default)", "Only you can see it. Saving never shares."],
                ["org", "Within my organisation", `Read-only to active members of ${organisationName}. No moderation, and never shown outside your organisation.`],
                [
                  "community",
                  "Propose sharing with the approved learning community",
                  "Submits this version for moderator review. A moderator prepares a redacted, de-identified shared copy; only that copy is shown to approved participants. Needs permissions (a) and (b) below.",
                ],
              ] as const
            ).map(([value, label, help]) => (
              <div key={value} className="flex items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-brand-navy has-[[data-state=checked]]:bg-brand-light">
                <RadioGroupItem id={`share-${value}`} value={value} className="mt-0.5" aria-describedby={`share-${value}-help`} />
                <div className="grid gap-0.5">
                  <Label htmlFor={`share-${value}`} className="font-medium">
                    {label}
                  </Label>
                  <p id={`share-${value}-help`} className="text-xs text-muted-foreground">
                    {help}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        ) : null}

        {(!offersChoice || choice === "community") && (
          <Controller
            control={form.control}
            name="orgVisible"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox id="obs-org-visible" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <div className="grid gap-0.5">
                  <Label htmlFor="obs-org-visible" className="font-medium">
                    Also let members of {organisationName} read my private source
                  </Label>
                  <p className="text-xs text-muted-foreground">Optional and separate from community sharing. Other organisations never see your private source.</p>
                </div>
              </div>
            )}
          />
        )}

        {mode === "amend" && (
          <p className="rounded-md border border-brand-navy/15 bg-brand-light px-3 py-2 text-sm">
            This contribution is published. Saving a material change creates a <strong>new version</strong> that goes back to moderator
            review. Your currently published shared copy stays exactly as it is until a moderator publishes the new version — the audience is
            never widened silently.
          </p>
        )}
        {isReturned && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            A moderator asked for clarification. Edit freely, then resubmit — resubmission creates a new version and records your permissions
            again.
          </p>
        )}

        {showConsent && <ConsentFields value={consent} onChange={setConsent} errors={consentErrors} />}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {mode === "amend" ? (
          <Button type="button" size="lg" disabled={isSubmitting} onClick={submitWith("save")}>
            {isSubmitting ? "Submitting…" : "Submit amended version for review"}
          </Button>
        ) : (
          <>
            {(offersChoice ? choice === "community" : isReturned) && (
              <Button type="button" size="lg" disabled={isSubmitting} onClick={submitWith("submit")}>
                {isSubmitting && intent === "submit" ? "Submitting…" : isReturned ? "Save and resubmit for review" : "Save and submit for review"}
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              variant={(offersChoice ? choice === "community" : isReturned) ? "outline" : "default"}
              disabled={isSubmitting}
              onClick={submitWith("save")}
            >
              {isSubmitting && intent === "save" ? "Saving…" : mode === "create" ? "Save private draft" : "Save changes"}
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
