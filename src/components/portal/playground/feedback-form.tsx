"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MessageSquareText } from "lucide-react";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/portal/dashboard/field";

const rating = z.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5.");
const schema = z.object({
  usefulness: rating,
  clarity: rating,
  trust: rating,
  comment: z.string().max(2000, "Keep comments under 2,000 characters."),
});
type Values = z.infer<typeof schema>;

const QUESTIONS: { key: "usefulness" | "clarity" | "trust"; label: string; help: string }[] = [
  { key: "usefulness", label: "Usefulness", help: "Would this help with a real task in your organisation?" },
  { key: "clarity", label: "Clarity", help: "Were the inputs, result and explanation easy to follow?" },
  { key: "trust", label: "Trust", help: "Did the evidence make the simulated result credible?" },
];
const SCALE = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export function FeedbackForm({ runId, initial }: { runId: string; initial: Values | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(Boolean(initial));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { usefulness: 0, clarity: 0, trust: 0, comment: "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/v1/playground/runs/${encodeURIComponent(runId)}/feedback`, { method: "PUT", body: values });
      toast.success(saved ? "Feedback updated" : "Thank you — feedback recorded");
      setSaved(true);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field in values) form.setError(field as keyof Values, { message: msgs[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-success" aria-hidden /> Structured feedback
        </CardTitle>
        <CardDescription>
          {saved
            ? "You have rated this run. You can update your feedback at any time — one response is kept per run."
            : "Rate this run so product teams can improve the demonstration. One response per run; your comment is visible to Azentio product teams."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={onSubmit} noValidate>
          {QUESTIONS.map((q) => (
            <fieldset key={q.key} className="grid gap-2">
              <legend className="text-sm font-medium text-brand-ink">{q.label}</legend>
              <p className="-mt-1 text-xs text-muted-foreground">{q.help}</p>
              <Controller
                control={form.control}
                name={q.key}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(Number(v))}
                    className="flex flex-wrap gap-x-5 gap-y-2"
                    aria-invalid={!!err[q.key]}
                  >
                    {SCALE.map((label, i) => {
                      const id = `${q.key}-${i + 1}`;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <RadioGroupItem id={id} value={String(i + 1)} />
                          <Label htmlFor={id} className="font-normal">
                            {i + 1} · {label}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              {err[q.key] && (
                <p className="text-xs text-destructive" role="alert">
                  {err[q.key]?.message}
                </p>
              )}
            </fieldset>
          ))}
          <Field id="feedback-comment" label="Comment (optional)" error={err.comment?.message} hint="Do not include real customer data or confidential information.">
            <Textarea id="feedback-comment" rows={4} maxLength={2000} aria-invalid={!!err.comment} {...form.register("comment")} />
          </Field>
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : saved ? "Update feedback" : "Submit feedback"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
