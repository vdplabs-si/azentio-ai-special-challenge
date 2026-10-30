"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Field } from "@/components/portal/dashboard/field";
import {
  CONTENT_AUDIENCE_LABEL, CONTENT_STATUS_LABEL, CONTENT_TYPE_LABEL, LIBRARY_TYPES,
  type ContentAudienceValue, type ContentStatusValue, type LibraryTypeValue,
} from "@/components/portal/knowledge/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const AUDIENCES: ContentAudienceValue[] = ["PUBLIC", "EMPLOYEE", "CLIENT_ALL", "CLIENT_ORGS"];
const STATUSES: ContentStatusValue[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z
  .object({
    type: z.enum(["KNOWLEDGE", "RELEASE_NOTE", "BRIEFING"]),
    title: z.string().trim().min(3, "Use at least 3 characters.").max(200),
    slug: z.union([z.literal(""), z.string().trim().max(120).regex(SLUG, "Use lower-case letters, numbers and single hyphens.")]),
    summary: z.string().trim().min(1, "Add a short summary.").max(600),
    body: z.string().trim().min(1, "Add the content body.").max(50_000),
    sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Use an https:// URL." }).max(500)]),
    audience: z.enum(["PUBLIC", "EMPLOYEE", "CLIENT_ALL", "CLIENT_ORGS"]),
    organisationId: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    reviewDueAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "BRIEFING" && v.audience !== "CLIENT_ALL" && v.audience !== "CLIENT_ORGS") {
      ctx.addIssue({ code: "custom", path: ["audience"], message: "Client briefings must target all clients or one client organisation." });
    }
    if (v.audience === "CLIENT_ORGS" && !v.organisationId) {
      ctx.addIssue({ code: "custom", path: ["organisationId"], message: "Choose the client organisation." });
    }
  });
type Values = z.infer<typeof schema>;

export interface EditableContent {
  id: string;
  type: LibraryTypeValue;
  title: string;
  slug: string;
  summary: string;
  body: string;
  sourceUrl: string | null;
  audience: ContentAudienceValue;
  organisationId: string | null;
  status: ContentStatusValue;
  reviewDueAt: string | null;
}

/**
 * Create/edit a library item. Employees author internal KNOWLEDGE (audience fixed to employees);
 * content publishers choose any library type and audience. The server enforces both.
 */
