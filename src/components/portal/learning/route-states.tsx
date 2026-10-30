"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared body for learning `error.tsx` boundaries. Never shows server error details. */
export function RouteError({ error, retry, title = "This page couldn't be loaded" }: { error: unknown; retry: () => void; title?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center rounded-lg border bg-card px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-8 text-warning" aria-hidden />
      <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Something went wrong while loading this information. Your data has not been changed.</p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <Button className="mt-5" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
