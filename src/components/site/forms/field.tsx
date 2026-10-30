"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export const describedBy = (id: string, opts: { error?: string; hint?: boolean }) =>
  [opts.error ? `${id}-error` : null, opts.hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

/** Label + control + hint/error, wired for screen readers via aria-describedby. */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-brand-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs font-medium text-destructive">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = "h-10 bg-white";

/** Visually hidden honeypot input. Humans never see it; bots that fill it are silently ignored. */
export function HoneypotField(props: ComponentProps<"input">) {
  return (
    <div aria-hidden="true" className="absolute top-auto -left-[10000px] h-px w-px overflow-hidden">
      <label htmlFor="website">Website (leave blank)</label>
      <input id="website" type="text" tabIndex={-1} autoComplete="off" {...props} />
    </div>
  );
}

/** Server/network error banner shown above the submit button. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

/** Success panel that receives focus so screen-reader users hear the outcome. */
export function FormSuccess({
  title,
  reference,
  children,
}: {
  title: string;
  reference?: string | null;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-success/30 bg-accent p-6 sm:p-8" aria-live="polite">
      <span className="flex size-11 items-center justify-center rounded-full bg-success text-white">
        <CircleCheck aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 ref={ref} tabIndex={-1} className="text-2xl font-semibold text-brand-ink focus:outline-none">
          {title}
        </h2>
        {reference ? (
          <p className="text-sm text-brand-ink">
            Your reference: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">{reference}</code>
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Map an API failure to a human message; 422 field errors are applied through `setFieldError`. */
export function handleSubmitError(
  error: unknown,
  setFieldError: (field: string, message: string) => boolean,
): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      let applied = 0;
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        if (messages?.[0] && setFieldError(field, messages[0])) applied++;
      }
      return applied ? "Please correct the highlighted fields and try again." : error.message;
    }
    if (error.status === 429) {
      const retry = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      const minutes = retry ? Math.max(1, Math.ceil(retry / 60)) : null;
      return `Too many requests from this connection or email address. Please try again${minutes ? ` in about ${minutes} minute${minutes === 1 ? "" : "s"}` : " later"}.`;
    }
    return error.message;
  }
  return "We couldn't reach the server. Check your connection and try again.";
}
