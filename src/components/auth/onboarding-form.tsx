"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/memberships/${organisationId}/onboard`, {
        body: { acceptTerms: terms, acknowledgeLearningNotice: notice },
      });
      toast.success("Welcome to your workspace");
      router.push("/portal");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
        <Label htmlFor="terms" className="font-normal leading-snug">I accept the workspace terms.</Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="notice" checked={notice} onCheckedChange={(v) => setNotice(v === true)} />
        <Label htmlFor="notice" className="font-normal leading-snug">
          I understand how sharing works and that joining is not consent to share or train on my organisation&apos;s data.
        </Label>
      </div>
      <Button size="lg" onClick={submit} disabled={!terms || !notice || busy}>
        {busy ? "Joining…" : "Enter workspace"}
      </Button>
    </div>
  );
}
