"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

/** Map a 422 response's field errors onto the form. */
function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, e: unknown) {
  if (!(e instanceof ApiError)) return;
  for (const [field, msgs] of Object.entries(e.fieldErrors)) form.setError(field as Path<T>, { message: msgs[0] });
}

/** Forwards trigger props (onClick, ref, aria-*) injected by `DialogTrigger asChild`. */
function TriggerButton({ editing, label, ...props }: ComponentProps<typeof Button> & { editing: boolean; label: string }) {
  return editing ? (
    <Button size="sm" variant="outline" {...props}>
      <Pencil aria-hidden /> Edit
    </Button>
  ) : (
    <Button {...props}>
      <Plus aria-hidden /> {label}
    </Button>
  );
}

function CheckboxField<T extends FieldValues>({ form, name, id, label }: { form: UseFormReturn<T>; name: Path<T>; id: string; label: string }) {
  const value = useWatch({ control: form.control, name });
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={value === true}
        onCheckedChange={(v) => form.setValue(name, (v === true) as T[Path<T>], { shouldDirty: true })}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

const isSafeHref = (v: string) =>
  v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || /^https:\/\/[^\s]+$/i.test(v);

// ───────────────────────────── Banners ─────────────────────────────

const bannerSchema = z
  .object({
    message: z.string().trim().min(3, "Use at least 3 characters.").max(280, "Keep banners under 280 characters."),
    linkLabel: z.string().trim().max(60),
    linkHref: z.string().trim().max(500).refine(isSafeHref, "Use a site path starting with / or an https:// URL."),
    active: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine((v) => !v.linkLabel || v.linkHref, { message: "Add a link for the link label.", path: ["linkHref"] })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "The end must be after the start.",
    path: ["endsAt"],
  });
type BannerValues = z.infer<typeof bannerSchema>;

export interface BannerRow {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
  active: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

export function BannerDialog({ banner }: { banner?: BannerRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: BannerValues = {
    message: banner?.message ?? "",
    linkLabel: banner?.linkLabel ?? "",
    linkHref: banner?.linkHref ?? "",
    active: banner?.active ?? false,
    startsAt: toLocalInput(banner?.startsAt),
    endsAt: toLocalInput(banner?.endsAt),
  };
  const form = useForm<BannerValues>({ resolver: zodResolver(bannerSchema), defaultValues: defaults });
  const err = form.formState.errors;
  const idp = banner?.id ?? "new";

  const onSubmit = form.handleSubmit(async (v) => {
    const body = {
      message: v.message,
      linkLabel: v.linkLabel || null,
      linkHref: v.linkHref || null,
      active: v.active,
      startsAt: fromLocalInput(v.startsAt),
      endsAt: fromLocalInput(v.endsAt),
    };
    try {
      if (banner) await apiFetch(`/api/v1/admin/banners/${banner.id}`, { method: "PATCH", body });
      else await apiFetch("/api/v1/admin/banners", { body });
      toast.success(banner ? "Banner updated" : "Banner created");
      setOpen(false);
      router.refresh();
    } catch (e) {
      applyFieldErrors(form, e);
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
        <TriggerButton editing={!!banner} label="New banner" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit banner" : "New homepage banner"}</DialogTitle>
          <DialogDescription>
            A banner shows on the public homepage only while it is active and inside its optional display window.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`bn-msg-${idp}`} label="Message" error={err.message?.message}>
            <Textarea id={`bn-msg-${idp}`} rows={2} maxLength={280} aria-invalid={!!err.message} {...form.register("message")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`bn-label-${idp}`} label="Link label (optional)" error={err.linkLabel?.message}>
              <Input id={`bn-label-${idp}`} aria-invalid={!!err.linkLabel} {...form.register("linkLabel")} />
            </Field>
            <Field id={`bn-href-${idp}`} label="Link (optional)" error={err.linkHref?.message} hint="/connect or https://…">
              <Input id={`bn-href-${idp}`} aria-invalid={!!err.linkHref} {...form.register("linkHref")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`bn-start-${idp}`} label="Show from (optional)" error={err.startsAt?.message}>
              <Input id={`bn-start-${idp}`} type="datetime-local" {...form.register("startsAt")} />
            </Field>
            <Field id={`bn-end-${idp}`} label="Show until (optional)" error={err.endsAt?.message}>
              <Input id={`bn-end-${idp}`} type="datetime-local" aria-invalid={!!err.endsAt} {...form.register("endsAt")} />
            </Field>
          </div>
          <CheckboxField form={form} name="active" id={`bn-active-${idp}`} label="Active" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : banner ? "Save changes" : "Create banner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Media ─────────────────────────────

const MEDIA_AUDIENCES = [
  { value: "PUBLIC", label: "Public (website visitors)" },
  { value: "CLIENT_ALL", label: "All client members and employees" },
  { value: "EMPLOYEE", label: "Employees only" },
] as const;

const mediaSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(160),
  description: z.string().trim().max(2000),
  url: z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500),
  audience: z.enum(["PUBLIC", "EMPLOYEE", "CLIENT_ALL"]),
  published: z.boolean(),
});
type MediaValues = z.infer<typeof mediaSchema>;

export interface MediaRow {
  id: string;
  title: string;
  description: string;
  url: string;
  audience: string;
  published: boolean;
}

export function MediaDialog({ media }: { media?: MediaRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: MediaValues = {
    title: media?.title ?? "",
    description: media?.description ?? "",
    url: media?.url ?? "",
    audience: (media?.audience as MediaValues["audience"]) ?? "PUBLIC",
    published: media?.published ?? false,
  };
  const form = useForm<MediaValues>({ resolver: zodResolver(mediaSchema), defaultValues: defaults });
  const err = form.formState.errors;
  const idp = media?.id ?? "new";

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      if (media) await apiFetch(`/api/v1/admin/media/${media.id}`, { method: "PATCH", body });
      else await apiFetch("/api/v1/admin/media", { body });
      toast.success(media ? "Media updated" : "Media added");
      setOpen(false);
      router.refresh();
    } catch (e) {
      applyFieldErrors(form, e);
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
        <TriggerButton editing={!!media} label="Add media" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{media ? "Edit media asset" : "Add a media asset"}</DialogTitle>
          <DialogDescription>
            Video links must be https. Only YouTube (privacy-enhanced) and Vimeo players can be embedded under the site&apos;s
            content security policy; other URLs are shown as links.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`md-title-${idp}`} label="Title" error={err.title?.message}>
            <Input id={`md-title-${idp}`} aria-invalid={!!err.title} {...form.register("title")} />
          </Field>
          <Field id={`md-desc-${idp}`} label="Description" error={err.description?.message}>
            <Textarea id={`md-desc-${idp}`} rows={3} aria-invalid={!!err.description} {...form.register("description")} />
          </Field>
          <Field id={`md-url-${idp}`} label="Video URL" error={err.url?.message} hint="e.g. https://www.youtube.com/watch?v=… or https://vimeo.com/…">
            <Input id={`md-url-${idp}`} type="url" inputMode="url" aria-invalid={!!err.url} {...form.register("url")} />
          </Field>
          <Field id={`md-aud-${idp}`} label="Audience" error={err.audience?.message}>
            <NativeSelect id={`md-aud-${idp}`} {...form.register("audience")}>
              {MEDIA_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <CheckboxField form={form} name="published" id={`md-pub-${idp}`} label="Published" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : media ? "Save changes" : "Add media"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Insights ─────────────────────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const insightSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(200),
  slug: z.string().trim().max(120).regex(SLUG, "Use lower-case letters, numbers and single hyphens."),
  summary: z.string().trim().min(10, "Use at least 10 characters.").max(500),
  body: z.string().trim().min(1, "Write the article body.").max(20000),
  sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500)]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
type InsightValues = z.infer<typeof insightSchema>;

export interface InsightRow {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  sourceUrl: string | null;
  status: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export function InsightDialog({ insight }: { insight?: InsightRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: InsightValues = {
    title: insight?.title ?? "",
    slug: insight?.slug ?? "",
    summary: insight?.summary ?? "",
    body: insight?.body ?? "",
    sourceUrl: insight?.sourceUrl ?? "",
    status: (insight?.status as InsightValues["status"]) ?? "DRAFT",
  };
  const form = useForm<InsightValues>({ resolver: zodResolver(insightSchema), defaultValues: defaults });
  const err = form.formState.errors;
  const idp = insight?.id ?? "new";

  const onSubmit = form.handleSubmit(async (v) => {
    const body = { ...v, sourceUrl: v.sourceUrl || null };
    try {
      if (insight) await apiFetch(`/api/v1/admin/insights/${insight.id}`, { method: "PATCH", body });
      else await apiFetch("/api/v1/admin/insights", { body });
      toast.success(insight ? "Insight updated" : "Insight created");
      setOpen(false);
      router.refresh();
    } catch (e) {
      applyFieldErrors(form, e);
      toast.error(errorMessage(e));
    }
  });

  const titleField = form.register("title");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <TriggerButton editing={!!insight} label="New insight" />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{insight ? "Edit insight" : "New public insight"}</DialogTitle>
          <DialogDescription>
            Insights are public website articles. Only published insights appear on the website; the body is rendered as plain text.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <Field id={`in-title-${idp}`} label="Title" error={err.title?.message}>
            <Input
              id={`in-title-${idp}`}
              aria-invalid={!!err.title}
              {...titleField}
              onChange={(e) => {
                void titleField.onChange(e);
                if (!insight && !form.getFieldState("slug").isDirty) form.setValue("slug", slugify(e.target.value));
              }}
            />
          </Field>
          <Field id={`in-slug-${idp}`} label="Slug" error={err.slug?.message} hint="Public URL segment. Must be unique across all content.">
            <Input id={`in-slug-${idp}`} aria-invalid={!!err.slug} {...form.register("slug")} />
          </Field>
          <Field id={`in-summary-${idp}`} label="Summary" error={err.summary?.message}>
            <Textarea id={`in-summary-${idp}`} rows={2} maxLength={500} aria-invalid={!!err.summary} {...form.register("summary")} />
          </Field>
          <Field id={`in-body-${idp}`} label="Body" error={err.body?.message}>
            <Textarea id={`in-body-${idp}`} rows={10} aria-invalid={!!err.body} {...form.register("body")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`in-src-${idp}`} label="Source URL (optional)" error={err.sourceUrl?.message}>
              <Input id={`in-src-${idp}`} type="url" aria-invalid={!!err.sourceUrl} {...form.register("sourceUrl")} />
            </Field>
            <Field id={`in-status-${idp}`} label="Status" error={err.status?.message}>
              <NativeSelect id={`in-status-${idp}`} {...form.register("status")}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : insight ? "Save changes" : "Create insight"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Delete ─────────────────────────────

export function ApiDeleteButton({ path, title, description, success }: { path: string; title: string; description: string; success: string }) {
  const { busy, run } = useApiAction();
  return (
    <ConfirmButton
      size="sm"
      disabled={busy}
      title={title}
      description={description}
      confirmLabel="Delete"
      onConfirm={async () => {
        await run(() => apiFetch(path, { method: "DELETE" }), success);
      }}
    >
      <Trash2 aria-hidden /> Delete
    </ConfirmButton>
  );
}
