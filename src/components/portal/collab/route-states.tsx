"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared body for collaboration error.tsx boundaries (Next 16: `retry` re-fetches the segment). */
export function RouteError({ error, retry, title = "This page couldn't be loaded", backHref, backLabel }: {
  error: unknown;
  retry: () => void;
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center rounded-lg border border-destructive/20 bg-card px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Something went wrong while loading this view. Your data has not been changed. Please try again.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <div className="mt-5 flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        {backHref && (
          <Button variant="outline" asChild>
            <Link href={backHref}>{backLabel ?? "Go back"}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
