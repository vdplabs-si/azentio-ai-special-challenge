"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Field } from "@/components/portal/dashboard/field";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { useApiAction } from "@/components/portal/admin/use-api-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const schema = z.object({
  organisationId: z.string().min(1, "Choose an organisation."),
  reason: z.string().trim().min(10, "Explain why access is needed (at least 10 characters).").max(500, "Keep it under 500 characters."),
});
type Values = z.infer<typeof schema>;

export function SupportAccessDialog({
  organisations,
  defaultOrganisationId,
  minutes,
  triggerLabel = "Request support access",
  triggerVariant = "default",
}: {
  organisations: { id: string; name: string }[];
  defaultOrganisationId?: string;
  minutes: number;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organisationId: defaultOrganisationId ?? "", reason: "" },
  });
  const err = form.formState.errors;
  const idp = defaultOrganisationId ?? "any";

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch("/api/v1/admin/support-access", { body: values });
      toast.success(`Support access granted for ${minutes} minutes`);
      setOpen(false);
      form.reset({ organisationId: defaultOrganisationId ?? "", reason: "" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) form.setError(field as keyof Values, { message: msgs[0] });
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={triggerVariant === "outline" ? "sm" : "default"} variant={triggerVariant}>
          <KeyRound aria-hidden /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request time-boxed support access</DialogTitle>
          <DialogDescription>
            Being a portal administrator does not give access to a client&apos;s private content. This creates an explicit grant for
            you only, valid for {minutes} minutes. The request and your reason are recorded in the audit log and the client&apos;s
            workspace administrators are notified.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`support-org-${idp}`} label="Client organisation" error={err.organisationId?.message}>
            <NativeSelect id={`support-org-${idp}`} aria-invalid={!!err.organisationId} {...form.register("organisationId")}>
              <option value="">Select an organisation…</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id={`support-reason-${idp}`} label="Reason" error={err.reason?.message} hint="Reference the support ticket or moderation case.">
            <Textarea id={`support-reason-${idp}`} rows={3} maxLength={500} aria-invalid={!!err.reason} {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Requesting…" : `Grant ${minutes}-minute access`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeSupportButton({ grantId, orgName }: { grantId: string; orgName: string }) {
  const { busy, run } = useApiAction();
  return (
    <ConfirmButton
      size="sm"
      disabled={busy}
      title={`End support access to ${orgName}?`}
      description="The grant is revoked immediately and recorded in the audit log."
      confirmLabel="End access"
      onConfirm={async () => {
        await run(() => apiFetch(`/api/v1/admin/support-access/${grantId}`, { method: "DELETE" }), "Support access ended");
      }}
    >
      End access
    </ConfirmButton>
  );
}
