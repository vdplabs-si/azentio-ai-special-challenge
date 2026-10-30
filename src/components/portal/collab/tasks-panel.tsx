"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Columns3, List, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/portal/page";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { FilterBar } from "@/components/portal/collab/filter-bar";
import { applyFieldErrors, Field, useMutation } from "@/components/portal/collab/form-bits";
import { CommentsThread } from "@/components/portal/collab/comments-thread";
import type { MentionPerson } from "@/components/portal/collab/mention-textarea";
import { DueDate, EnumBadge, Meta, Person, PersonAvatar, PlainText } from "@/components/portal/collab/ui";
import { PRIORITIES, TASK_STATUSES, taskCreateSchema } from "@/components/portal/collab/schemas";
import { PRIORITY_LABEL, PRIORITY_TONE, TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/components/portal/collab/labels";
import { dateInputToEndIso, formatDateTime, toDateInput } from "@/components/portal/collab/dates";
import { hrefWith } from "@/components/portal/collab/url";

type TaskStatus = (typeof TASK_STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

export interface TaskView {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isOverdue: boolean;
  assignee: { id: string; name: string; email: string; image: string | null } | null;
  createdBy: { id: string; name: string };
  _count: { comments: number };
}

const NONE = "__none";

// ── Quick status change ───────────────────────────────────────────────────────

export function TaskStatusSelect({ taskId, status, title, disabled }: { taskId: string; status: TaskStatus; title: string; disabled?: boolean }) {
  const { run, busy } = useMutation();
  return (
    <Select
      value={status}
      disabled={disabled || busy}
      onValueChange={(next) => run(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: { status: next } }, `Moved to ${TASK_STATUS_LABEL[next]}`)}
    >
      <SelectTrigger size="sm" aria-label={`Status of ${title}`} className="min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {TASK_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Create / edit dialog ──────────────────────────────────────────────────────

const taskFormSchema = z.object({
  title: taskCreateSchema.shape.title,
  description: z.string().trim().max(10000, "Keep this under 10000 characters."),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  assigneeId: z.string(),
  dueAt: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date."),
});
type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskFormDialog({
  projectId,
  people,
  task,
  open,
  onOpenChange,
  defaultStatus = "TODO",
}: {
  projectId: string;
  people: MentionPerson[];
  task?: TaskView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TaskStatus;
}) {
  const router = useRouter();
  const values = (): TaskFormValues => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "MEDIUM",
    assigneeId: task?.assignee?.id ?? "",
    dueAt: toDateInput(task?.dueAt ?? null),
  });
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: values() });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(values());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when (re)opening
  }, [open, task?.id]);

  const onSubmit = form.handleSubmit(async (v) => {
    const body = {
      title: v.title,
      description: v.description,
      status: v.status,
      priority: v.priority,
      assigneeId: v.assigneeId || null,
      dueAt: dateInputToEndIso(v.dueAt),
    };
    try {
      if (task) await apiFetch(`/api/v1/tasks/${task.id}`, { method: "PATCH", body });
      else await apiFetch(`/api/v1/projects/${projectId}/tasks`, { method: "POST", body });
      toast.success(task ? "Task updated" : "Task created");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(form, e, ["title", "description", "status", "priority", "assigneeId", "dueAt"])) toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>Assignees must be active workspace members who can view this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Title" htmlFor="tf-title" error={errors.title?.message}>
            <Input id="tf-title" autoFocus aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
          </Field>
          <Field label="Description" htmlFor="tf-desc" error={errors.description?.message}>
            <Textarea id="tf-desc" rows={4} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="tf-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tf-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Priority" htmlFor="tf-priority">
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tf-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Assignee" htmlFor="tf-assignee" error={errors.assigneeId?.message}>
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="tf-assignee" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Due date" htmlFor="tf-due" error={errors.dueAt?.message}>
              <Input id="tf-due" type="date" {...form.register("dueAt")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : task ? "Save task" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail sheet ──────────────────────────────────────────────────────────────

function TaskSheet({
  task,
  open,
  onOpenChange,
  people,
  canContribute,
  onEdit,
}: {
  task: TaskView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: MentionPerson[];
  canContribute: boolean;
  onEdit: () => void;
}) {
  const { run, busy } = useMutation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl data-[side=right]:sm:max-w-xl">
        {task ? (
          <>
            <SheetHeader className="border-b pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <EnumBadge value={task.status} labels={TASK_STATUS_LABEL} tones={TASK_STATUS_TONE} />
                <EnumBadge value={task.priority} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} />
                {task.isOverdue && <span className="text-xs font-semibold text-destructive">Overdue</span>}
              </div>
              <SheetTitle className="pr-8 text-lg text-brand-ink">{task.title}</SheetTitle>
              <SheetDescription>
                Created by {task.createdBy.name} · {formatDateTime(task.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-6 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-4">
                <Meta label="Assignee">
                  {task.assignee ? <Person name={task.assignee.name} image={task.assignee.image} /> : <span className="text-muted-foreground">Unassigned</span>}
                </Meta>
                <Meta label="Due">
                  <DueDate dueAt={task.dueAt} overdue={task.isOverdue} />
                </Meta>
                <Meta label="Status">
                  <TaskStatusSelect taskId={task.id} status={task.status} title={task.title} disabled={!canContribute} />
                </Meta>
                {task.completedAt && <Meta label="Completed">{formatDateTime(task.completedAt)}</Meta>}
              </dl>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-brand-ink">Description</h3>
                {task.description ? <PlainText body={task.description} /> : <p className="text-sm text-muted-foreground">No description.</p>}
              </div>
              {canContribute && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil aria-hidden /> Edit task
                  </Button>
                  <ConfirmButton
                    size="sm"
                    disabled={busy}
                    title="Delete task?"
                    description={`“${task.title}” and its comments will be permanently deleted.`}
                    confirmLabel="Delete task"
                    onConfirm={async () => {
                      const ok = await run(`/api/v1/tasks/${task.id}`, { method: "DELETE" }, "Task deleted");
                      if (ok) onOpenChange(false);
                    }}
                  >
                    <Trash2 aria-hidden /> Delete
                  </ConfirmButton>
                </div>
              )}
              <CommentsThread key={task.id} taskId={task.id} people={people} canComment={canContribute} />
            </div>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>Task not found</SheetTitle>
            <SheetDescription>It may have been deleted, or it is outside your current filters.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Board & list ──────────────────────────────────────────────────────────────

function TaskCard({ task, onOpen, canContribute }: { task: TaskView; onOpen: () => void; canContribute: boolean }) {
  const { run, busy } = useMutation();
  return (
    <div className={cn("group rounded-lg border bg-card p-3 shadow-xs transition-colors hover:border-brand-green/60", task.isOverdue && "border-destructive/40")}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left text-sm font-medium text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          {task.title}
        </button>
        {canContribute && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${task.title}`} disabled={busy}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {TASK_STATUSES.filter((s) => s !== task.status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => run(`/api/v1/tasks/${task.id}`, { method: "PATCH", body: { status: s } }, `Moved to ${TASK_STATUS_LABEL[s]}`)}>
                  {TASK_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpen}>Open details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EnumBadge value={task.priority} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} />
        <DueDate dueAt={task.dueAt} overdue={task.isOverdue} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        {task.assignee ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PersonAvatar name={task.assignee.name} image={task.assignee.image} /> {task.assignee.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        {task._count.comments > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${task._count.comments} comments`}>
            <MessageSquare className="size-3.5" aria-hidden /> {task._count.comments}
          </span>
        )}
      </div>
    </div>
  );
}

export function TasksPanel({
  projectId,
  tasks,
  view,
  people,
  canContribute,
  initialTaskId,
  truncated,
  currentUserId,
}: {
  projectId: string;
  tasks: TaskView[];
  view: "board" | "list";
  people: MentionPerson[];
  canContribute: boolean;
  initialTaskId?: string;
  truncated: boolean;
  currentUserId: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(initialTaskId ?? null);
  const [fetched, setFetched] = useState<TaskView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskView | null>(null);
  const [newStatus, setNewStatus] = useState<TaskStatus>("TODO");

  const fromList = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null;
  const selected = fromList ?? (fetched?.id === selectedId ? fetched : null);

  // Deep links (?task=) may point at a task outside the current filters — fetch it directly.
  useEffect(() => {
    if (!selectedId || tasks.some((t) => t.id === selectedId)) return;
    let cancelled = false;
    apiFetch<{ task: TaskView }>(`/api/v1/tasks/${selectedId}`)
      .then((res) => !cancelled && setFetched(res.task))
      .catch(() => !cancelled && setFetched(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId, tasks]);

  function openTask(id: string | null) {
    setSelectedId(id);
    // Keep the URL shareable without a server round-trip.
    window.history.replaceState(null, "", hrefWith(pathname, new URLSearchParams(sp.toString()), { task: id ?? undefined }));
  }

  const assigneeOptions = [
    { value: "me", label: "Assigned to me" },
    { value: "none", label: "Unassigned" },
    ...people.filter((p) => p.id !== currentUserId).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          searchPlaceholder="Search tasks"
          filters={[
            ...(view === "list"
              ? [{ key: "status", label: "Status", allLabel: "All statuses", options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s]! })) }]
              : []),
            { key: "priority", label: "Priority", allLabel: "All priorities", options: PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p]! })) },
            { key: "assignee", label: "Assignee", allLabel: "Anyone", options: assigneeOptions },
            { key: "overdue", label: "Due", allLabel: "Any due date", options: [{ value: "1", label: "Overdue only" }] },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Task view">
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" asChild>
              <Link href={hrefWith(pathname, new URLSearchParams(sp.toString()), { view: "board", status: undefined, task: undefined })} scroll={false} aria-current={view === "board" ? "page" : undefined}>
                <Columns3 aria-hidden /> Board
              </Link>
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" asChild>
              <Link href={hrefWith(pathname, new URLSearchParams(sp.toString()), { view: "list", task: undefined })} scroll={false} aria-current={view === "list" ? "page" : undefined}>
                <List aria-hidden /> List
              </Link>
            </Button>
          </div>
          {canContribute && (
            <Button
              onClick={() => {
                setEditing(null);
                setNewStatus("TODO");
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden /> New task
            </Button>
          )}
        </div>
      </div>

      {truncated && <p className="text-xs text-muted-foreground">Showing the first {tasks.length} matching tasks. Narrow the filters to see others.</p>}

      {tasks.length === 0 ? (
        <EmptyState
          title={sp.toString().match(/(q|priority|assignee|overdue|status)=/) ? "No tasks match these filters" : "No tasks yet"}
          description={canContribute ? "Create the first task to start tracking work." : "Tasks created by contributors will appear here."}
        />
      ) : view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const col = tasks.filter((t) => t.status === status);
            return (
              <section key={status} aria-label={TASK_STATUS_LABEL[status]} className="flex min-h-40 flex-col rounded-lg border bg-muted/40 p-2">
                <header className="mb-2 flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                    {TASK_STATUS_LABEL[status]}
                    <span className="rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">{col.length}</span>
                  </h3>
                  {canContribute && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Add task to ${TASK_STATUS_LABEL[status]}`}
                      onClick={() => {
                        setEditing(null);
                        setNewStatus(status);
                        setFormOpen(true);
                      }}
                    >
                      <Plus aria-hidden />
                    </Button>
                  )}
                </header>
                <div className="grid gap-2">
                  {col.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => openTask(t.id)} canContribute={canContribute} />
                  ))}
                  {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id} className={cn(t.isOverdue && "bg-destructive/5")}>
                  <TableCell className="max-w-80">
                    <button type="button" onClick={() => openTask(t.id)} className="truncate text-left font-medium text-brand-ink hover:underline">
                      {t.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    {canContribute ? (
                      <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} />
                    ) : (
                      <EnumBadge value={t.status} labels={TASK_STATUS_LABEL} tones={TASK_STATUS_TONE} />
                    )}
                  </TableCell>
                  <TableCell>
                    <EnumBadge value={t.priority} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} />
                  </TableCell>
                  <TableCell>{t.assignee ? t.assignee.name : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell>
                    <DueDate dueAt={t.dueAt} overdue={t.isOverdue} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{t._count.comments}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskFormDialog projectId={projectId} people={people} task={editing} open={formOpen} onOpenChange={setFormOpen} defaultStatus={newStatus} />
      <TaskSheet
        task={selected}
        open={selectedId !== null}
        onOpenChange={(o) => !o && openTask(null)}
        people={people}
        canContribute={canContribute}
        onEdit={() => {
          if (!selected) return;
          setEditing(selected);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
