"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email."),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include letters and numbers."),
});
type Values = z.infer<typeof schema>;

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [transport, setTransport] = useState<"resend" | "dev-log" | "unavailable">("dev-log");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await apiFetch<{ verification: { transport: "resend" | "dev-log" | "unavailable" } }>("/api/auth/register", { body: values });
      setEmail(values.email.toLowerCase());
      setTransport(res.verification.transport);
      setStage("verify");
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          form.setError(field as keyof Values, { message: msgs[0] });
        }
      }
      setError(errorMessage(e));
    }
  });

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/email-code/verify", { body: { email, code, purpose: "VERIFY_EMAIL" } });
      toast.success("Email verified");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const res = await apiFetch<{ delivery: { transport: "resend" | "dev-log" | "unavailable" } }>("/api/auth/email-code/request", {
        body: { email, purpose: "VERIFY_EMAIL" },
      });
      setTransport(res.delivery.transport);
      toast.success("A new code was issued");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (stage === "verify") {
    return (
      <form className="grid gap-4" onSubmit={verify}>
        <p className="rounded-md border bg-brand-light px-3 py-2 text-sm">
          {transport === "resend" ? (
            <>Your account was created. The email provider accepted a verification message for <strong>{email}</strong>.</>
          ) : transport === "unavailable" ? (
            <>Your account was created, but email delivery is not configured on this deployment, so no verification code could be sent. Contact an administrator.</>
          ) : (
            <>
              Your account was created. <strong>Development mode:</strong> no email provider is configured, so the
              verification code was written to the server console only.
            </>
          )}
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="verify-code">Verification code</Label>
          <Input id="verify-code" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="h-10" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify email"}
        </Button>
        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={resend}>Issue a new code</Button>
          <Button type="button" variant="ghost" onClick={() => { router.push("/portal/pending"); router.refresh(); }}>Skip for now</Button>
        </div>
      </form>
    );
  }

  const err = form.formState.errors;
  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" aria-invalid={!!err.name} {...form.register("name")} />
        {err.name && <p className="text-xs text-destructive">{err.name.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!err.email} {...form.register("email")} />
        {err.email && <p className="text-xs text-destructive">{err.email.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!err.password} {...form.register("password")} />
        <p className="text-xs text-muted-foreground">At least 12 characters, with letters and numbers. Stored only as an Argon2id hash.</p>
        {err.password && <p className="text-xs text-destructive">{err.password.message}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-10" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