export function ContentFormDialog({
  item,
  publisher,
  isEmployee,
  organisations,
  trigger,
}: {
  item?: EditableContent;
  publisher: boolean;
  isEmployee: boolean;
  organisations: { id: string; name: string }[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaults: Values = {
    type: item?.type ?? "KNOWLEDGE",
    title: item?.title ?? "",
    slug: item?.slug ?? "",
    summary: item?.summary ?? "",
    body: item?.body ?? "",
    sourceUrl: item?.sourceUrl ?? "",
    audience: item?.audience ?? (isEmployee ? "EMPLOYEE" : "CLIENT_ALL"),
    organisationId: item?.organisationId ?? "",
    status: item?.status ?? "DRAFT",
    reviewDueAt: item?.reviewDueAt ? format(new Date(item.reviewDueAt), "yyyy-MM-dd") : "",
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const type = useWatch({ control: form.control, name: "type" });
  const audience = useWatch({ control: form.control, name: "audience" });
  const err = form.formState.errors;
  const types: LibraryTypeValue[] = publisher ? LIBRARY_TYPES : ["KNOWLEDGE"];
  // Employee-only and single-organisation targeting require a verified employee publisher (server-enforced).
  const audiences = AUDIENCES.filter((a) => isEmployee || a === "PUBLIC" || a === "CLIENT_ALL").filter((a) =>
    type === "BRIEFING" ? a === "CLIENT_ALL" || a === "CLIENT_ORGS" : true,
  );

  const onSubmit = form.handleSubmit(async (v) => {
    const body = {
      type: v.type,
      title: v.title,
      ...(v.slug ? { slug: v.slug } : {}),
      summary: v.summary,
      body: v.body,
      sourceUrl: v.sourceUrl || null,
      ...(publisher
        ? { audience: v.audience, organisationId: v.audience === "CLIENT_ORGS" ? v.organisationId : null }
        : { audience: "EMPLOYEE" as const }),
      status: v.status,
      reviewDueAt: v.type === "KNOWLEDGE" && v.reviewDueAt ? new Date(`${v.reviewDueAt}T00:00:00`).toISOString() : null,
    };
    try {
      if (item) {
        await apiFetch(`/api/v1/knowledge/${item.id}`, { method: "PATCH", body });
        toast.success("Saved");
        setOpen(false);
        if (v.slug && v.slug !== item.slug) router.push(`/portal/knowledge/${v.slug}`);
        router.refresh();
      } else {
        const res = await apiFetch<{ item: { id: string; slug: string } }>("/api/v1/knowledge", { body });
        toast.success(v.status === "PUBLISHED" ? "Published" : "Draft saved");
        setOpen(false);
        router.push(`/portal/knowledge/${res.item.slug}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, msgs] of Object.entries(e.fieldErrors)) {
          if (field in defaults) form.setError(field as keyof Values, { message: msgs[0] });
        }
        if (e.code === "conflict") form.setError("slug", { message: e.message });
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit content" : publisher ? "New library item" : "New knowledge article"}</DialogTitle>
          <DialogDescription>
            {publisher
              ? "Choose the type and audience carefully — employee-only content is never shown to clients."
              : "Knowledge articles are visible to Azentio employees only. You are recorded as the owner."}
          </DialogDescription>
        </DialogHeader>
        <form id="content-form" className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ct-type" label="Type" error={err.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={types.length === 1}>
                    <SelectTrigger id="ct-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTENT_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="ct-audience" label="Audience" error={err.audience?.message}>
              {publisher ? (
                <Controller
                  control={form.control}
                  name="audience"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="ct-audience" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {audiences.map((a) => (
                          <SelectItem key={a} value={a}>
                            {CONTENT_AUDIENCE_LABEL[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Input id="ct-audience" value={CONTENT_AUDIENCE_LABEL.EMPLOYEE} readOnly disabled />
              )}
            </Field>
            <Field id="ct-status" label="Status" error={err.status?.message}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ct-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CONTENT_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {publisher && audience === "CLIENT_ORGS" && (
            <Field id="ct-org" label="Client organisation" error={err.organisationId?.message}>
              <Controller
                control={form.control}
                name="organisationId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="ct-org" className="w-full">
                      <SelectValue placeholder={organisations.length ? "Choose an organisation" : "No client organisations"} />
                    </SelectTrigger>
                    <SelectContent>
                      {organisations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          <Field id="ct-title" label="Title" error={err.title?.message}>
            <Input id="ct-title" aria-invalid={!!err.title} {...form.register("title")} />
          </Field>
          <Field id="ct-slug" label="URL slug (optional)" error={err.slug?.message} hint="Generated from the title when left blank.">
            <Input id="ct-slug" placeholder="e.g. credit-policy-faq" aria-invalid={!!err.slug} {...form.register("slug")} />
          </Field>
          <Field id="ct-summary" label="Summary" error={err.summary?.message}>
            <Textarea id="ct-summary" rows={2} aria-invalid={!!err.summary} {...form.register("summary")} />
          </Field>
          <Field id="ct-body" label="Body" error={err.body?.message} hint="Plain text; line breaks are preserved.">
            <Textarea id="ct-body" rows={10} aria-invalid={!!err.body} {...form.register("body")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ct-source" label="Source URL (optional)" error={err.sourceUrl?.message}>
              <Input id="ct-source" type="url" inputMode="url" placeholder="https://" aria-invalid={!!err.sourceUrl} {...form.register("sourceUrl")} />
            </Field>
            {type === "KNOWLEDGE" && (
              <Field id="ct-review" label="Review due (optional)" error={err.reviewDueAt?.message} hint="Flagged as overdue after this date.">
                <Input id="ct-review" type="date" aria-invalid={!!err.reviewDueAt} {...form.register("reviewDueAt")} />
              </Field>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="content-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : item ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
