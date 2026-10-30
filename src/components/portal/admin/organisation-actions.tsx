"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PackagePlus, X } from "lucide-react";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Field } from "@/components/portal/dashboard/field";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { useApiAction } from "@/components/portal/admin/use-api-action";
import { fromLocalInput } from "@/components/portal/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function OrgStatusButton({ orgId, name, status }: { orgId: string; name: string; status: "ACTIVE" | "SUSPENDED" }) {
  const { busy, run } = useApiAction();
  const suspend = status === "ACTIVE";
  return (
    <ConfirmButton
      size="sm"
      variant={suspend ? "destructive" : "outline"}
      disabled={busy}
      title={suspend ? `Suspend ${name}?` : `Reactivate ${name}?`}
      description={
        suspend
          ? "Members lose access to this workspace immediately (sessions stay signed in but the workspace stops conferring any authority). Workspace administrators are notified."
          : "Members regain access to this workspace with their existing roles."
      }
      confirmLabel={suspend ? "Suspend" : "Reactivate"}
      onConfirm={async () => {
        await run(
          () => apiFetch(`/api/v1/admin/organisations/${orgId}`, { method: "PATCH", body: { status: suspend ? "SUSPENDED" : "ACTIVE" } }),
          suspend ? `${name} suspended` : `${name} reactivated`,
        );
      }}
    >
      {suspend ? "Suspend" : "Reactivate"}
    </ConfirmButton>
  );
}

const entitlementSchema = z.object({
  offeringId: z.string().min(1, "Choose an offering."),
  expiresOn: z.string().optional(),
});
type EntitlementValues = z.infer<typeof entitlementSchema>;

export function EntitlementDialog({
  orgId,
  orgName,
  offerings,
}: {
  orgId: string;
  orgName: string;
  /** Offerings without an active entitlement for this organisation. */
  offerings: { id: string; name: string; category: string; sandbox: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<EntitlementValues>({
    resolver: zodResolver(entitlementSchema),
    defaultValues: { offeringId: "", expiresOn: "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    // A date-only expiry is inclusive: access ends at the end of that local day.
    const expiresAt = values.expiresOn ? fromLocalInput(`${values.expiresOn}T23:59:59`) : null;
    try {
      await apiFetch(`/api/v1/admin/organisations/${orgId}/entitlements`, { body: { offeringId: values.offeringId, expiresAt } });
      toast.success(`Entitlement granted to ${orgName}`);
      setOpen(false);
      form.reset({ offeringId: "", expiresOn: "" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors;
        if (fe.offeringId) form.setError("offeringId", { message: fe.offeringId[0] });
        if (fe.expiresAt) form.setError("expiresOn", { message: fe.expiresAt[0] });
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={offerings.length === 0}>
          <PackagePlus aria-hidden /> Add entitlement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable an offering for {orgName}</DialogTitle>
          <DialogDescription>
            Entitlements decide which products and Playground demonstrations this client workspace can use. Clients cannot enable products themselves.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`ent-offering-${orgId}`} label="Offering" error={err.offeringId?.message}>
            <NativeSelect id={`ent-offering-${orgId}`} aria-invalid={!!err.offeringId} {...form.register("offeringId")}>
              <option value="">Select an offering…</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.category}
                  {o.sandbox ? " · Playground" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id={`ent-expiry-${orgId}`} label="Expires on (optional)" error={err.expiresOn?.message} hint="Leave empty for no expiry. Access ends at the end of the chosen day.">
            <Input id={`ent-expiry-${orgId}`} type="date" aria-invalid={!!err.expiresOn} {...form.register("expiresOn")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Granting…" : "Grant entitlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeEntitlementButton({ entitlementId, offeringName, orgName }: { entitlementId: string; offeringName: string; orgName: string }) {
  const { busy, run } = useApiAction();
  return (
    <ConfirmButton
      size="xs"
      variant="ghost"
      disabled={busy}
      title={`Remove ${offeringName} from ${orgName}?`}
      description="The workspace immediately loses access to this offering and its Playground scenarios. Workspace administrators are notified."
      confirmLabel="Remove entitlement"
      onConfirm={async () => {
        await run(() => apiFetch(`/api/v1/admin/entitlements/${entitlementId}`, { method: "DELETE" }), `${offeringName} removed`);
      }}
    >
      <X aria-hidden />
      <span className="sr-only">Remove {offeringName}</span>
    </ConfirmButton>
  );
}

export function ApprovalButtons({
  membershipId,
  name,
  eligible,
  ineligibleReason,
}: {
  membershipId: string;
  name: string;
  eligible: boolean;
  ineligibleReason?: string;
}) {
  const { busy, run } = useApiAction();
  const decide = (decision: "approve" | "reject") =>
    run(
      () => apiFetch(`/api/v1/admin/employee-approvals/${membershipId}`, { body: { decision } }),
      decision === "approve" ? `${name} approved` : `${name}'s request rejected`,
    );
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ConfirmButton
        size="sm"
        variant="default"
        disabled={busy || !eligible}
        title={`Approve ${name} as an employee?`}
        description="The membership becomes active, which unlocks employee-only areas (internal Playground, experiments, knowledge). It does not grant any administrator role."
        confirmLabel="Approve"
        onConfirm={async () => {
          await decide("approve");
        }}
      >
        Approve
      </ConfirmButton>
      <ConfirmButton
        size="sm"
        disabled={busy}
        title={`Reject ${name}'s request?`}
        description="The membership is revoked and the user is notified. They would need to request access again."
        confirmLabel="Reject"
        onConfirm={async () => {
          await decide("reject");
        }}
      >
        Reject
      </ConfirmButton>
      {!eligible && ineligibleReason && <p className="w-full text-right text-xs text-muted-foreground">{ineligibleReason}</p>}
    </div>
  );
}
