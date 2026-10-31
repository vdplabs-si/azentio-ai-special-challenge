"use client";

import dynamic from "next/dynamic";
import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { MotionValue } from "motion/react";
import { decideScene, whenIdle } from "@/components/three/gate";
import type { ScenePreset, Tier } from "@/components/three/presets";
import { cn } from "@/lib/utils";

// three + fiber live only in this chunk; it is requested after the gate passes and the page is idle.
const SceneCanvas = dynamic(() => import("@/components/three/scene-canvas"), { ssr: false });

type Stage = "poster" | "loading" | "canvas" | "still";

/** Scroll progress (0–1) for the homepage narrative; provided by HomeHero, absent elsewhere. */
export const SceneProgressContext = createContext<MotionValue<number> | undefined>(undefined);

/** Last resort: if the canvas throws during render, keep the page and show the poster. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Decorative WebGL backdrop for a hero. The server renders `poster` (an SVG); the canvas fades in
 * over it only when the device can run it. `data-scene-stage` exposes the outcome for tests.
 */
export function SceneStage({
  preset,
  seed,
  highlight = -1,
  poster,
  interactive = false,
  className,
}: {
  preset: ScenePreset;
  seed?: string;
  highlight?: number;
  poster: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  const progress = useContext(SceneProgressContext);
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("poster");
  const [mode, setMode] = useState<{ tier: Tier; still: boolean } | null>(null);
  const [reason, setReason] = useState("pending");
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    return whenIdle(() => {
      const d = decideScene(preset);
      setReason(d.reason);
      if (d.render === "poster") return;
      setMode({ tier: d.tier, still: d.render === "still" });
      setStage("loading");
    });
  }, [preset]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const onReady = useCallback(() => setStage((s) => (s === "loading" ? (mode?.still ? "still" : "canvas") : s)), [mode]);
  const onFallback = useCallback((why: string) => {
    setReason(why);
    setMode(null);
    setStage("poster");
  }, []);
  const showingCanvas = stage === "canvas" || stage === "still";

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-scene={preset}
      data-scene-stage={stage}
      data-scene-reason={reason}
      className={cn("absolute inset-0", interactive && showingCanvas ? "pointer-events-auto" : "pointer-events-none", className)}
    >
      <div className={cn("absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none", showingCanvas ? "opacity-0" : "opacity-100")}>
        {poster}
      </div>
      {mode ? (
        <div className={cn("absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none", showingCanvas ? "opacity-100" : "opacity-0")}>
          <SceneBoundary onError={() => onFallback("render-error")}>
            <SceneCanvas
              preset={preset}
              seed={seed ?? preset}
              tier={mode.tier}
              still={mode.still}
              forced={reason === "forced"}
              active={inView && visible}
              highlight={highlight}
              progress={progress}
              onReady={onReady}
              onFallback={onFallback}
            />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
