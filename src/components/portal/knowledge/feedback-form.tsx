"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Helpful / not helpful + optional comment. One response per user; re-submitting replaces it. */
export function ContentFeedbackForm({
  contentId,
  current,
}: {
  contentId: string;
  current: { helpful: boolean; comment: string | null } | null;
}) {
  const router = useRouter();
  const [helpful, setHelpful] = useState<boolean | null>(current?.helpful ?? null);
  const [comment, setComment] = useState(current?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const tooLong = comment.length > 1000;

  async function submit() {
    if (helpful === null) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/knowledge/${contentId}/feedback`, { method: "PUT", body: { helpful, comment: comment.trim() || null } });
      toast.success(current ? "Feedback updated" : "Thanks for your feedback");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Was this helpful?">
        <Button type="button" variant={helpful === true ? "default" : "outline"} aria-pressed={helpful === true} onClick={() => setHelpful(true)}>
          <ThumbsUp aria-hidden /> Helpful
        </Button>
        <Button type="button" variant={helpful === false ? "default" : "outline"} aria-pressed={helpful === false} onClick={() => setHelpful(false)}>
          <ThumbsDown aria-hidden /> Not helpful
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`fb-${contentId}`}>Comment (optional)</Label>
        <Textarea
          id={`fb-${contentId}`}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={tooLong}
          placeholder="What was missing or especially useful?"
        />
        <p className={tooLong ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{comment.length}/1000</p>
      </div>
      <Button type="button" className="w-fit" onClick={submit} disabled={helpful === null || busy || tooLong}>
        {busy ? "Sending…" : current ? "Update feedback" : "Send feedback"}
      </Button>
      {current && <p className="text-xs text-muted-foreground">You can change your response at any time; only your latest response is kept.</p>}
    </div>
  );
}
