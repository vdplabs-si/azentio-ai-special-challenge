"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IdeaStatus, IdeaVisibility } from "@/generated/prisma/enums";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ideaStatusSchema } from "@/server/learning/schemas";
import { IDEA_STATUS_EXPLANATIONS, IDEA_STATUS_LABELS } from "@/server/learning/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Record a status change. Shared ideas notify contributors of linked evidence (theme + decision only). */
export function IdeaStatusForm({
  ideaId,
  current,
  publicStatusNote: initialNote,
  visibility,
}: {
  ideaId: string;
  current: IdeaStatus;
  publicStatusNote: string;
  visibility: IdeaVisibility;
}) {
  const router = useRouter();
  const options = (Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).filter((s) => s !== current);
  const [status, setStatus] = useState<IdeaStatus>(options[0]!);
  const [publicStatusNote, setPublicStatusNote] = useState(initialNote);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ideaStatusSchema.safeParse({ status, publicStatusNote, note });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the fields.");
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ notifiedContributors: number }>(`/api/v1/ideas/${ideaId}/status`, { body: parsed.data });
      toast.success(
        res.notifiedContributors > 0
          ? `Status updated · ${res.notifiedContributors} contributor${res.notifiedContributors === 1 ? "" : "s"} notified in-app`
          : "Status updated",
      );
      setNote("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setError(Object.values(err.fieldErrors)[0]?.[0] ?? null);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="idea-new-status">New status</Label>
        <Select value={status} onValueChange={(x) => setStatus(x as IdeaStatus)}>
          <SelectTrigger id="idea-new-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s} value={s}>
                {IDEA_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{IDEA_STATUS_EXPLANATIONS[status]}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="idea-status-public">Public status note (audience-appropriate)</Label>
        <Textarea id="idea-status-public" rows={3} value={publicStatusNote} onChange={(e) => setPublicStatusNote(e.target.value)} maxLength={1000} />
        <p className="text-xs text-muted-foreground">
          {visibility === "SHARED_WITH_PARTICIPANTS"
            ? "Shown to participants and included in the notification to contributors of linked evidence."
            : "Stored for when the idea is shared. This idea is internal, so no one outside Azentio is notified."}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="idea-status-note">Internal rationale (employees only)</Label>
        <Textarea id="idea-status-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Contributors are told only the theme and the decision — never private material, other clients&apos; information or internal notes.
      </p>
      <Button type="submit" disabled={busy || options.length === 0}>
        {busy ? "Saving…" : "Record status change"}
      </Button>
    </form>
  );
}
