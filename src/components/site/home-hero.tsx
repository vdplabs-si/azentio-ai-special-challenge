"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { SceneProgressContext, SceneStage } from "@/components/three/scene-stage";
import { SceneScrim } from "@/components/site/scene-chrome";
import { cn } from "@/lib/utils";

export interface HeroStep {
  title: string;
  text: string;
}

const STEP_NAMES = ["contribute", "review", "share"] as const;

/** One step of the story; its emphasis follows the scroll position (user-driven, not autoplay). */
function Step({ index, step, progress }: { index: number; step: HeroStep; progress: MotionValue<number> }) {
  const start = index / 3;
  const end = (index + 1) / 3;
  // Offsets must stay within [0, 1]: motion hands scroll animations to WAAPI, which rejects others.
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const opacity = useTransform(progress, [clamp(start - 0.08), start + 0.03, end - 0.03, clamp(end + 0.08)], [
    index === 0 ? 1 : 0.42,
    1,
    1,
    index === 2 ? 1 : 0.42,
  ]);
  const fill = useTransform(progress, [start, end], [0, 1]);
  return (
    <motion.li style={{ opacity }} className="relative border-t border-white/15 pt-3 motion-reduce:opacity-100! sm:pt-4">
      <motion.span
        aria-hidden="true"
        style={{ scaleX: fill }}
        className={cn("absolute -top-px left-0 h-0.5 w-full origin-left motion-reduce:hidden", index === 0 ? "bg-brand-green" : "bg-brand-mint")}
      />
      <p className="flex items-baseline gap-2 text-sm font-semibold text-white sm:gap-2.5 sm:text-base">
        <span className="type-wide text-sm tabular-nums text-white/55">{index + 1}</span>
        {step.title}
      </p>
      <p className="mt-1.5 hidden text-sm leading-relaxed text-white/70 sm:block">{step.text}</p>
    </motion.li>
  );
}

/**
 * Homepage hero: a sticky stage inside a tall scroll track. Scrolling moves one observation
 * through contribute → review → share in the WebGL scene and highlights the matching step.
 * With reduced motion the track collapses to one screen and every step is shown at once.
 */
export function HomeHero({ title, lead, steps, actions, poster }: { title: string; lead: string; steps: HeroStep[]; actions: ReactNode; poster: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const hint = useTransform(scrollYProgress, [0, 0.06], [1, 0]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const name = STEP_NAMES[Math.min(2, Math.floor(v * 3))];
    if (ref.current && ref.current.dataset.sceneStep !== name) ref.current.dataset.sceneStep = name;
  });

  return (
    <section ref={ref} data-scene-step="contribute" aria-labelledby="home-title" className="relative bg-brand-abyss text-white motion-safe:h-[300vh] max-md:motion-safe:h-[230vh]">
      <div className="relative h-[calc(100svh-4rem)] min-h-[600px] overflow-clip motion-safe:sticky motion-safe:top-16">
        <SceneProgressContext value={scrollYProgress}>
          <SceneStage preset="home" poster={poster} />
        </SceneProgressContext>
        <SceneScrim />
        {/* Keeps the step rail legible once the shared surface rises behind it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(0deg,var(--brand-abyss)_0%,color-mix(in_oklab,var(--brand-abyss)_78%,transparent)_45%,transparent_100%)]"
        />
        <div className="container-page pointer-events-none relative flex h-full flex-col justify-between gap-10 py-10 lg:py-16">
          <div className="pointer-events-auto max-w-[36rem] lg:max-w-[44rem]">
            <h1 id="home-title" className="type-display text-[clamp(2.3rem,3.9vw,3.7rem)] text-balance">
              {title}
            </h1>
            <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-pretty text-white/75 sm:text-lg">{lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
          </div>
          <div className="pointer-events-auto">
            <ol aria-label="How shared learning works" className="grid max-w-5xl grid-cols-3 gap-4 sm:gap-8">
              {steps.map((s, i) => (
                <Step key={s.title} index={i} step={s} progress={scrollYProgress} />
              ))}
            </ol>
            <motion.p style={{ opacity: hint }} className="mt-6 text-sm text-white/55 motion-reduce:hidden">
              Scroll to follow one observation through review.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}
