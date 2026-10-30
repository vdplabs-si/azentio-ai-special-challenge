import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/site/reveal";

const ART = {
  network: "/art/hero-network.svg",
  layers: "/art/layers.svg",
  orbit: "/art/lab-orbit.svg",
} as const;

export type HeroArt = keyof typeof ART;

export interface Crumb {
  label: string;
  href?: string;
}

/** Navy page hero with one h1. Every public page starts with this. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  art,
  breadcrumbs,
  size = "md",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  art?: HeroArt;
  breadcrumbs?: Crumb[];
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-brand-navy text-white", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div
        className={cn(
          "container-page relative grid items-center gap-10",
          art ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : "",
          size === "lg" ? "py-20 sm:py-24 lg:py-28" : "py-14 sm:py-16 lg:py-20",
        )}
      >
        <div className="flex max-w-3xl flex-col gap-5">
          {breadcrumbs?.length ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-300">
                {breadcrumbs.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                    {i > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 text-slate-400" /> : null}
                    {c.href ? (
                      <Link href={c.href} className="rounded-sm hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-white">
                        {c.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          {eyebrow ? <p className="eyebrow text-brand-green">{eyebrow}</p> : null}
          <h1
            className={cn(
              "font-semibold text-balance text-white",
              size === "lg" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl",
            )}
          >
            {title}
          </h1>
          {description ? <div className="max-w-2xl text-base text-pretty text-slate-300 sm:text-lg">{description}</div> : null}
          {children ? <div className="mt-2 flex flex-wrap items-center gap-3">{children}</div> : null}
        </div>
        {art ? (
          <Reveal className="hidden lg:block" y={0} delay={0.1}>
            <Image src={ART[art]} alt="" width={640} height={520} loading="eager" unoptimized className="h-auto w-full max-w-xl justify-self-end" />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
