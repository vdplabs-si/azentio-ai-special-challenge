"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ctaClasses } from "@/components/site/cta-link";

/** Error boundary for public pages (e.g. the database is temporarily unreachable). */
export default function SiteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section data-route-error className="flex flex-1 items-center bg-brand-light py-20 sm:py-24">
      <div className="container-page flex flex-col items-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-navy text-brand-green">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="max-w-2xl text-3xl font-semibold text-balance text-brand-ink sm:text-4xl">
          This page is temporarily unavailable.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Something went wrong while loading this content. Please try again in a moment.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => retry()} className={ctaClasses("navy", "lg")}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
          <Link href="/" className={ctaClasses("outline-light", "lg")}>
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
