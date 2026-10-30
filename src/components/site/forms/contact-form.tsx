"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/api";
import { INTEREST_GROUPS } from "@/components/site/catalogue";
import { ctaClasses } from "@/components/site/cta-link";
import { contactSchema, type ContactData, type ContactInput } from "@/components/site/forms/schemas";
import { Field, FormAlert, FormSuccess, HoneypotField, describedBy, handleSubmitError, inputClass } from "@/components/site/forms/field";

const FIELDS = ["name", "email", "company", "jobTitle", "country", "interest", "message", "consentContact"] as const;
type FieldName = (typeof FIELDS)[number];

const emptyValues = (interest: string): ContactInput => ({
  name: "",
  email: "",
  company: "",
  jobTitle: "",
  country: "",
  interest,
  message: "",
  consentContact: false,
  website: "",
});

export function ContactForm({ defaultInterest = "general" }: { defaultInterest?: string }) {
  const [reference, setReference] = useState<string | null | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(contactSchema),
    defaultValues: emptyValues(defaultInterest),
    mode: "onTouched",
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const messageLength = useWatch({ control, name: "message" })?.length ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await apiFetch<{ ok: true; id?: string }>("/api/v1/contact", { method: "POST", body: values });
      setReference(res.id ?? null);
    } catch (error) {
      setFormError(
        handleSubmitError(error, (field, message) => {
          if (!(FIELDS as readonly string[]).includes(field)) return false;
          setError(field as FieldName, { type: "server", message }, { shouldFocus: true });
          return true;
        }),
      );
    }
  });

  if (reference !== undefined) {
    return (
      <FormSuccess title="We've received your request." reference={reference}>
        <p className="text-sm text-brand-ink">
          Your request has been recorded for the azentio.ai team to review. We have not sent a confirmation email, so
          keep the reference above if you need to follow up.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/products" className={ctaClasses("navy", "md")}>
            Explore products
          </Link>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3.5"
            onClick={() => {
              reset(emptyValues(defaultInterest));
              setReference(undefined);
            }}
          >
            Send another request
          </Button>
        </div>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5" aria-describedby="contact-required-note">
      <p id="contact-required-note" className="text-sm text-muted-foreground">
        Fields marked <span aria-hidden="true" className="text-destructive">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Full name" required error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            className={inputClass}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name", { error: errors.name?.message })}
            {...register("name")}
          />
        </Field>
        <Field id="email" label="Work email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            aria-required="true"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email", { error: errors.email?.message })}
            {...register("email")}
          />
        </Field>
        <Field id="company" label="Company" required error={errors.company?.message}>
          <Input
            id="company"
            autoComplete="organization"
            className={inputClass}
            aria-required="true"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={describedBy("company", { error: errors.company?.message })}
            {...register("company")}
          />
        </Field>
        <Field id="jobTitle" label="Job title" error={errors.jobTitle?.message}>
          <Input
            id="jobTitle"
            autoComplete="organization-title"
            className={inputClass}
            aria-invalid={Boolean(errors.jobTitle)}
            aria-describedby={describedBy("jobTitle", { error: errors.jobTitle?.message })}
            {...register("jobTitle")}
          />
        </Field>
        <Field id="country" label="Country" error={errors.country?.message}>
          <Input
            id="country"
            autoComplete="country-name"
            className={inputClass}
            aria-invalid={Boolean(errors.country)}
            aria-describedby={describedBy("country", { error: errors.country?.message })}
            {...register("country")}
          />
        </Field>
        <Field id="interest" label="I'm interested in" required error={errors.interest?.message}>
          <Controller
            control={control}
            name="interest"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} name={field.name}>
                <SelectTrigger
                  id="interest"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className="w-full bg-white data-[size=default]:h-10"
                  aria-required="true"
                  aria-invalid={Boolean(errors.interest)}
                  aria-describedby={describedBy("interest", { error: errors.interest?.message })}
                >
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-80">
                  <SelectItem value="general">General enquiry</SelectItem>
                  {INTEREST_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectSeparator />
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <Field
        id="message"
        label="How can we help?"
        required
        hint={`Tell us about your challenge or what you'd like to see. ${messageLength}/4000 characters.`}
        error={errors.message?.message}
      >
        <Textarea
          id="message"
          rows={6}
          className="min-h-36 bg-white"
          aria-required="true"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", { error: errors.message?.message, hint: true })}
          {...register("message")}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consentContact"
            render={({ field }) => (
              <Checkbox
                id="consentContact"
                ref={field.ref}
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                className="mt-0.5"
                aria-required="true"
                aria-invalid={Boolean(errors.consentContact)}
                aria-describedby={describedBy("consentContact", { error: errors.consentContact?.message })}
              />
            )}
          />
          <label htmlFor="consentContact" className="text-sm text-brand-ink">
            I agree that Azentio may contact me about this request and store these details for that purpose, as described
            in the{" "}
            <Link href="/privacy" className="font-medium text-brand-navy underline underline-offset-2">
              privacy notice
            </Link>
            . <span aria-hidden="true" className="text-destructive">*</span>
          </label>
        </div>
        {errors.consentContact?.message ? (
          <p id="consentContact-error" className="pl-7 text-xs font-medium text-destructive">
            {errors.consentContact.message}
          </p>
        ) : null}
      </div>

      <HoneypotField {...register("website")} />

      <FormAlert message={formError} />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isSubmitting} className={ctaClasses("navy", "lg")}>
          {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {isSubmitting ? "Sending…" : "Send request"}
        </Button>
        <p className="text-xs text-muted-foreground">We use these details only to respond to your request.</p>
      </div>
    </form>
  );
}
