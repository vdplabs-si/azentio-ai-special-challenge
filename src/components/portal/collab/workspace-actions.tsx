"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Copy, LogOut, MailPlus, Plus, Trash2, UserMinus, UserCheck, UserX } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Notice } from "@/components/portal/page";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { applyFieldErrors, Field, useMutation } from "@/components/portal/collab/form-bits";
import {
  invitationCreateSchema,
  slugify,
  workspaceCreateSchema,
  workspaceUpdateSchema,
  type InvitationCreateInput,
  type WorkspaceCreateInput,
} from "@/components/portal/collab/schemas";
import { MEMBERSHIP_ROLE_HINT, MEMBERSHIP_ROLE_LABEL } from "@/components/portal/collab/labels";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface InvitationResultData {
  invitation: { id: string; email: string; role: string; expiresAt: string };
  delivery: { transport: "resend" | "dev-log"; acceptedByProvider: boolean };
  link: string;
}

// ── Invitation link (honest delivery status) ────────────────────────────────────

export function InvitationLinkResult({ result }: { result: InvitationResultData }) {
  const [copied, setCopied] = useState(false);
  const devLog = result.delivery.transport === "dev-log";
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      toast.success("Invitation link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — select the link and copy it.");
    }
  }
  return (
    <div className="grid gap-3">
      <Notice tone={devLog ? "warning" : "info"} title={devLog ? "Email provider not configured — share this link securely" : "Invitation created"}>
        {devLog ? (
          <>No email was sent to {result.invitation.email}. Share this single-use link with them through a trusted channel. It expires in 7 days and only works for that email address.</>
        ) : result.delivery.acceptedByProvider ? (
          <>The email provider accepted the invitation for {result.invitation.email}. Delivery is not guaranteed — you can also share this single-use link securely.</>
        ) : (
          <>The email provider did not accept the message. Share this single-use link with {result.invitation.email} securely.</>
        )}
      </Notice>
      <div className="flex gap-2">
        <Input readOnly value={result.link} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy} aria-label="Copy invitation link">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

// ── New workspace (portal admins) ─────────────────────────────────────────────

const WS_FIELDS = ["name", "slug", "industry", "region", "description", "ownerEmail"] as const;

