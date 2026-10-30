"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { ApiError, apiFetch, errorMessage } from "@/lib/client/api";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Labelled form field with hint and error text wired for assistive tech. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Map a 422 response's field errors onto a react-hook-form instance. Returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, e: unknown, fields: readonly string[]) {
  if (!(e instanceof ApiError)) return false;
  let applied = false;
  for (const [field, msgs] of Object.entries(e.fieldErrors)) {
    if (fields.includes(field) && msgs?.[0]) {
      form.setError(field as Path<T>, { message: msgs[0] });
      applied = true;
    }
  }
  return applied;
}

/**
 * Run a mutation with busy state, success toast, real server error toast and router.refresh().
 * Returns `run(path, init, successMessage)`; resolves to the response or undefined on error.
 */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(path: string, init: Parameters<typeof apiFetch>[1], success?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const res = await apiFetch<T>(path, init);
        if (success) toast.success(success);
        router.refresh();
        return res;
      } catch (e) {
        toast.error(errorMessage(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );
  return { run, busy };
}
