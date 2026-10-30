"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LogIn, LogOut, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { applyFieldErrors, Field, useMutation } from "@/components/portal/collab/form-bits";
import {
  PROJECT_ROLES,
  PROJECT_STATUSES,
  PROJECT_VISIBILITIES,
  projectCreateSchema,
} from "@/components/portal/collab/schemas";
import {
  PROJECT_ROLE_LABEL,
  PROJECT_STATUS_LABEL,
  VISIBILITY_HINT,
  VISIBILITY_LABEL,
} from "@/components/portal/collab/labels";
import { dateInputToEndIso, dateInputToStartIso, toDateInput } from "@/components/portal/collab/dates";

type ProjectStatus = (typeof PROJECT_STATUSES)[number];
type Visibility = (typeof PROJECT_VISIBILITIES)[number];
type ProjectRole = (typeof PROJECT_ROLES)[number];

const dateField = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date.");
const projectFormSchema = z
  .object({
    workspaceId: z.string().min(1, "Choose a workspace."),
    name: projectCreateSchema.shape.name,
    description: z.string().trim().max(5000, "Keep this under 5000 characters."),
    status: z.enum(PROJECT_STATUSES),
    visibility: z.enum(PROJECT_VISIBILITIES),
    ownerId: z.string(),
    startsAt: dateField,
    dueAt: dateField,
  })
  .refine((v) => !v.startsAt || !v.dueAt || v.startsAt <= v.dueAt, { message: "The due date must be on or after the start date.", path: ["dueAt"] });
type ProjectFormValues = z.infer<typeof projectFormSchema>;
const PROJECT_FORM_FIELDS = ["workspaceId", "name", "description", "status", "visibility", "ownerId", "startsAt", "dueAt"] as const;

function StatusSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: ProjectStatus) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProjectStatus)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {PROJECT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function VisibilitySelect({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: Visibility) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Visibility)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {PROJECT_VISIBILITIES.map((v) => (
          <SelectItem key={v} value={v}>
            {VISIBILITY_LABEL[v]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── New project ────────────────────────────────────────────────────────────────

export function NewProjectDialog({ workspaces, defaultWorkspaceId }: { workspaces: { id: string; name: string }[]; defaultWorkspaceId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: ProjectFormValues = {
    workspaceId: defaultWorkspaceId && workspaces.some((w) => w.id === defaultWorkspaceId) ? defaultWorkspaceId : (workspaces[0]?.id ?? ""),
    name: "",
    description: "",
    status: "PLANNING",
    visibility: "WORKSPACE",
    ownerId: "",
    startsAt: "",
    dueAt: "",
  };
  const form = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: initial });
  const { errors, isSubmitting } = form.formState;
  const visibility = useWatch({ control: form.control, name: "visibility" });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const res = await apiFetch<{ project: { id: string; name: string } }>("/api/v1/projects", {
        method: "POST",
        body: {
          workspaceId: v.workspaceId,
          name: v.name,
          description: v.description,
          status: v.status,
          visibility: v.visibility,
          startsAt: dateInputToStartIso(v.startsAt),
          dueAt: dateInputToEndIso(v.dueAt),
        },
      });
      toast.success(`Project “${res.project.name}” created`);
      setOpen(false);
      form.reset(initial);
      router.push(`/portal/projects/${res.project.id}`);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, PROJECT_FORM_FIELDS)) toast.error(errorMessage(e));
    }
  });

  if (workspaces.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(initial); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>You will be the owner and a manager. You can add members after creating it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Workspace" htmlFor="np-ws" error={errors.workspaceId?.message}>
            <Controller
              control={form.control}
              name="workspaceId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="np-ws" className="w-full">
                    <SelectValue placeholder="Choose a workspace" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Name" htmlFor="np-name" error={errors.name?.message}>
            <Input id="np-name" autoFocus aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          </Field>
          <Field label="Description" htmlFor="np-desc" error={errors.description?.message}>
            <Textarea id="np-desc" rows={3} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="np-status">
              <Controller control={form.control} name="status" render={({ field }) => <StatusSelect id="np-status" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Visibility" htmlFor="np-vis" hint={VISIBILITY_HINT[visibility]}>
              <Controller control={form.control} name="visibility" render={({ field }) => <VisibilitySelect id="np-vis" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Start date" htmlFor="np-start" error={errors.startsAt?.message}>
              <Input id="np-start" type="date" {...form.register("startsAt")} />
            </Field>
            <Field label="Due date" htmlFor="np-due" error={errors.dueAt?.message}>
              <Input id="np-due" type="date" aria-invalid={Boolean(errors.dueAt) || undefined} {...form.register("dueAt")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────

export function ProjectSettingsForm({
  project,
  people,
}: {
  project: {
    id: string;
    organisationId: string;
    name: string;
    description: string;
    status: ProjectStatus;
    visibility: Visibility;
    kind: string;
    ownerId: string;
    startsAt: Date | string | null;
    dueAt: Date | string | null;
  };
  /** Active members of the project's workspace (owner candidates). */
  people: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const defaults: ProjectFormValues = {
    workspaceId: project.organisationId,
    name: project.name,
    description: project.description,
    status: project.status,
    visibility: project.visibility,
    ownerId: project.ownerId,
    startsAt: toDateInput(project.startsAt),
    dueAt: toDateInput(project.dueAt),
  };
  const form = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: defaults });
  const { errors, isSubmitting, isDirty } = form.formState;
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const isTeam = project.kind === "HACKATHON_TEAM";

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await apiFetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        body: {
          name: v.name,
          description: v.description,
          status: v.status,
          ...(isTeam ? {} : { visibility: v.visibility }),
          ownerId: v.ownerId,
          startsAt: dateInputToStartIso(v.startsAt),
          dueAt: dateInputToEndIso(v.dueAt),
        },
      });
      toast.success("Project settings saved");
      form.reset(v);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, PROJECT_FORM_FIELDS)) toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4" noValidate>
      <Field label="Name" htmlFor="ps-name" error={errors.name?.message}>
        <Input id="ps-name" aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
      </Field>
      <Field label="Description" htmlFor="ps-desc" error={errors.description?.message}>
        <Textarea id="ps-desc" rows={4} {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="ps-status">
          <Controller control={form.control} name="status" render={({ field }) => <StatusSelect id="ps-status" value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Visibility" htmlFor="ps-vis" hint={isTeam ? "Hackathon teams are visible to all employees." : VISIBILITY_HINT[visibility]}>
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => <VisibilitySelect id="ps-vis" value={field.value} onChange={field.onChange} disabled={isTeam} />}
          />
        </Field>
        <Field label="Owner" htmlFor="ps-owner" error={errors.ownerId?.message} hint="Must be an active member of this workspace.">
          <Controller
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ps-owner" className="w-full">
                  <SelectValue placeholder="Choose an owner" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-muted-foreground">· {p.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <div />
        <Field label="Start date" htmlFor="ps-start" error={errors.startsAt?.message}>
          <Input id="ps-start" type="date" {...form.register("startsAt")} />
        </Field>
        <Field label="Due date" htmlFor="ps-due" error={errors.dueAt?.message}>
          <Input id="ps-due" type="date" aria-invalid={Boolean(errors.dueAt) || undefined} {...form.register("dueAt")} />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteProjectButton({ projectId, name, redirectTo = "/portal/projects" }: { projectId: string; name: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      title={`Delete “${name}”?`}
      description="All tasks, comments, discussions and documents in this project are permanently deleted. This cannot be undone."
      confirmLabel="Delete project"
      onConfirm={async () => {
        try {
          await apiFetch(`/api/v1/projects/${projectId}`, { method: "DELETE" });
          toast.success("Project deleted");
          router.push(redirectTo);
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      <Trash2 aria-hidden /> Delete project
    </ConfirmButton>
  );
}

// ── Project members ────────────────────────────────────────────────────────────

export function AddProjectMemberDialog({ projectId, candidates }: { projectId: string; candidates: { id: string; name: string; email: string }[] }) {
  const { run, busy } = useMutation();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRole>("CONTRIBUTOR");

  async function submit() {
    if (!userId) return;
    const ok = await run(`/api/v1/projects/${projectId}/members`, { method: "POST", body: { userId, role } }, "Member added");
    if (ok) {
      setOpen(false);
      setUserId("");
      setRole("CONTRIBUTOR");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={candidates.length === 0} title={candidates.length === 0 ? "Every active workspace member is already on this project" : undefined}>
          <UserPlus aria-hidden /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a project member</DialogTitle>
          <DialogDescription>Only active members of this workspace can be added.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Person" htmlFor="pm-user">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="pm-user" className="w-full">
                <SelectValue placeholder="Choose a workspace member" />
              </SelectTrigger>
              <SelectContent position="popper">
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} <span className="text-muted-foreground">· {c.email}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project role" htmlFor="pm-role">
            <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
              <SelectTrigger id="pm-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {PROJECT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {PROJECT_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!userId || busy}>
            {busy ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectMemberActions({
  projectId,
  member,
  canManage,
  isSelf,
  isOwner,
}: {
  projectId: string;
  member: { userId: string; name: string; role: ProjectRole };
  canManage: boolean;
  isSelf: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { run, busy } = useMutation();
  const path = `/api/v1/projects/${projectId}/members/${member.userId}`;
  if (isOwner) return <span className="text-xs text-muted-foreground">Project owner</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canManage && (
        <Select value={member.role} disabled={busy} onValueChange={(role) => run(path, { method: "PATCH", body: { role } }, "Project role updated")}>
          <SelectTrigger size="sm" aria-label={`Project role for ${member.name}`} className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {PROJECT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {PROJECT_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {(canManage || isSelf) && (
        <ConfirmButton
          size="sm"
          variant={isSelf ? "outline" : "destructive"}
          disabled={busy}
          title={isSelf ? "Leave this project?" : `Remove ${member.name}?`}
          description={
            isSelf
              ? "You may lose access if the project is private."
              : "They lose project-member access. If the project is private they will no longer see it."
          }
          confirmLabel={isSelf ? "Leave" : "Remove"}
          onConfirm={async () => {
            const ok = await run(path, { method: "DELETE" }, isSelf ? "You left the project" : `${member.name} removed`);
            if (ok && isSelf) router.refresh();
          }}
        >
          {isSelf ? <LogOut aria-hidden /> : <UserMinus aria-hidden />} {isSelf ? "Leave" : "Remove"}
        </ConfirmButton>
      )}
    </div>
  );
}

// ── Hackathon teams ─────────────────────────────────────────────────────────────

const teamSchema = z.object({ name: projectCreateSchema.shape.name, description: z.string().trim().max(2000, "Keep this under 2000 characters.") });
type TeamValues = z.infer<typeof teamSchema>;

export function CreateTeamDialog({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<TeamValues>({ resolver: zodResolver(teamSchema), defaultValues: { name: "", description: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const res = await apiFetch<{ project: { id: string } }>("/api/v1/projects", {
        method: "POST",
        body: { kind: "HACKATHON_TEAM", hackathonEventId: eventId, name: v.name, description: v.description },
      });
      toast.success("Team space created");
      setOpen(false);
      router.push(`/portal/projects/${res.project.id}`);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["name", "description"])) toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> Create team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a team for {eventName}</DialogTitle>
          <DialogDescription>You become the team owner and manager. Other employees can join from this page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Team name" htmlFor="tm-name" error={errors.name?.message}>
            <Input id="tm-name" autoFocus aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          </Field>
          <Field label="What will you build?" htmlFor="tm-desc" error={errors.description?.message}>
            <Textarea id="tm-desc" rows={4} {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamMembershipButton({ projectId, joined, isOwner, open }: { projectId: string; joined: boolean; isOwner: boolean; open: boolean }) {
  const { run, busy } = useMutation();
  if (isOwner) return null;
  if (joined) {
    return (
      <ConfirmButton
        variant="outline"
        size="sm"
        disabled={busy}
        title="Leave this team?"
        description="You can rejoin while registration is open."
        confirmLabel="Leave team"
        onConfirm={async () => {
          await run(`/api/v1/projects/${projectId}/join`, { method: "DELETE" }, "You left the team");
        }}
      >
        <LogOut aria-hidden /> Leave
      </ConfirmButton>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled={busy || !open} onClick={() => run(`/api/v1/projects/${projectId}/join`, { method: "POST" }, "You joined the team")}>
      <LogIn aria-hidden /> Join
    </Button>
  );
}
