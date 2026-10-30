"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldPlus, X } from "lucide-react";
import { PlatformRole } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Field } from "@/components/portal/dashboard/field";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { useApiAction } from "@/components/portal/admin/use-api-action";
import { humanize } from "@/components/portal/admin/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const ROLE_HINTS: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Full platform control, including administrator grants.",
  PORTAL_ADMIN: "Organisations, role grants, configuration and operational controls. No private client content without support access.",
  LEARNING_MODERATOR: "Reviews submitted contributions and reports.",
  CONTENT_PUBLISHER: "Website banners, public content and permitted video audiences.",
  BROADCAST_PUBLISHER: "Configures live sessions and recordings.",
  PRODUCT_OWNER: "Manages improvement ideas and themes; reviews experiments.",
};

export function UserStatusButton({ userId, name, status }: { userId: string; name: string; status: "ACTIVE" | "DEACTIVATED" }) {
  const { busy, run } = useApiAction();
  const deactivate = status === "ACTIVE";
  return (
    <ConfirmButton
      size="sm"
      variant={deactivate ? "destructive" : "outline"}
      disabled={busy}
      title={deactivate ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      description={
        deactivate
          ? "The user is signed out everywhere immediately and cannot sign in until reactivated. Their records are kept."
          : "The user will be able to sign in again with their existing memberships and grants."
      }
      confirmLabel={deactivate ? "Deactivate" : "Reactivate"}
      onConfirm={async () => {
        await run(
          () => apiFetch(`/api/v1/admin/users/${userId}`, { method: "PATCH", body: { status: deactivate ? "DEACTIVATED" : "ACTIVE" } }),
          deactivate ? `${name} was deactivated` : `${name} was reactivated`,
        );
      }}
    >
      {deactivate ? "Deactivate" : "Reactivate"}
    </ConfirmButton>
  );
}

const grantSchema = z.object({
  role: z.enum(PlatformRole, "Choose a role."),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(300, "Keep the reason under 300 characters."),
});
type GrantValues = z.infer<typeof grantSchema>;

export function GrantRoleDialog({ userId, name, roles }: { userId: string; name: string; roles: PlatformRole[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<GrantValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { role: roles[0], reason: "" },
  });
  const selected = useWatch({ control: form.control, name: "role" });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/v1/admin/users/${userId}/grants`, { body: values });
      toast.success(`${humanize(values.role)} granted to ${name}`);
      setOpen(false);
      form.reset({ role: roles[0], reason: "" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) form.setError(field as keyof GrantValues, { message: msgs[0] });
      }
      toast.error(errorMessage(e));
    }
  });

  if (roles.length === 0) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset({ role: roles[0], reason: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldPlus aria-hidden /> Grant role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant a platform role to {name}</DialogTitle>
          <DialogDescription>
            Grants are explicit, separate from workspace membership, and recorded in the audit log with your reason. The user is notified.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`grant-role-${userId}`} label="Role" error={err.role?.message} hint={selected ? ROLE_HINTS[selected] : undefined}>
            <NativeSelect id={`grant-role-${userId}`} aria-invalid={!!err.role} {...form.register("role")}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id={`grant-reason-${userId}`} label="Reason" error={err.reason?.message} hint="For example the ticket or business need. Visible in the audit log.">
            <Textarea id={`grant-reason-${userId}`} rows={3} maxLength={300} aria-invalid={!!err.reason} {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Granting…" : "Grant role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeGrantButton({ grantId, role, name }: { grantId: string; role: string; name: string }) {
  const { busy, run } = useApiAction();
  return (
    <ConfirmButton
      size="xs"
      variant="ghost"
      disabled={busy}
      title={`Revoke ${humanize(role)} from ${name}?`}
      description="The grant is marked revoked (kept for history) and the permission is removed on the user's next request."
      confirmLabel="Revoke"
      onConfirm={async () => {
        await run(() => apiFetch(`/api/v1/admin/grants/${grantId}`, { method: "DELETE" }), `${humanize(role)} revoked`);
      }}
    >
      <X aria-hidden />
      <span className="sr-only">Revoke {humanize(role)}</span>
    </ConfirmButton>
  );
}