export function NewWorkspaceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; invitation: InvitationResultData | null; invitationError: string | null } | null>(null);
  const form = useForm<WorkspaceCreateInput>({
    resolver: zodResolver(workspaceCreateSchema),
    defaultValues: { name: "", slug: "", industry: "", region: "", description: "", ownerEmail: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await apiFetch<{ workspace: { id: string; name: string }; invitation: InvitationResultData | null; invitationError: string | null }>(
        "/api/v1/workspaces",
        { method: "POST", body: values },
      );
      toast.success(`Workspace “${res.workspace.name}” created`);
      router.refresh();
      if (res.invitation || res.invitationError) {
        setCreated({ id: res.workspace.id, name: res.workspace.name, invitation: res.invitation, invitationError: res.invitationError });
      } else {
        setOpen(false);
        router.push(`/portal/workspaces/${res.workspace.id}`);
      }
    } catch (e) {
      if (!applyFieldErrors(form, e, WS_FIELDS)) toast.error(errorMessage(e));
    }
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setSlugTouched(false);
      setCreated(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? "Workspace created" : "New client workspace"}</DialogTitle>
          <DialogDescription>
            {created
              ? `“${created.name}” is ready.`
              : "Create a tenant for a client organisation. Its data is isolated from every other workspace."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="grid gap-4">
            {created.invitation && <InvitationLinkResult result={created.invitation} />}
            {created.invitationError && (
              <Notice tone="warning" title="Owner invitation not created">
                {created.invitationError} You can invite an owner from the workspace&apos;s Members tab.
              </Notice>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => router.push(`/portal/workspaces/${created.id}`)}>Open workspace</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field label="Name" htmlFor="ws-name" error={errors.name?.message}>
              <Input
                id="ws-name"
                autoFocus
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name", {
                  onChange: (e) => {
                    if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: form.formState.isSubmitted });
                  },
                })}
              />
            </Field>
            <Field label="Slug" htmlFor="ws-slug" error={errors.slug?.message} hint="Unique, lowercase, e.g. acme-bank.">
              <Input id="ws-slug" aria-invalid={Boolean(errors.slug) || undefined} {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Industry" htmlFor="ws-industry" error={errors.industry?.message}>
                <Input id="ws-industry" placeholder="e.g. Banking" {...form.register("industry")} />
              </Field>
              <Field label="Region" htmlFor="ws-region" error={errors.region?.message}>
                <Input id="ws-region" placeholder="e.g. Middle East" {...form.register("region")} />
              </Field>
            </div>
            <Field label="Description" htmlFor="ws-description" error={errors.description?.message}>
              <Textarea id="ws-description" rows={3} {...form.register("description")} />
            </Field>
            <Field
              label="Owner email (optional)"
              htmlFor="ws-owner"
              error={errors.ownerEmail?.message}
              hint="Sends a single-use OWNER invitation for this workspace."
            >
              <Input id="ws-owner" type="email" autoComplete="off" {...form.register("ownerEmail")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Invite member ──────────────────────────────────────────────────────────────

export function InviteMemberDialog({ workspaceId, roles, workspaceType }: { workspaceId: string; roles: Role[]; workspaceType: "INTERNAL" | "CLIENT" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<InvitationResultData | null>(null);
  const defaultRole: Role = roles.includes("MEMBER") ? "MEMBER" : (roles[0] ?? "MEMBER");
  const form = useForm<InvitationCreateInput>({ resolver: zodResolver(invitationCreateSchema), defaultValues: { email: "", role: defaultRole } });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await apiFetch<InvitationResultData>(`/api/v1/workspaces/${workspaceId}/invitations`, { method: "POST", body: values });
      setResult(res);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["email", "role"])) toast.error(errorMessage(e));
    }
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset({ email: "", role: defaultRole });
      setResult(null);
    }
  }

  if (roles.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <MailPlus aria-hidden /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? "Invitation ready" : "Invite someone to this workspace"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Share the link below if the person did not receive an email."
              : workspaceType === "INTERNAL"
                ? "Employee invitations require a company email address."
                : "They join after signing in with this email and accepting the workspace terms."}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="grid gap-4">
            <InvitationLinkResult result={result} />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResult(null); form.reset({ email: "", role: defaultRole }); }}>
                Invite another
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field label="Email" htmlFor="inv-email" error={errors.email?.message}>
              <Input id="inv-email" type="email" autoFocus autoComplete="off" aria-invalid={Boolean(errors.email) || undefined} {...form.register("email")} />
            </Field>
            <Field label="Role" htmlFor="inv-role" error={errors.role?.message} hint={MEMBERSHIP_ROLE_HINT[role]}>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="inv-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {MEMBERSHIP_ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating invitation…" : "Create invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Member row controls ────────────────────────────────────────────────────────

export function MemberActions({
  workspaceId,
  member,
  roles,
}: {
  workspaceId: string;
  member: { userId: string; name: string; role: Role; status: string };
  /** Roles the actor may assign to this member (server-computed). */
  roles: Role[];
}) {
  const { run, busy } = useMutation();
  const path = `/api/v1/workspaces/${workspaceId}/members/${member.userId}`;
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];
  const canChangeRole = member.status === "ACTIVE" || member.status === "SUSPENDED" || member.status === "INVITED_PENDING_TERMS";
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canChangeRole && (
        <Select
          value={member.role}
          disabled={busy}
          onValueChange={(role) => run(path, { method: "PATCH", body: { role } }, `${member.name} is now ${MEMBERSHIP_ROLE_LABEL[role]?.toLowerCase()}`)}
        >
          <SelectTrigger size="sm" aria-label={`Role for ${member.name}`} className="min-w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {options.map((r) => (
              <SelectItem key={r} value={r} disabled={!roles.includes(r)}>
                {MEMBERSHIP_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {member.status === "ACTIVE" && (
        <ConfirmButton
          variant="outline"
          size="sm"
          disabled={busy}
          title={`Suspend ${member.name}?`}
          description="They immediately lose access to this workspace's projects, documents and announcements until reactivated."
          confirmLabel="Suspend"
          onConfirm={async () => {
            await run(path, { method: "PATCH", body: { status: "SUSPENDED" } }, `${member.name} suspended`);
          }}
        >
          <UserX aria-hidden /> Suspend
        </ConfirmButton>
      )}
      {member.status === "SUSPENDED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(path, { method: "PATCH", body: { status: "ACTIVE" } }, `${member.name} reactivated`)}
        >
          <UserCheck aria-hidden /> Reactivate
        </Button>
      )}
      {member.status !== "REVOKED" && (
        <ConfirmButton
          size="sm"
          disabled={busy}
          title={`Remove ${member.name}?`}
          description="Their membership is revoked and they are removed from this workspace's projects. To restore access they must be invited again."
          confirmLabel="Remove member"
          onConfirm={async () => {
            await run(path, { method: "DELETE" }, `${member.name} removed`);
          }}
        >
          <UserMinus aria-hidden /> Remove
        </ConfirmButton>
      )}
    </div>
  );
}

