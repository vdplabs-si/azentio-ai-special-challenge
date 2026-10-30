"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ token, signedInAs, verified }: { token: string; signedInAs: string; verified: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ organisationId: string }>("/api/v1/invitations/accept", { body: { token } });
      router.push(`/portal/onboarding?org=${res.organisationId}`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      <p className="text-sm text-muted-foreground">
        Signed in as <strong className="text-foreground">{signedInAs}</strong>.
      </p>
      {!verified && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Verify your email address first — <Link className="font-medium underline" href="/portal/pending">verify now</Link>.
        </p>
      )}
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="h-10" onClick={accept} disabled={busy || !verified}>
        {busy ? "Accepting…" : "Accept invitation"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Next you&apos;ll review the workspace terms and how sharing works. Joining is not consent to share or train on your
        organisation&apos;s data.
      </p>
    </div>
  );
}
