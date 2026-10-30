import Link from "next/link";
import { Compass } from "lucide-react";
import { ctaClasses } from "@/components/site/cta-link";

const SUGGESTIONS = [
  { label: "Products", href: "/products" },
  { label: "Solutions", href: "/solutions" },
  { label: "Insights", href: "/insights" },
  { label: "Request a demo", href: "/connect" },
];

/** 404 body shared by the root and site-level not-found pages. */
export function NotFoundContent() {
  return (
    <section className="flex flex-1 items-center bg-brand-light py-20 sm:py-24">
      <div className="container-page flex flex-col items-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-navy text-brand-green">
          <Compass aria-hidden="true" className="size-6" />
        </span>
        <p className="eyebrow">Error 404</p>
        <h1 className="max-w-2xl text-3xl font-semibold text-balance text-brand-ink sm:text-4xl">
          We couldn&apos;t find that page.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          The link may be out of date, or the content may not be public. If you were expecting private content, sign in to
          the portal.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={ctaClasses("navy", "lg")}>
            Back to home
          </Link>
          <Link href="/login" className={ctaClasses("outline-light", "lg")}>
            Sign in
          </Link>
        </div>
        <nav aria-label="Suggested pages" className="pt-4">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {SUGGESTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="font-medium text-brand-navy underline-offset-4 hover:underline">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