export function LeaveWorkspaceButton({ workspaceId, userId, workspaceName }: { workspaceId: string; userId: string; workspaceName: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="outline"
      size="sm"
      title={`Leave ${workspaceName}?`}
      description="You will lose access to its projects, documents and announcements. An administrator must invite you again to return."
      confirmLabel="Leave workspace"
      onConfirm={async () => {
        try {
          await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
          toast.success(`You left ${workspaceName}`);
          router.push("/portal/workspaces");
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      <LogOut aria-hidden /> Leave workspace
    </ConfirmButton>
  );
}

export function RevokeInvitationButton({ workspaceId, invitationId, email }: { workspaceId: string; invitationId: string; email: string }) {
  const { run, busy } = useMutation();
  return (
    <ConfirmButton
      size="sm"
      disabled={busy}
      title="Revoke invitation?"
      description={`The link sent to ${email} will stop working immediately.`}
      confirmLabel="Revoke"
      onConfirm={async () => {
        await run(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" }, "Invitation revoked");
      }}
    >
      Revoke
    </ConfirmButton>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────

const settingsSchema = workspaceUpdateSchema.required({ name: true, slug: true, industry: true, region: true, description: true });
type SettingsValues = { name: string; slug: string; industry: string; region: string; description: string };

export function WorkspaceSettingsForm({
  workspace,
  canEditSlug,
}: {
  workspace: { id: string; name: string; slug: string; industry: string | null; region: string | null; description: string | null };
  canEditSlug: boolean;
}) {
  const router = useRouter();
  const defaults: SettingsValues = {
    name: workspace.name,
    slug: workspace.slug,
    industry: workspace.industry ?? "",
    region: workspace.region ?? "",
    description: workspace.description ?? "",
  };
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: defaults });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const body: Partial<SettingsValues> = { ...values };
    if (!canEditSlug) delete body.slug;
    try {
      await apiFetch(`/api/v1/workspaces/${workspace.id}`, { method: "PATCH", body });
      toast.success("Workspace settings saved");
      form.reset(values);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["name", "slug", "industry", "region", "description"])) toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4" noValidate>
      <Field label="Name" htmlFor="set-name" error={errors.name?.message}>
        <Input id="set-name" aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
      </Field>
      <Field label="Slug" htmlFor="set-slug" error={errors.slug?.message} hint={canEditSlug ? "Unique, lowercase identifier." : "Only portal administrators can change the slug."}>
        <Input id="set-slug" readOnly={!canEditSlug} aria-readonly={!canEditSlug || undefined} className={canEditSlug ? undefined : "bg-muted text-muted-foreground"} {...form.register("slug")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry" htmlFor="set-industry" error={errors.industry?.message}>
          <Input id="set-industry" {...form.register("industry")} />
        </Field>
        <Field label="Region" htmlFor="set-region" error={errors.region?.message}>
          <Input id="set-region" {...form.register("region")} />
        </Field>
      </div>
      <Field label="Description" htmlFor="set-description" error={errors.description?.message}>
        <Textarea id="set-description" rows={4} {...form.register("description")} />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** Typed-name confirmation before deleting a client workspace. */
export function DeleteWorkspaceDialog({ workspaceId, name }: { workspaceId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === name.trim();

  async function confirm() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}`, { method: "DELETE", body: { confirmName: typed } });
      toast.success(`Workspace “${name}” deleted`);
      setOpen(false);
      router.push("/portal/workspaces");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden /> Delete workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the workspace with all of its projects, tasks, discussions, documents, announcements,
            invitations and memberships. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Field label={`Type “${name}” to confirm`} htmlFor="del-confirm">
          <Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
