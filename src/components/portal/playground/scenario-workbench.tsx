"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, RotateCcw } from "lucide-react";
import type { EngineResult, FieldDescriptor, InputValues } from "@/server/playground/engines/types";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/portal/dashboard/field";
import { Notice } from "@/components/portal/page";
import { RunResults } from "./run-results";
import { FeedbackForm } from "./feedback-form";

export interface WorkbenchRun {
  id: string;
  createdAtLabel: string;
  inputs: InputValues;
  outputs: EngineResult | null;
  feedback: { usefulness: number; clarity: number; trust: number; comment: string } | null;
}

type Raw = Record<string, string>;

const toRaw = (fields: FieldDescriptor[], values: InputValues): Raw =>
  Object.fromEntries(fields.map((f) => [f.key, values[f.key] === undefined ? "" : String(values[f.key])]));

/** Client-side bounds check mirroring the field descriptors; the server re-validates with the engine schema. */
function validate(fields: FieldDescriptor[], raw: Raw) {
  const errors: Record<string, string> = {};
  const data: InputValues = {};
  for (const f of fields) {
    const v = (raw[f.key] ?? "").trim();
    if (f.kind === "select") {
      if (!f.options.some((o) => o.value === v)) errors[f.key] = `Choose a valid ${f.label.toLowerCase()}.`;
      else data[f.key] = v;
      continue;
    }
    const n = v === "" ? Number.NaN : Number(v);
    if (!Number.isFinite(n)) errors[f.key] = `${f.label} must be a number.`;
    else if (n < f.min || n > f.max) errors[f.key] = `Enter a value between ${f.min} and ${f.max}.`;
    else data[f.key] = n;
  }
  return { errors, data };
}

export function ScenarioWorkbench({
  slug,
  fields,
  defaults,
  canRun,
  cannotRunReason,
  initialRun,
}: {
  slug: string;
  fields: FieldDescriptor[];
  defaults: InputValues;
  canRun: boolean;
  cannotRunReason?: string;
  initialRun: WorkbenchRun | null;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState<Raw>(() => toRaw(fields, initialRun?.inputs ?? defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<WorkbenchRun | null>(initialRun);

  const baseline = toRaw(fields, current?.inputs ?? defaults);
  const dirty = fields.some((f) => (raw[f.key] ?? "") !== (baseline[f.key] ?? ""));

  function set(key: string, value: string) {
    setRaw((r) => ({ ...r, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const { errors: errs, data } = validate(fields, raw);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Some inputs are outside the allowed range.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ run: { id: string; inputs: InputValues; outputs: EngineResult } }>(
        `/api/v1/playground/scenarios/${encodeURIComponent(slug)}/runs`,
        { body: { inputs: data } },
      );
      setCurrent({ id: res.run.id, createdAtLabel: "Just now", inputs: res.run.inputs, outputs: res.run.outputs, feedback: null });
      toast.success("Simulation complete");
      router.push(`/portal/playground/${encodeURIComponent(slug)}?run=${encodeURIComponent(res.run.id)}`, { scroll: false });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0] ?? "Invalid value."]));
        if (Object.keys(fe).length) setErrors(fe);
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Synthetic inputs</CardTitle>
          <CardDescription>
            Edit any input within its allowed range, then run the demonstration. Inputs are synthetic sample values — never enter
            real customer, account or transaction data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={run} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const id = `input-${f.key}`;
                const error = errors[f.key];
                if (f.kind === "select") {
                  return (
                    <Field key={f.key} id={id} label={f.label} error={error} hint={f.help}>
                      <Select value={raw[f.key] ?? ""} onValueChange={(v) => set(f.key, v)} disabled={busy}>
                        <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  );
                }
                const range = `${f.min}–${f.max}${f.unit ? ` ${f.unit}` : ""}`;
                return (
                  <Field
                    key={f.key}
                    id={id}
                    label={
                      <>
                        {f.label}
                        {f.unit && <span className="font-normal text-muted-foreground"> ({f.unit})</span>}
                      </>
                    }
                    error={error}
                    hint={f.help ? `${f.help} Range ${range}.` : `Range ${range}.`}
                  >
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={raw[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      aria-invalid={!!error}
                      disabled={busy}
                    />
                  </Field>
                );
              })}
            </div>
            {!canRun && <Notice tone="warning">{cannotRunReason ?? "You cannot run this demonstration right now."}</Notice>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="lg" disabled={!canRun || busy}>
                <Play aria-hidden /> {busy ? "Running…" : current ? "Run again" : "Run simulation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={busy}
                onClick={() => {
                  setRaw(toRaw(fields, defaults));
                  setErrors({});
                }}
              >
                <RotateCcw aria-hidden /> Reset to scenario defaults
              </Button>
              {current && dirty && <p className="text-xs text-warning">Inputs changed — run again to see updated results.</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      {current &&
        (current.outputs ? (
          <RunResults result={current.outputs} runLabel={`Run ${current.createdAtLabel}`} />
        ) : (
          <Notice tone="warning" title="Stored result unavailable">
            The stored output for this run could not be read. Run the scenario again to produce a fresh result.
          </Notice>
        ))}

      {current?.outputs && <FeedbackForm key={current.id} runId={current.id} initial={current.feedback} />}
    </div>
  );
}
