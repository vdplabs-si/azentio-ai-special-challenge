"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyEmail({ email }: { email: string }) {
  const router = useRouter();
  const [transport, setTransport] = useState<null | "resend" | "dev-log">(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await apiFetch<{ delivery: { transport: "resend" | "dev-log" } }>("/api/auth/email-code/request", {
        body: { email, purpose: "VERIFY_EMAIL" },
      });
      setTransport(res.delivery.transport);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/auth/email-code/verify", { body: { email, code, purpose: "VERIFY_EMAIL" } });
      toast.success("Email verified");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!transport)
    return (
      <Button onClick={send} disabled={busy}>
        {busy ? "Issuing…" : "Send verification code"}
      </Button>
    );

  return (
    <form onSubmit={verify} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {transport === "resend"
          ? `The email provider accepted a message for ${email}.`
          : "Development mode: the code was written to the server console only (no email provider configured)."}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="v-code">6-digit code</Label>
        <Input id="v-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify"}</Button>
    </form>
  );
}
