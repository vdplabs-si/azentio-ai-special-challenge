"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { SharedCommentDTO } from "@/server/learning/dto";
import { commentSchema } from "@/server/learning/schemas";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Comments on a shared copy. Authors are never named across tenants: "You", "Azentio team" or
 * "Community participant". Moderators can hide/unhide comments.
 */
export function SharedComments({ id, comments, canModerate }: { id: string; comments: SharedCommentDTO[]; canModerate: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = commentSchema.safeParse({ body });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Write a comment.");
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/shared-observations/${id}/comments`, { body: parsed.data });
      setBody("");
      toast.success("Comment posted");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.body) setError(err.fieldErrors.body[0] ?? null);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setHidden(commentId: string, hidden: boolean) {
    setPending(commentId);
    try {
      await apiFetch(`/api/v1/moderation/comments/${commentId}/hide`, { body: { hidden } });
      toast.success(hidden ? "Comment hidden" : "Comment restored");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="comments-h" className="grid gap-4">
      <h2 id="comments-h" className="flex items-center gap-2 text-lg font-semibold text-brand-ink">
        <MessageSquare className="size-5" aria-hidden /> Discussion
        <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
      </h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Add context, ask a question, or share a related experience.</p>
      ) : (
        <ol className="grid gap-3">
          {comments.map((c) => (
            <li key={c.id} className={cn("rounded-lg border bg-card p-3", c.hidden && "border-dashed bg-muted/60 opacity-70")}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className={cn("font-medium", c.authorLabel === "Azentio team" ? "text-success" : "text-brand-ink")}>{c.authorLabel}</span>
                  {" · "}
                  <time dateTime={c.createdAt}>{formatDateTime(c.createdAt)}</time>
                  {c.hidden && <span className="ml-2 font-medium text-warning">Hidden by a moderator</span>}
                </span>
                {canModerate && (
                  <Button type="button" variant="ghost" size="xs" disabled={pending === c.id} onClick={() => setHidden(c.id, !c.hidden)}>
                    {c.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                    {c.hidden ? "Unhide" : "Hide"}
                  </Button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-brand-ink">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="grid gap-2">
        <Label htmlFor="comment-body">Add a comment</Label>
        <Textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby="comment-hint"
        />
        <p id="comment-hint" className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ??
            "Comments are visible to approved participants. Your name and organisation are never shown to them — and never include customer identities or confidential details."}
        </p>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </section>
  );
}
