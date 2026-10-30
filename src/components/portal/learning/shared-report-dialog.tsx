"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import type { ReportReason } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { reportSchema } from "@/server/learning/schemas";
import { REPORT_REASON_LABELS } from "@/server/learning/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type Errors = Partial<Record<"reason" | "details", string>>;

/** Report a shared copy to moderators. The reporter is never revealed to the contributor. */
export function SharedReportDialog({ id, hasOpenReport }: { id: string; hasOpenReport: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(hasOpenReport);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ reason: reason || undefined, details });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Errors;
        next[k] ??= issue.message;
      }
      return setErrors(next);
    }
    setBusy(true);
    setErrors({});
    try {
      await apiFetch(`/api/v1/shared-observations/${id}/report`, { body: parsed.data });
      toast.success("Report sent to moderators");
      setReported(true);
      setOpen(false);
      setReason("");
      setDetails("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors({ reason: err.fieldErrors.reason?.[0], details: err.fieldErrors.details?.[0] });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (reported) {
    return (
      <p className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
        You reported this contribution. Moderators are reviewing it.
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="w-full justify-start text-muted-foreground">
          <Flag aria-hidden /> Report a concern
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Report this contribution</DialogTitle>
            <DialogDescription>
              Your identity is not shown to the contributor. Don&apos;t include another client&apos;s identity or confidential details in your report.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Reason</legend>
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} aria-invalid={Boolean(errors.reason) || undefined}>
              {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem id={`report-${r}`} value={r} />
                  <Label htmlFor={`report-${r}`} className="font-normal">
                    {REPORT_REASON_LABELS[r]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="report-details">What is the concern?</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              aria-invalid={Boolean(errors.details) || undefined}
              aria-describedby="report-details-hint"
            />
            <p id="report-details-hint" className={errors.details ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {errors.details ?? "Describe the issue in your own words (10–2000 characters)."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
