"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { ConsentFields, EMPTY_CONSENT, validateConsent, type ConsentErrors, type ConsentValues } from "@/components/portal/learning/consent-fields";

export interface ObservationActionFlags {
  edit: boolean;
  amend: boolean;
  submit: boolean;
  resubmit: boolean;
  withdraw: boolean;
  delete: boolean;
  toggleOrgVisible: boolean;
}

function SubmitDialog({ id, resubmit, defaults }: { id: string; resubmit: boolean; defaults?: Partial<ConsentValues> | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<ConsentValues>({
    ...EMPTY_CONSENT,
    attributeOrganisation: defaults?.attributeOrganisation ?? false,
    futureTraining: defaults?.futureTraining ?? false,
  });
  const [errors, setErrors] = useState<ConsentErrors>({});

  async function submit() {
    const r = validateConsent(consent);
    setErrors(r.errors);
    if (!r.consent) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/observations/${id}/submit`, { body: { consent: r.consent } });
      toast.success("Submitted for moderator review. Nothing is shared until a moderator publishes a reviewed copy.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send aria-hidden /> {resubmit ? "Resubmit for review" : "Propose sharing with the community"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{resubmit ? "Resubmit for moderator review" : "Propose sharing with the approved learning community"}</DialogTitle>
          <DialogDescription>
            {resubmit
              ? "Your edits become a new version. A moderator reviews it before anything changes for other participants."
              : "A learning moderator reviews this version and prepares a redacted, de-identified shared copy. Your private source, links and identity are never shown to other organisations."}
          </DialogDescription>
        </DialogHeader>
        <ConsentFields value={consent} onChange={setConsent} errors={errors} idPrefix={`submit-${id}`} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lifecycle actions for the author on the observation detail page. The server re-checks every transition. */
export function ObservationActions({
  id,
  actions,
  orgVisible,
  organisationName,
  hasSharedCopy,
  consentDefaults,
}: {
  id: string;
  actions: ObservationActionFlags;
  orgVisible: boolean;
  organisationName: string;
  hasSharedCopy: boolean;
  consentDefaults?: Partial<ConsentValues> | null;
}) {
  const router = useRouter();
  const [visibleInOrg, setVisibleInOrg] = useState(orgVisible);
  const [savingVisibility, setSavingVisibility] = useState(false);

  async function toggleOrg(next: boolean) {
    setSavingVisibility(true);
    setVisibleInOrg(next);
    try {
      await apiFetch(`/api/v1/observations/${id}/visibility`, { body: { orgVisible: next } });
      toast.success(next ? `Visible to members of ${organisationName}` : "No longer visible to your organisation");
      router.refresh();
    } catch (e) {
      setVisibleInOrg(!next);
      toast.error(errorMessage(e));
    } finally {
      setSavingVisibility(false);
    }
  }

  async function withdraw() {
    try {
      const res = await apiFetch<{ withdrawnSharedCopies: number }>(`/api/v1/observations/${id}/withdraw`, { body: {} });
      toast.success(
        res.withdrawnSharedCopies > 0
          ? "Withdrawn. The shared copy no longer appears in the feed, search, counts, saved searches, exports or AIRA."
          : "Withdrawn. This contribution will not be shared.",
      );
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove() {
    try {
      await apiFetch(`/api/v1/observations/${id}`, { method: "DELETE" });
      toast.success("Draft deleted");
      router.push("/portal/observations");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {actions.submit && <SubmitDialog id={id} resubmit={false} defaults={consentDefaults} />}
        {actions.resubmit && <SubmitDialog id={id} resubmit defaults={consentDefaults} />}
        {(actions.edit || actions.amend) && (
          <Button asChild variant="outline">
            <Link href={`/portal/observations/${id}/edit`}>
              <Pencil aria-hidden /> {actions.amend ? "Amend (new version)" : "Edit"}
            </Link>
          </Button>
        )}
        {actions.withdraw && (
          <ConfirmButton
            title="Withdraw this contribution?"
            confirmLabel="Withdraw now"
            description={
              <span className="grid gap-2 text-left">
                <span>
                  {hasSharedCopy
                    ? "The shared copy stops appearing immediately in the shared feed, search, counts, facets, saved searches, exports and AIRA answers. Production SLA: ≤ 60 seconds."
                    : "The pending review stops and nothing will be shared. Production SLA: ≤ 60 seconds."}
                </span>
                <span>
                  Withdrawal cannot recall material other participants have already viewed or copies they made outside the portal. It does not
                  &ldquo;untrain&rdquo; anything — no training programme is active.
                </span>
                <span>Your private source stays in your workspace. Withdrawal is final for this contribution.</span>
              </span>
            }
            onConfirm={withdraw}
          >
            <Undo2 aria-hidden /> Withdraw
          </ConfirmButton>
        )}
        {actions.delete && (
          <ConfirmButton
            title="Delete this private draft?"
            description="The draft is permanently deleted. It was never shared."
            confirmLabel="Delete draft"
            onConfirm={remove}
            variant="ghost"
          >
            Delete draft
          </ConfirmButton>
        )}
      </div>
      {actions.toggleOrgVisible && (
        <div className="flex items-start gap-3 rounded-md border bg-brand-light/60 p-3">
          <Switch id={`org-visible-${id}`} checked={visibleInOrg} onCheckedChange={toggleOrg} disabled={savingVisibility} />
          <div className="grid gap-0.5">
            <Label htmlFor={`org-visible-${id}`}>Visible within {organisationName}</Label>
            <p className="text-xs text-muted-foreground">
              Lets active members of your organisation read this private source. Separate from community sharing — it never makes anything visible
              to other organisations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
