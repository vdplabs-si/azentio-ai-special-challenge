"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LifeBuoy, Megaphone, Trash2 } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { applyFieldErrors, Field, useMutation } from "@/components/portal/collab/form-bits";
import {
  announcementCreateSchema,
  ticketCreateSchema,
  TICKET_STATUSES,
  type AnnouncementCreateInput,
  type TicketCreateInput,
} from "@/components/portal/collab/schemas";
import { TICKET_STATUS_LABEL } from "@/components/portal/collab/labels";

// ── Announcements ──────────────────────────────────────────────────────────────

export function NewAnnouncementDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<AnnouncementCreateInput>({ resolver: zodResolver(announcementCreateSchema), defaultValues: { title: "", body: "", pinned: false } });
  const { errors, isSubmitting } = form.formState;
  const pinned = useWatch({ control: form.control, name: "pinned" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/announcements`, { method: "POST", body: values });
      toast.success("Announcement posted to workspace members");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["title", "body", "pinned"])) toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Megaphone aria-hidden /> New announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post an announcement</DialogTitle>
          <DialogDescription>Visible to every active member of this workspace. Members are notified in the portal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Title" htmlFor="ann-title" error={errors.title?.message}>
            <Input id="ann-title" autoFocus aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
          </Field>
          <Field label="Message" htmlFor="ann-body" error={errors.body?.message}>
            <Textarea id="ann-body" rows={6} aria-invalid={Boolean(errors.body) || undefined} {...form.register("body")} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="ann-pinned" checked={pinned} onCheckedChange={(v) => form.setValue("pinned", v === true)} />
            <Label htmlFor="ann-pinned" className="font-normal">Pin to the top of the workspace</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Posting…" : "Post announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAnnouncementButton({ announcementId, title }: { announcementId: string; title: string }) {
  const { run, busy } = useMutation();
  return (
    <ConfirmButton
      variant="ghost"
      size="xs"
      disabled={busy}
      title="Delete announcement?"
      description={`“${title}” will be removed for all members.`}
      confirmLabel="Delete"
      onConfirm={async () => {
        await run(`/api/v1/announcements/${announcementId}`, { method: "DELETE" }, "Announcement deleted");
      }}
    >
      <Trash2 aria-hidden />
      <span className="sr-only">Delete announcement</span>
    </ConfirmButton>
  );
}

// ── Support tickets ────────────────────────────────────────────────────────────

export function NewTicketDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<TicketCreateInput>({ resolver: zodResolver(ticketCreateSchema), defaultValues: { subject: "", body: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/support-tickets`, { method: "POST", body: values });
      toast.success("Ticket submitted to Azentio support");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["subject", "body"])) toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <LifeBuoy aria-hidden /> New ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact Azentio support</DialogTitle>
          <DialogDescription>
            Tickets are visible to members of this workspace and to the Azentio support team. Don&apos;t include passwords or
            other secrets.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Subject" htmlFor="tk-subject" error={errors.subject?.message}>
            <Input id="tk-subject" autoFocus aria-invalid={Boolean(errors.subject) || undefined} {...form.register("subject")} />
          </Field>
          <Field label="Description" htmlFor="tk-body" error={errors.body?.message} hint="What happened, what you expected, and any steps to reproduce.">
            <Textarea id="tk-body" rows={6} aria-invalid={Boolean(errors.body) || undefined} {...form.register("body")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TicketStatusSelect({ ticketId, status, subject }: { ticketId: string; status: string; subject: string }) {
  const { run, busy } = useMutation();
  return (
    <Select
      value={status}
      disabled={busy}
      onValueChange={(next) => run(`/api/v1/support-tickets/${ticketId}`, { method: "PATCH", body: { status: next } }, `Ticket marked ${TICKET_STATUS_LABEL[next]?.toLowerCase()}`)}
    >
      <SelectTrigger size="sm" aria-label={`Status of ${subject}`} className="min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {TICKET_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {TICKET_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
