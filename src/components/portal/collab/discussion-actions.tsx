"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { MessageSquarePlus, Reply, Trash2 } from "lucide-react";
import { ApiError, apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Field } from "@/components/portal/collab/form-bits";
import { MentionTextarea, type MentionPerson } from "@/components/portal/collab/mention-textarea";
import { Composer } from "@/components/portal/collab/comments-thread";
import { PersonAvatar, RelativeTime, RichText } from "@/components/portal/collab/ui";
import { discussionCreateSchema } from "@/components/portal/collab/schemas";

export function NewDiscussionDialog({ projectId, people }: { projectId: string; people: MentionPerson[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = discussionCreateSchema.safeParse({ title, body });
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors;
      setErrors({ title: fe.title?.[0], body: fe.body?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await apiFetch<{ discussion: { id: string } }>(`/api/v1/projects/${projectId}/discussions`, { method: "POST", body: parsed.data });
      toast.success("Discussion started");
      setOpen(false);
      setTitle("");
      setBody("");
      router.push(`/portal/projects/${projectId}?tab=discussions&discussion=${res.discussion.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors({ title: err.fieldErrors.title?.[0], body: err.fieldErrors.body?.[0] });
      } else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MessageSquarePlus aria-hidden /> New discussion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a discussion</DialogTitle>
          <DialogDescription>Visible to everyone who can view this project. Mentioned people are notified.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Title" htmlFor="nd-title" error={errors.title}>
            <Input id="nd-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} aria-invalid={Boolean(errors.title) || undefined} />
          </Field>
          <Field label="Message" htmlFor="nd-body" error={errors.body}>
            <MentionTextarea id="nd-body" value={body} onChange={setBody} people={people} rows={6} maxLength={10000} invalid={Boolean(errors.body)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Posting…" : "Start discussion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDiscussionButton({ discussionId, projectId, title }: { discussionId: string; projectId: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      size="sm"
      title="Delete discussion?"
      description={`“${title}” and all of its replies will be permanently deleted.`}
      confirmLabel="Delete discussion"
      onConfirm={async () => {
        try {
          await apiFetch(`/api/v1/discussions/${discussionId}`, { method: "DELETE" });
          toast.success("Discussion deleted");
          router.push(`/portal/projects/${projectId}?tab=discussions`);
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      <Trash2 aria-hidden /> Delete
    </ConfirmButton>
  );
}

interface ReplyView {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { id: string; name: string; image: string | null };
}

function ReplyItem({ r, onReply }: { r: ReplyView; onReply?: () => void }) {
  return (
    <div className="flex gap-3">
      <PersonAvatar name={r.author.name} image={r.author.image} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-brand-ink">{r.author.name}</span>
          <RelativeTime value={r.createdAt} />
        </div>
        <RichText body={r.body} className="mt-0.5" />
        {onReply && (
          <Button variant="ghost" size="xs" className="mt-1 -ml-2 text-muted-foreground" onClick={onReply}>
            <Reply aria-hidden /> Reply
          </Button>
        )}
      </div>
    </div>
  );
}

/** Threaded replies (one nesting level) with inline reply composers. */
export function DiscussionThread({
  discussionId,
  replies,
  people,
  canReply,
}: {
  discussionId: string;
  replies: (ReplyView & { replies: ReplyView[] })[];
  people: MentionPerson[];
  canReply: boolean;
}) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  async function post(body: string, parentId?: string) {
    await apiFetch(`/api/v1/discussions/${discussionId}/replies`, { method: "POST", body: { body, ...(parentId ? { parentId } : {}) } });
    toast.success("Reply posted");
    setReplyTo(null);
    router.refresh();
    return true;
  }

  return (
    <div className="grid gap-5">
      {replies.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
      <ol className="grid gap-5">
        {replies.map((r) => (
          <li key={r.id} className="grid gap-3">
            <ReplyItem r={r} onReply={canReply ? () => setReplyTo(replyTo === r.id ? null : r.id) : undefined} />
            {(r.replies.length > 0 || replyTo === r.id) && (
              <ol className="ml-11 grid gap-3 border-l pl-4">
                {r.replies.map((c) => (
                  <li key={c.id}>
                    <ReplyItem r={c} />
                  </li>
                ))}
                {replyTo === r.id && (
                  <li>
                    <Composer
                      id={`dr-${r.id}`}
                      people={people}
                      placeholder={`Reply to ${r.author.name}…`}
                      submitLabel="Reply"
                      onSubmit={(body) => post(body, r.id)}
                      onCancel={() => setReplyTo(null)}
                    />
                  </li>
                )}
              </ol>
            )}
          </li>
        ))}
      </ol>
      {canReply ? (
        <div className="rounded-lg border bg-card p-3">
          <Composer id={`dr-root-${discussionId}`} people={people} placeholder="Write a reply…" submitLabel="Post reply" onSubmit={(body) => post(body)} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">You have view-only access to this project.</p>
      )}
    </div>
  );
}
