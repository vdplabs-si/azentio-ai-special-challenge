import { chooseTier, type ScenePreset, type Tier } from "@/components/three/presets";

/**
 * Decides — silently, before any WebGL renderer exists — whether a visitor gets the live scene,
 * a single still frame (reduced motion) or the SVG poster. Nothing here may log: a failed
 * renderer would print console errors, so we only mount the canvas when it will work.
 *
 * QA override: localStorage["az:scene"] = "force" (allow software GL, skip device limits) | "off".
 */
export type SceneRender = "canvas" | "still" | "poster";
export interface SceneDecision {
  render: SceneRender;
  tier: Tier;
  reason: string;
}

const probeCache = new Map<boolean, boolean>();

/** True when a WebGL2 context can be created (hardware-accelerated unless `allowSoftware`). */
export function probeWebGL2(allowSoftware: boolean): boolean {
  const cached = probeCache.get(allowSoftware);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: !allowSoftware });
    if (gl) {
      ok = true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    ok = false;
  }
  probeCache.set(allowSoftware, ok);
  return ok;
}

function override(): string | null {
  try {
    return window.localStorage.getItem("az:scene");
  } catch {
    return null;
  }
}

export function decideScene(preset: ScenePreset): SceneDecision {
  const poster = (reason: string): SceneDecision => ({ render: "poster", tier: "low", reason });
  const mode = override();
  if (mode === "off") return poster("override-off");
  const force = mode === "force";

  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (!force && nav.connection?.saveData) return poster("save-data");
  // Page-hero backdrops are a desktop enhancement; the homepage narrative also runs on phones.
  if (!force && preset !== "home" && !window.matchMedia("(min-width: 1024px)").matches) return poster("small-viewport");
  if (!probeWebGL2(force)) return poster("no-webgl");

  const cores = nav.hardwareConcurrency ?? 4;
  const memoryGb = nav.deviceMemory ?? 4;
  if (!force && (cores <= 2 || memoryGb <= 2)) return poster("low-end-device");

  const tier = chooseTier({ cores, memoryGb, wide: window.matchMedia("(min-width: 768px)").matches });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { render: reduce ? "still" : "canvas", tier, reason: force ? "forced" : "capable" };
}

/** Runs `fn` after the page has loaded and the main thread is idle, so the scene never competes with LCP. */
export function whenIdle(fn: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (cancelled) return;
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(() => !cancelled && fn(), { timeout: 2500 });
    else timeoutId = setTimeout(() => !cancelled && fn(), 300);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}
