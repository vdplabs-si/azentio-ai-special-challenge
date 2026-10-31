"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared body for route-level error.tsx boundaries (no stack traces or server messages shown). */
export function RouteError({ error, retry, title = "This page could not be loaded" }: { error: unknown; retry: () => void; title?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div role="alert" data-route-error className="mx-auto mt-10 flex max-w-lg flex-col items-center rounded-lg border bg-card px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-8 text-warning" aria-hidden />
      <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Something went wrong while loading this view. You can try again; if the problem continues, contact your administrator.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <Button className="mt-5" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
