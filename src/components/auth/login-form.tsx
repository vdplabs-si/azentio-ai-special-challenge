"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Delivery = { transport: "resend" | "dev-log"; acceptedByProvider: boolean };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState<Delivery | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const done = () => {
    router.push(next);
    router.refresh();
  };

  return (
    <Tabs defaultValue="code" className="w-full" onValueChange={() => setError(null)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="code">Email code</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>

      <TabsContent value="code" className="mt-4">
        {!codeSent ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await apiFetch<{ delivery: Delivery }>("/api/auth/email-code/request", { body: { email, purpose: "LOGIN" } });
                setCodeSent(res.delivery);
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="code-email">Work or organisation email</Label>
              <Input id="code-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="h-10" disabled={busy}>
              {busy ? "Sending…" : "Send sign-in code"}
            </Button>
          </form>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await apiFetch("/api/auth/email-code/verify", { body: { email, code, purpose: "LOGIN" } });
                toast.success("Signed in");
                done();
              });
            }}
          >
            <p className="rounded-md border bg-brand-light px-3 py-2 text-sm">
              {codeSent.transport === "resend" ? (
                <>The email provider accepted a message for <strong>{email}</strong>. Enter the 6-digit code from it.</>
              ) : (
                <>
                  <strong>Development mode:</strong> no email provider is configured, so the code was written to the server
                  console only — it was not emailed.
                </>
              )}
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="code">6-digit code</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Button type="submit" size="lg" className="h-10" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Sign in"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setCodeSent(null); setCode(""); }}>
              Use a different email
            </Button>
          </form>
        )}
      </TabsContent>

      <TabsContent value="password" className="mt-4">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await apiFetch("/api/auth/login", { body: { email, password } });
              done();
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="pw-email">Email</Label>
            <Input id="pw-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="h-10" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </TabsContent>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </Tabs>
  );
}
