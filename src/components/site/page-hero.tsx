import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SceneStage } from "@/components/three/scene-stage";
import type { ScenePreset } from "@/components/three/presets";
import { ScenePoster, SceneScrim } from "@/components/site/scene-chrome";

export interface Crumb {
  label: string;
  href?: string;
}

/** Dark page hero with one h1. Every public page starts with this; most carry a scene preset. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  scene,
  sceneSeed,
  sceneHighlight,
  breadcrumbs,
  size = "md",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  scene?: ScenePreset;
  sceneSeed?: string;
  sceneHighlight?: number;
  breadcrumbs?: Crumb[];
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-clip bg-brand-abyss text-white", scene && "lg:min-h-[min(72svh,680px)]", className)}>
      {scene ? (
        <>
          <SceneStage
            preset={scene}
            seed={sceneSeed}
            highlight={sceneHighlight}
            interactive={scene === "lab"}
            poster={<ScenePoster preset={scene} />}
          />
          <SceneScrim />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[url(/art/dots.svg)] opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
      )}
      <div
        className={cn(
          "container-page pointer-events-none relative flex",
          scene && "lg:min-h-[min(72svh,680px)] lg:items-center",
          size === "lg" ? "py-20 sm:py-24 lg:py-28" : "py-14 sm:py-16 lg:py-20",
        )}
      >
        <div className="pointer-events-auto flex max-w-2xl flex-col gap-5">
          {breadcrumbs?.length ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/65">
                {breadcrumbs.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                    {i > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 text-white/40" /> : null}
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
          {eyebrow ? <p className="text-sm font-medium text-white/70">{eyebrow}</p> : null}
          <h1
            className={cn(
              "type-display text-balance text-white",
              size === "lg" ? "text-[clamp(2.6rem,6vw,5.2rem)]" : "text-[clamp(2.1rem,4.2vw,3.6rem)]",
            )}
          >
            {title}
          </h1>
          {description ? <div className="max-w-xl text-base leading-relaxed text-pretty text-white/75 sm:text-lg">{description}</div> : null}
          {children ? <div className="mt-2 flex flex-wrap items-center gap-3">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
