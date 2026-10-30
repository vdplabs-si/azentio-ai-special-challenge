"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/portal/dashboard/field";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Keep your name under 100 characters."),
  title: z.string().trim().max(120, "Keep your title under 120 characters."),
});
type Details = z.infer<typeof detailsSchema>;

/** Name and job title — PATCH /api/v1/me. */
export function ProfileDetailsForm({ name, title }: { name: string; title: string | null }) {
  const router = useRouter();
  const form = useForm<Details>({ resolver: zodResolver(detailsSchema), defaultValues: { name, title: title ?? "" } });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch("/api/v1/me", { method: "PATCH", body: { name: values.name, title: values.title || null } });
      toast.success("Profile updated");
      form.reset(values);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError)
        for (const [field, msgs] of Object.entries(e.fieldErrors)) if (field in values) form.setError(field as keyof Details, { message: msgs[0] });
      toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field id="profile-name" label="Full name" error={err.name?.message}>
        <Input id="profile-name" autoComplete="name" aria-invalid={!!err.name} {...form.register("name")} />
      </Field>
      <Field id="profile-title" label="Job title" hint="Optional. Shown to colleagues in your workspaces." error={err.title?.message}>
        <Input id="profile-title" autoComplete="organization-title" aria-invalid={!!err.title} {...form.register("title")} />
      </Field>
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

const newPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200, "Keep passwords under 200 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include letters and numbers.");

const passwordSchema = (requireCurrent: boolean) =>
  z
    .object({
      currentPassword: requireCurrent ? z.string().min(1, "Enter your current password.").max(200) : z.string().max(200),
      newPassword,
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
const changePasswordSchema = passwordSchema(true);
const setPasswordSchema = passwordSchema(false);
type PasswordValues = z.infer<typeof changePasswordSchema>;

/** Change (or set, for OAuth/passwordless accounts) the password — PATCH /api/v1/me. */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(hasPassword ? changePasswordSchema : setPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch("/api/v1/me", {
        method: "PATCH",
        body: { newPassword: values.newPassword, ...(hasPassword ? { currentPassword: values.currentPassword } : {}) },
      });
      toast.success(hasPassword ? "Password changed" : "Password set");
      form.reset();
    } catch (e) {
      if (e instanceof ApiError)
        for (const [field, msgs] of Object.entries(e.fieldErrors))
          if (field === "currentPassword" || field === "newPassword") form.setError(field, { message: msgs[0] });
      toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {hasPassword && (
        <Field id="pw-current" label="Current password" error={err.currentPassword?.message}>
          <Input id="pw-current" type="password" autoComplete="current-password" aria-invalid={!!err.currentPassword} {...form.register("currentPassword")} />
        </Field>
      )}
      <Field id="pw-new" label="New password" hint="At least 12 characters, with letters and numbers." error={err.newPassword?.message}>
        <Input id="pw-new" type="password" autoComplete="new-password" aria-invalid={!!err.newPassword} {...form.register("newPassword")} />
      </Field>
      <Field id="pw-confirm" label="Confirm new password" error={err.confirm?.message}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" aria-invalid={!!err.confirm} {...form.register("confirm")} />
      </Field>
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}
