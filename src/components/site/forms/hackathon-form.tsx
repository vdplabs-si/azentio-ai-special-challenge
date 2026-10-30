"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/api";
import { ctaClasses } from "@/components/site/cta-link";
import {
  PARTICIPANT_TYPES,
  hackathonRegistrationSchema,
  type HackathonRegistrationData,
  type HackathonRegistrationInput,
} from "@/components/site/forms/schemas";
import { Field, FormAlert, FormSuccess, HoneypotField, describedBy, handleSubmitError, inputClass } from "@/components/site/forms/field";

export interface HackathonOption {
  id: string;
  name: string;
  dates: string;
}

const FIELDS = ["eventId", "name", "email", "organisation", "participantType", "teamName", "ideaSummary", "consentContact"] as const;
type FieldName = (typeof FIELDS)[number];

export function HackathonForm({ events, defaultEventId }: { events: HackathonOption[]; defaultEventId?: string }) {
  const initialEvent = events.find((e) => e.id === defaultEventId)?.id ?? (events.length === 1 ? events[0].id : "");
  const empty = (): DefaultValues<HackathonRegistrationInput> => ({
    eventId: initialEvent,
    name: "",
    email: "",
    organisation: "",
    teamName: "",
    ideaSummary: "",
    consentContact: false,
    website: "",
  });

  const [done, setDone] = useState<{ id: string | null; event: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HackathonRegistrationInput, unknown, HackathonRegistrationData>({
    resolver: zodResolver(hackathonRegistrationSchema),
    defaultValues: empty(),
    mode: "onTouched",
  });

  const ideaLength = useWatch({ control, name: "ideaSummary" })?.length ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await apiFetch<{ ok: true; id?: string }>("/api/v1/hackathon-registrations", { method: "POST", body: values });
      setDone({ id: res.id ?? null, event: events.find((e) => e.id === values.eventId)?.name ?? "the hackathon" });
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

  if (done) {
    return (
      <FormSuccess title="We've received your registration." reference={done.id}>
        <p className="text-sm text-brand-ink">
          Your interest in <strong>{done.event}</strong> has been recorded for the organisers to review. We have not sent a
          confirmation email, so keep the reference above if you need to follow up.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/lab" className={ctaClasses("navy", "md")}>
            Visit the AI Lab
          </Link>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3.5"
            onClick={() => {
              reset(empty());
              setDone(null);
            }}
          >
            Register someone else
          </Button>
        </div>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5" aria-describedby="hackathon-required-note">
      <p id="hackathon-required-note" className="text-sm text-muted-foreground">
        Fields marked <span aria-hidden="true" className="text-destructive">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>

      <Field id="eventId" label="Hackathon" required error={errors.eventId?.message}>
        <Controller
          control={control}
          name="eventId"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} name={field.name}>
              <SelectTrigger
                id="eventId"
                ref={field.ref}
                onBlur={field.onBlur}
                className="w-full bg-white data-[size=default]:h-10"
                aria-required="true"
                aria-invalid={Boolean(errors.eventId)}
                aria-describedby={describedBy("eventId", { error: errors.eventId?.message })}
              >
                <SelectValue placeholder="Choose a hackathon" />
              </SelectTrigger>
              <SelectContent position="popper">
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.dates}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

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
        <Field id="email" label="Email" required error={errors.email?.message}>
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
        <Field id="organisation" label="Organisation" error={errors.organisation?.message}>
          <Input
            id="organisation"
            autoComplete="organization"
            className={inputClass}
            aria-invalid={Boolean(errors.organisation)}
            aria-describedby={describedBy("organisation", { error: errors.organisation?.message })}
            {...register("organisation")}
          />
        </Field>
        <Field id="teamName" label="Team name" error={errors.teamName?.message}>
          <Input
            id="teamName"
            className={inputClass}
            aria-invalid={Boolean(errors.teamName)}
            aria-describedby={describedBy("teamName", { error: errors.teamName?.message })}
            {...register("teamName")}
          />
        </Field>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={describedBy("participantType", { error: errors.participantType?.message })}
      >
        <legend className="mb-1 flex items-center gap-2 text-sm font-medium text-brand-ink">
          I&apos;m taking part as
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </legend>
        <Controller
          control={control}
          name="participantType"
          render={({ field }) => (
            <RadioGroup
              ref={field.ref}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              name={field.name}
              aria-required="true"
              aria-invalid={Boolean(errors.participantType)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {PARTICIPANT_TYPES.map((p) => (
                <label
                  key={p.value}
                  htmlFor={`participant-${p.value}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-ink has-[[data-state=checked]]:border-brand-navy has-[[data-state=checked]]:bg-brand-light"
                >
                  <RadioGroupItem id={`participant-${p.value}`} value={p.value} onBlur={field.onBlur} />
                  {p.label}
                </label>
              ))}
            </RadioGroup>
          )}
        />
        {errors.participantType?.message ? (
          <p id="participantType-error" className="text-xs font-medium text-destructive">
            {errors.participantType.message}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="ideaSummary"
        label="Idea summary"
        hint={`A few lines about the problem you'd like to work on. ${ideaLength}/2000 characters.`}
        error={errors.ideaSummary?.message}
      >
        <Textarea
          id="ideaSummary"
          rows={5}
          className="min-h-32 bg-white"
          aria-invalid={Boolean(errors.ideaSummary)}
          aria-describedby={describedBy("ideaSummary", { error: errors.ideaSummary?.message, hint: true })}
          {...register("ideaSummary")}
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
            I agree that Azentio may contact me about this hackathon and store these details for that purpose, as
            described in the{" "}
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

      <div>
        <Button type="submit" disabled={isSubmitting} className={ctaClasses("navy", "lg")}>
          {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trophy aria-hidden="true" />}
          {isSubmitting ? "Registering…" : "Register interest"}
        </Button>
      </div>
    </form>
  );
}
