"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReportStatus, SharedStatus } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { reportDecisionSchema } from "@/server/learning/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Action = "SUSPEND" | "REINSTATE" | "REMOVE" | "DISMISS";

const COPY: Record<Action, { label: string; title: string; description: string; informs: boolean; variant: "default" | "outline" | "destructive" | "secondary" }> = {
  SUSPEND: {
    label: "Suspend during review",
    title: "Temporarily unpublish this shared copy?",
    description: "The copy disappears from the feed, search, exports and AIRA immediately while you investigate. The report stays open.",
    informs: true,
    variant: "secondary",
  },
  REINSTATE: {
    label: "Reinstate",
    title: "Reinstate this shared copy?",
    description: "The copy becomes visible to approved participants again and all open reports on it are resolved as kept.",
    informs: true,
    variant: "default",
  },
  REMOVE: {
    label: "Remove",
    title: "Remove this shared copy?",
    description: "The copy is permanently removed from the learning community and open reports on it are resolved as removed.",
    informs: true,
    variant: "destructive",
  },
  DISMISS: {
    label: "Dismiss report",
    title: "Dismiss this report?",
    description: "The shared copy is unchanged. Only this report is resolved.",
    informs: false,
    variant: "outline",
  },
};

/** Report decisions. The contributor is informed of state changes; the reporter is never revealed. */
export function ReportActions({ reportId, sharedStatus, reportStatus }: { reportId: string; sharedStatus: SharedStatus; reportStatus: ReportStatus }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [publicReason, setPublicReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (reportStatus !== "OPEN") return null;
  const available: Action[] =
    sharedStatus === "PUBLISHED" ? ["SUSPEND", "REMOVE", "DISMISS"] : sharedStatus === "SUSPENDED" ? ["REINSTATE", "REMOVE"] : ["DISMISS"];

  async function submit() {
    if (!action) return;
    const parsed = reportDecisionSchema.safeParse({ action, note, ...(publicReason.trim() ? { publicReason } : {}) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form.");
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/moderation/reports/${reportId}/decision`, { body: parsed.data });
      toast.success(COPY[action].informs ? "Decision recorded and the contributor informed." : "Report dismissed.");
      setAction(null);
      setNote("");
      setPublicReason("");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) setError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((a) => (
          <Button key={a} size="sm" variant={COPY[a].variant} onClick={() => setAction(a)}>
            {COPY[a].label}
          </Button>
        ))}
      </div>
      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[action].title}</DialogTitle>
                <DialogDescription>{COPY[action].description}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor={`note-${reportId}`}>Decision note (moderators only)</Label>
                <Textarea id={`note-${reportId}`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {COPY[action].informs && (
                <div className="grid gap-1.5">
                  <Label htmlFor={`reason-${reportId}`}>Message to the contributor (optional)</Label>
                  <Textarea id={`reason-${reportId}`} rows={2} maxLength={1000} value={publicReason} onChange={(e) => setPublicReason(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    A standard message is used if left blank. Never mention who reported it or details about other clients.
                  </p>
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant={action === "REMOVE" ? "destructive" : "default"} onClick={submit} disabled={busy}>
                  {busy ? "Saving…" : COPY[action].label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
