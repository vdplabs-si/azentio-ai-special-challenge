"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Field } from "@/components/portal/dashboard/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "__none__";

const schema = z.object({
  title: z.string().trim().min(5, "Use at least 5 characters.").max(160),
  hypothesis: z.string().trim().min(10, "Describe the hypothesis (at least 10 characters).").max(4000),
  approach: z.string().trim().min(10, "Describe the approach (at least 10 characters).").max(8000),
  offeringId: z.string(),
});
type Values = z.infer<typeof schema>;

export interface EditableExperiment {
  id: string;
  title: string;
  hypothesis: string;
  approach: string;
  offeringId: string | null;
}

/** Submit a new experiment or (author, while SUBMITTED) edit one. */
export function ExperimentFormDialog({
  experiment,
  offerings,
  trigger,
}: {
  experiment?: EditableExperiment;
  offerings: { id: string; name: string }[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: Values = {
    title: experiment?.title ?? "",
    hypothesis: experiment?.hypothesis ?? "",
    approach: experiment?.approach ?? "",
    offeringId: experiment?.offeringId ?? NONE,
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const body = { ...v, offeringId: v.offeringId === NONE ? null : v.offeringId };
    try {
      if (experiment) {
        await apiFetch(`/api/v1/experiments/${experiment.id}`, { method: "PATCH", body });
        toast.success("Experiment updated");
        setOpen(false);
        router.refresh();
      } else {
        const res = await apiFetch<{ experiment: { id: string } }>("/api/v1/experiments", { body });
        toast.success("Experiment submitted for review");
        setOpen(false);
        router.push(`/portal/experiments/${res.experiment.id}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field in defaults) form.setError(field as keyof Values, { message: msgs[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{experiment ? "Edit experiment" : "Submit an experiment"}</DialogTitle>
          <DialogDescription>
            Describe what you want to test and how. Use synthetic or approved data only — never real customer identities or
            confidential client information.
          </DialogDescription>
        </DialogHeader>
        <form id="experiment-form" className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id="ex-title" label="Title" error={err.title?.message}>
            <Input id="ex-title" aria-invalid={!!err.title} {...form.register("title")} />
          </Field>
          <Field id="ex-hypothesis" label="Hypothesis" error={err.hypothesis?.message} hint="What do you expect to happen, and why?">
            <Textarea id="ex-hypothesis" rows={4} aria-invalid={!!err.hypothesis} {...form.register("hypothesis")} />
          </Field>
          <Field id="ex-approach" label="Approach" error={err.approach?.message} hint="Data, method, success criteria and timeline.">
            <Textarea id="ex-approach" rows={6} aria-invalid={!!err.approach} {...form.register("approach")} />
          </Field>
          <Field id="ex-offering" label="Related offering (optional)" error={err.offeringId?.message}>
            <Controller
              control={form.control}
              name="offeringId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ex-offering" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No specific offering</SelectItem>
                    {offerings.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="experiment-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : experiment ? "Save changes" : "Submit experiment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
