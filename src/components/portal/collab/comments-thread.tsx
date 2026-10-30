"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquare, Reply } from "lucide-react";
import { ApiError, apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { MentionTextarea, type MentionPerson } from "@/components/portal/collab/mention-textarea";
import { PersonAvatar, RelativeTime, RichText } from "@/components/portal/collab/ui";

interface CommentView {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; name: string; image: string | null };
}
interface ThreadView extends CommentView {
  replies: CommentView[];
}

/** Composer used for comments and replies (mentions resolve server-side to people who can view). */
export function Composer({
  id,
  people,
  placeholder,
  submitLabel,
  onSubmit,
  autoFocus,
  onCancel,
}: {
  id: string;
  people: MentionPerson[];
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await onSubmit(body)) setBody("");
    } catch (e) {
      setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2" data-autofocus={autoFocus || undefined}>
      <MentionTextarea id={id} value={body} onChange={setBody} people={people} placeholder={placeholder} maxLength={5000} disabled={busy} onSubmitShortcut={submit} />
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" onClick={submit} disabled={busy || !body.trim()}>
          {busy && <Loader2 className="animate-spin" aria-hidden />} {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function CommentItem({ c, onReply }: { c: CommentView; onReply?: () => void }) {
  return (
    <div className="flex gap-3">
      <PersonAvatar name={c.author.name} image={c.author.image} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-brand-ink">{c.author.name}</span>
          <RelativeTime value={c.createdAt} />
        </div>
        <RichText body={c.body} className="mt-0.5" />
        {onReply && (
          <Button variant="ghost" size="xs" className="mt-1 -ml-2 text-muted-foreground" onClick={onReply}>
            <Reply aria-hidden /> Reply
          </Button>
        )}
      </div>
    </div>
  );
}

/** Task comment thread: top-level comments with one level of replies, loaded from the API. */
export function CommentsThread({ taskId, people, canComment }: { taskId: string; people: MentionPerson[]; canComment: boolean }) {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadView[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({ limit: "50", ...(cursor ? { cursor } : {}) });
        const res = await apiFetch<{ items: ThreadView[]; nextCursor: string | null }>(`/api/v1/tasks/${taskId}/comments?${qs}`);
        setThreads((prev) => (cursor && prev ? [...prev, ...res.items] : res.items));
        setNext(res.nextCursor);
      } catch (e) {
        setLoadError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ items: ThreadView[]; nextCursor: string | null }>(`/api/v1/tasks/${taskId}/comments?limit=50`)
      .then((res) => {
        if (cancelled) return;
        setThreads(res.items);
        setNext(res.nextCursor);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function post(body: string, parentId?: string) {
    await apiFetch(`/api/v1/tasks/${taskId}/comments`, { method: "POST", body: { body, ...(parentId ? { parentId } : {}) } });
    toast.success(parentId ? "Reply posted" : "Comment posted");
    setReplyTo(null);
    await load();
    router.refresh();
    return true;
  }

  return (
    <section aria-labelledby={`comments-${taskId}`} className="grid gap-4">
      <h3 id={`comments-${taskId}`} className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
        <MessageSquare className="size-4" aria-hidden /> Comments
      </h3>
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}{" "}
          <Button variant="link" size="xs" onClick={() => load()}>
            Retry
          </Button>
        </p>
      )}
      {threads === null && !loadError && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {threads?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ol className="grid gap-4">
        {threads?.map((t) => (
          <li key={t.id} className="grid gap-3">
            <CommentItem c={t} onReply={canComment ? () => setReplyTo(replyTo === t.id ? null : t.id) : undefined} />
            {(t.replies.length > 0 || replyTo === t.id) && (
              <ol className="ml-11 grid gap-3 border-l pl-4">
                {t.replies.map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} />
                  </li>
                ))}
                {replyTo === t.id && (
                  <li>
                    <Composer
                      id={`reply-${t.id}`}
                      people={people}
                      placeholder={`Reply to ${t.author.name}…`}
                      submitLabel="Reply"
                      onSubmit={(body) => post(body, t.id)}
                      onCancel={() => setReplyTo(null)}
                      autoFocus
                    />
                  </li>
                )}
              </ol>
            )}
          </li>
        ))}
      </ol>
      {next && (
        <Button variant="outline" size="sm" onClick={() => load(next)} disabled={loading}>
          {loading ? "Loading…" : "Load more comments"}
        </Button>
      )}
      {canComment ? (
        <Composer id={`comment-${taskId}`} people={people} placeholder="Write a comment…" submitLabel="Comment" onSubmit={(body) => post(body)} />
      ) : (
        <p className="text-xs text-muted-foreground">You have view-only access to this project.</p>
      )}
    </section>
  );
}
