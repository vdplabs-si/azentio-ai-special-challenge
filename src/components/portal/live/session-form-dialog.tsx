"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Field } from "@/components/portal/dashboard/field";
import { AUDIENCE_HINT, AUDIENCE_LABEL, type AudienceValue } from "@/components/portal/live/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const AUDIENCES = ["PUBLIC", "EMPLOYEE", "CLIENT_ALL", "CLIENT_ORGS"] as const;
const STATUSES = ["SCHEDULED", "LIVE", "ENDED"] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = { SCHEDULED: "Scheduled", LIVE: "Live now", ENDED: "Ended" };

const optionalHttps = z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500)]);

const schema = z
  .object({
    title: z.string().trim().min(3, "Use at least 3 characters.").max(160),
    description: z.string().trim().min(1, "Add a description.").max(4000),
    startsAt: z.string().min(1, "Choose a start time."),
    endsAt: z.string(),
    streamUrl: optionalHttps,
    recordingUrl: optionalHttps,
    audience: z.enum(AUDIENCES),
    status: z.enum(STATUSES),
    organisationIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "CLIENT_ORGS" && v.organisationIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["organisationIds"], message: "Choose at least one invited organisation." });
    }
    if (v.endsAt && v.startsAt && new Date(v.endsAt).getTime() <= new Date(v.startsAt).getTime()) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time." });
    }
  });
type Values = z.infer<typeof schema>;

export interface EditableSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  streamUrl: string | null;
  recordingUrl: string | null;
  audience: AudienceValue;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  organisationIds: string[];
}

const toLocalInput = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** Create or edit a live session (broadcast publishers only — enforced server-side). */
export function SessionFormDialog({
  session,
  organisations,
  canTargetRestricted,
  trigger,
}: {
  session?: EditableSession;
  organisations: { id: string; name: string }[];
  /** Employee-only / invitation-only audiences need an employee publisher (server-enforced). */
  canTargetRestricted: boolean;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgFilter, setOrgFilter] = useState("");
  const editing = Boolean(session);
  const defaults: Values = {
    title: session?.title ?? "",
    description: session?.description ?? "",
    startsAt: toLocalInput(session?.startsAt),
    endsAt: toLocalInput(session?.endsAt),
    streamUrl: session?.streamUrl ?? "",
    recordingUrl: session?.recordingUrl ?? "",
    audience: session?.audience ?? "CLIENT_ALL",
    status: session && session.status !== "CANCELLED" ? session.status : "SCHEDULED",
    organisationIds: session?.organisationIds ?? [],
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const audience = useWatch({ control: form.control, name: "audience" });
  const selectedOrgIds = useWatch({ control: form.control, name: "organisationIds" });
  const err = form.formState.errors;

  const filteredOrgs = useMemo(() => {
    const f = orgFilter.trim().toLowerCase();
    return f ? organisations.filter((o) => o.name.toLowerCase().includes(f)) : organisations;
  }, [orgFilter, organisations]);

  const onSubmit = form.handleSubmit(async (v) => {
    const body = {
      title: v.title,
      description: v.description,
      startsAt: toIso(v.startsAt),
      endsAt: toIso(v.endsAt),
      streamUrl: v.streamUrl || null,
      recordingUrl: v.recordingUrl || null,
      audience: v.audience,
      status: v.status,
      organisationIds: v.audience === "CLIENT_ORGS" ? v.organisationIds : [],
    };
    try {
      if (session) {
        await apiFetch(`/api/v1/live-sessions/${session.id}`, { method: "PATCH", body });
        toast.success("Session updated");
        setOpen(false);
        router.refresh();
      } else {
        const res = await apiFetch<{ session: { id: string } }>("/api/v1/live-sessions", { body });
        toast.success("Session scheduled");
        setOpen(false);
        form.reset(defaults);
        router.push(`/portal/live/${res.session.id}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field in defaults) form.setError(field as keyof Values, { message: msgs[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit live session" : "Schedule a live session"}</DialogTitle>
          <DialogDescription>
            Stream and recording links must be https. YouTube and Vimeo links are embedded with privacy-enhanced players; other
            hosts are shown as external links.
          </DialogDescription>
        </DialogHeader>
        <form id="live-session-form" className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id="ls-title" label="Title" error={err.title?.message}>
            <Input id="ls-title" aria-invalid={!!err.title} {...form.register("title")} />
          </Field>
          <Field id="ls-description" label="Description" error={err.description?.message}>
            <Textarea id="ls-description" rows={4} aria-invalid={!!err.description} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ls-starts" label="Starts" error={err.startsAt?.message} hint="Your local time.">
              <Input id="ls-starts" type="datetime-local" aria-invalid={!!err.startsAt} {...form.register("startsAt")} />
            </Field>
            <Field id="ls-ends" label="Ends (optional)" error={err.endsAt?.message}>
              <Input id="ls-ends" type="datetime-local" aria-invalid={!!err.endsAt} {...form.register("endsAt")} />
            </Field>
          </div>
          <Field id="ls-stream" label="Stream URL (optional)" error={err.streamUrl?.message} hint="e.g. a YouTube live or Vimeo event link.">
            <Input id="ls-stream" type="url" inputMode="url" placeholder="https://" aria-invalid={!!err.streamUrl} {...form.register("streamUrl")} />
          </Field>
          <Field id="ls-recording" label="Recording URL (optional)" error={err.recordingUrl?.message} hint="Shown once the session has ended.">
            <Input id="ls-recording" type="url" inputMode="url" placeholder="https://" aria-invalid={!!err.recordingUrl} {...form.register("recordingUrl")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ls-audience" label="Audience" error={err.audience?.message} hint={AUDIENCE_HINT[audience]}>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ls-audience" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.filter((a) => canTargetRestricted || a === "PUBLIC" || a === "CLIENT_ALL").map((a) => (
                        <SelectItem key={a} value={a}>
                          {AUDIENCE_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="ls-status" label="Status" error={err.status?.message}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ls-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {audience === "CLIENT_ORGS" && (
            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Invited organisations</legend>
              {organisations.length === 0 ? (
                <p className="text-sm text-muted-foreground">There are no active client organisations to invite yet.</p>
              ) : (
                <>
                  <Input
                    aria-label="Filter organisations"
                    placeholder="Filter organisations…"
                    value={orgFilter}
                    onChange={(e) => setOrgFilter(e.target.value)}
                  />
                  <Controller
                    control={form.control}
                    name="organisationIds"
                    render={({ field }) => (
                      <div className="grid max-h-48 gap-1 overflow-y-auto pr-1">
                        {filteredOrgs.map((o) => {
                          const checked = field.value.includes(o.id);
                          return (
                            <label key={o.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  field.onChange(v === true ? [...field.value, o.id] : field.value.filter((id) => id !== o.id))
                                }
                              />
                              {o.name}
                            </label>
                          );
                        })}
                        {filteredOrgs.length === 0 && <p className="text-xs text-muted-foreground">No organisations match.</p>}
                      </div>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">{selectedOrgIds.length} selected</p>
                </>
              )}
              {err.organisationIds && (
                <p className="text-xs text-destructive" role="alert">
                  {err.organisationIds.message}
                </p>
              )}
            </fieldset>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="live-session-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : editing ? "Save changes" : "Schedule session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
