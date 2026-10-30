"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus, Pencil } from "lucide-react";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { Field } from "@/components/portal/dashboard/field";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { useApiAction } from "@/components/portal/admin/use-api-action";
import { fromLocalInput, toLocalInput } from "@/components/portal/admin/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
] as const;

/** Inline status changer for a demo request or hackathon registration. */
export function InquiryStatusSelect({ kind, id, status, label }: { kind: "demo" | "hackathon"; id: string; status: string; label: string }) {
  const { busy, run } = useApiAction();
  // Optimistic local value; parents key this component by the server status so it resyncs on refresh.
  const [value, setValue] = useState(status);
  return (
    <NativeSelect
      aria-label={`Status for ${label}`}
      className="w-36"
      value={value}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value;
        const previous = value;
        setValue(next);
        const ok = await run(
          () => apiFetch(`/api/v1/admin/inquiries/${kind}/${id}`, { method: "PATCH", body: { status: next } }),
          "Status updated",
        );
        if (!ok) setValue(previous);
      }}
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </NativeSelect>
  );
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const eventSchema = z
  .object({
    name: z.string().trim().min(3, "Use at least 3 characters.").max(120),
    slug: z.string().trim().max(80).regex(SLUG, "Use lower-case letters, numbers and single hyphens."),
    description: z.string().trim().min(10, "Use at least 10 characters.").max(4000),
    startsAt: z.string().min(1, "Choose a start."),
    endsAt: z.string().min(1, "Choose an end."),
    registrationOpen: z.boolean(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "The end must be after the start.",
    path: ["endsAt"],
  });
type EventValues = z.infer<typeof eventSchema>;

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  startsAt: Date | string;
  endsAt: Date | string;
  registrationOpen: boolean;
}

export function HackathonEventDialog({ event }: { event?: EventRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: EventValues = event
    ? {
        name: event.name,
        slug: event.slug,
        description: event.description,
        startsAt: toLocalInput(event.startsAt),
        endsAt: toLocalInput(event.endsAt),
        registrationOpen: event.registrationOpen,
      }
    : { name: "", slug: "", description: "", startsAt: "", endsAt: "", registrationOpen: true };
  const form = useForm<EventValues>({ resolver: zodResolver(eventSchema), defaultValues: defaults });
  const err = form.formState.errors;
  const registrationOpen = useWatch({ control: form.control, name: "registrationOpen" });
  const idp = event?.id ?? "new";

  const onSubmit = form.handleSubmit(async (values) => {
    const body = { ...values, startsAt: fromLocalInput(values.startsAt), endsAt: fromLocalInput(values.endsAt) };
    try {
      if (event) await apiFetch(`/api/v1/admin/hackathon-events/${event.id}`, { method: "PATCH", body });
      else await apiFetch("/api/v1/admin/hackathon-events", { body });
      toast.success(event ? "Event updated" : "Event created");
      setOpen(false);
      if (!event) form.reset(defaults);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) form.setError(field as keyof EventValues, { message: msgs[0] });
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
      <DialogTrigger asChild>
        {event ? (
          <Button size="sm" variant="outline">
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button>
            <CalendarPlus aria-hidden /> New event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? `Edit ${event.name}` : "New hackathon event"}</DialogTitle>
          <DialogDescription>Registrations are collected on the public hackathon page while registration is open.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`ev-name-${idp}`} label="Name" error={err.name?.message}>
            <Input id={`ev-name-${idp}`} aria-invalid={!!err.name} {...form.register("name")} />
          </Field>
          <Field id={`ev-slug-${idp}`} label="Slug" error={err.slug?.message} hint="Used in the public URL, e.g. build-labs-2026.">
            <Input id={`ev-slug-${idp}`} aria-invalid={!!err.slug} {...form.register("slug")} />
          </Field>
          <Field id={`ev-desc-${idp}`} label="Description" error={err.description?.message}>
            <Textarea id={`ev-desc-${idp}`} rows={4} aria-invalid={!!err.description} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`ev-start-${idp}`} label="Starts" error={err.startsAt?.message}>
              <Input id={`ev-start-${idp}`} type="datetime-local" aria-invalid={!!err.startsAt} {...form.register("startsAt")} />
            </Field>
            <Field id={`ev-end-${idp}`} label="Ends" error={err.endsAt?.message}>
              <Input id={`ev-end-${idp}`} type="datetime-local" aria-invalid={!!err.endsAt} {...form.register("endsAt")} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id={`ev-open-${idp}`}
              checked={registrationOpen}
              onCheckedChange={(v) => form.setValue("registrationOpen", v === true, { shouldDirty: true })}
            />
            <Label htmlFor={`ev-open-${idp}`} className="font-normal">
              Registration open
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : event ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrationToggle({ id, name, open }: { id: string; name: string; open: boolean }) {
  const { busy, run } = useApiAction();
  return (
    <ConfirmButton
      size="sm"
      variant={open ? "destructive" : "outline"}
      disabled={busy}
      title={open ? `Close registration for ${name}?` : `Reopen registration for ${name}?`}
      description={open ? "The public registration form stops accepting new registrations. Existing registrations are kept." : "The public registration form accepts registrations again."}
      confirmLabel={open ? "Close registration" : "Reopen registration"}
      onConfirm={async () => {
        await run(
          () => apiFetch(`/api/v1/admin/hackathon-events/${id}`, { method: "PATCH", body: { registrationOpen: !open } }),
          open ? "Registration closed" : "Registration reopened",
        );
      }}
    >
      {open ? "Close registration" : "Reopen"}
    </ConfirmButton>
  );
}
