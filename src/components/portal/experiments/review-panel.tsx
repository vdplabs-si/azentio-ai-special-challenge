"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Field } from "@/components/portal/dashboard/field";
import { EXPERIMENT_STATUSES, EXPERIMENT_STATUS_HINT, EXPERIMENT_STATUS_LABEL, type ExperimentStatusValue } from "@/components/portal/experiments/labels";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  status: z.enum(EXPERIMENT_STATUSES),
  feedback: z.string().trim().max(4000, "Keep feedback under 4,000 characters."),
});
type Values = z.infer<typeof schema>;

/** Reviewer controls (PRODUCT_OWNER / PORTAL_ADMIN employees; never the author — enforced server-side). */
export function ReviewPanel({ id, status, feedback }: { id: string; status: ExperimentStatusValue; feedback: string }) {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { status, feedback } });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await apiFetch(`/api/v1/experiments/${id}`, { method: "PATCH", body: v });
      toast.success("Review saved — the author has been notified");
      form.reset(v);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field === "status" || field === "feedback") form.setError(field, { message: msgs[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <Field id="rv-status" label="Status" error={err.status?.message}>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="rv-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EXPERIMENT_STATUS_LABEL[s]} — {EXPERIMENT_STATUS_HINT[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field id="rv-feedback" label="Feedback to the author" error={err.feedback?.message} hint="Visible to the author and other employees.">
        <Textarea id="rv-feedback" rows={6} aria-invalid={!!err.feedback} {...form.register("feedback")} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
        {form.formState.isSubmitting ? "Saving…" : "Save review"}
      </Button>
    </form>
  );
}
