"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { consentSchema } from "@/server/learning/schemas";

export interface ConsentValues {
  storeAndProcess: boolean;
  publishSharedVersion: boolean;
  attributeOrganisation: boolean;
  futureTraining: boolean;
}
export type ConsentErrors = Partial<Record<keyof ConsentValues, string>>;

export const EMPTY_CONSENT: ConsentValues = {
  storeAndProcess: false,
  publishSharedVersion: false,
  attributeOrganisation: false,
  futureTraining: false,
};

/** Validate with the shared schema; returns parsed consent or field errors. */
export function validateConsent(v: ConsentValues) {
  const parsed = consentSchema.safeParse(v);
  if (parsed.success) return { consent: parsed.data, errors: {} as ConsentErrors };
  const errors: ConsentErrors = {};
  for (const issue of parsed.error.issues) {
    const k = issue.path[0] as keyof ConsentValues;
    errors[k] ??= issue.message;
  }
  return { consent: null, errors };
}

const ITEMS: { key: keyof ConsentValues; label: string; help: string; required: boolean }[] = [
  {
    key: "storeAndProcess",
    label: "(a) Store and process this contribution for review",
    help: "Required. Azentio stores your private source and lets learning moderators review it once you submit.",
    required: true,
  },
  {
    key: "publishSharedVersion",
    label: "(b) Publish a reviewed, de-identified shared version",
    help: "Required to propose community sharing. Only the moderator-reviewed copy is shown to approved participants — never your private source, links or identity.",
    required: true,
  },
  {
    key: "attributeOrganisation",
    label: "(c) Attribute the shared copy to my organisation (optional)",
    help: "Off by default. If you opt in, a moderator must also approve before your organisation's name is shown. Otherwise the copy is unattributed.",
    required: false,
  },
  {
    key: "futureTraining",
    label: "(d) Record my preference about future model training (optional)",
    help: "No training programme is active. This only records your preference for the future; it does not cause any training and is separate from publishing.",
    required: false,
  },
];

/**
 * The four separate permissions (PDF §09). Workspace membership, publishing consent and
 * training consent are not interchangeable — each is recorded on its own.
 */
export function ConsentFields({
  value,
  onChange,
  errors = {},
  idPrefix = "consent",
}: {
  value: ConsentValues;
  onChange: (next: ConsentValues) => void;
  errors?: ConsentErrors;
  idPrefix?: string;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border bg-card p-4">
      <legend className="px-1 text-sm font-semibold text-brand-ink">Sharing permissions for this version</legend>
      <p className="text-xs text-muted-foreground">
        Each permission is recorded separately in your consent history. Joining a workspace is not consent to share, and
        publishing consent is not training consent.
      </p>
      {ITEMS.map((item) => {
        const id = `${idPrefix}-${item.key}`;
        return (
          <div key={item.key} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={value[item.key]}
              onCheckedChange={(v) => onChange({ ...value, [item.key]: v === true })}
              aria-invalid={Boolean(errors[item.key]) || undefined}
              aria-describedby={`${id}-help`}
              className="mt-0.5"
            />
            <div className="grid gap-0.5">
              <Label htmlFor={id} className="font-medium leading-snug">
                {item.label}
                {item.required && <span className="sr-only"> (required)</span>}
              </Label>
              <p id={`${id}-help`} className="text-xs text-muted-foreground">
                {item.help}
              </p>
              {errors[item.key] && <p className="text-xs text-destructive">{errors[item.key]}</p>}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
