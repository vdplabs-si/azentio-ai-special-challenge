import Image from "next/image";
import { POSTERS, type ScenePreset } from "@/components/three/presets";
import { cn } from "@/lib/utils";

/** Server-rendered SVG poster: what visitors see before (or instead of) the WebGL scene. */
export function ScenePoster({ preset, className }: { preset: ScenePreset; className?: string }) {
  return (
    <Image
      src={POSTERS[preset]}
      alt=""
      width={640}
      height={520}
      unoptimized
      className={cn("absolute top-1/2 right-[4%] hidden h-auto w-[44%] max-w-2xl -translate-y-1/2 lg:block", className)}
    />
  );
}

/** Abyss scrim that keeps hero text at AA contrast over the moving scene (left column on desktop, top on phones). */
export function SceneScrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0",
        "bg-[linear-gradient(180deg,var(--brand-abyss)_0%,color-mix(in_oklab,var(--brand-abyss)_82%,transparent)_42%,transparent_64%,color-mix(in_oklab,var(--brand-abyss)_92%,transparent)_100%)]",
        "lg:bg-[linear-gradient(90deg,var(--brand-abyss)_0%,color-mix(in_oklab,var(--brand-abyss)_88%,transparent)_34%,transparent_68%)]",
        className,
      )}
    />
  );
}
