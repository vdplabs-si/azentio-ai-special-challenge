import type { ReactNode } from "react";
import { PageHero } from "@/components/site/page-hero";

export const LEGAL_UPDATED = "31 October 2026";

/** Shared layout for short policy pages (privacy, terms, accessibility). */
export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={intro} />
      <section className="bg-white py-14 sm:py-16">
        <div className="container-page">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 text-base text-brand-ink [&_a]:font-medium [&_a]:text-brand-navy [&_a]:underline [&_a]:underline-offset-2 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-success [&_p]:text-muted-foreground [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:text-muted-foreground">
            <p className="text-sm">Last updated: {LEGAL_UPDATED}</p>
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
