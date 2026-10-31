import { useCallback, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { DPR_MAX, FIXED_PROGRESS, PARTICLES, STILL_PROGRESS, type ScenePreset, type Tier } from "@/components/three/presets";
import { BRAND, World, type WorldUniforms } from "@/components/three/world";

/**
 * The only module that imports three / @react-three/fiber. Loaded by SceneStage through
 * next/dynamic({ ssr: false }) after the capability gate passes, so it never runs on the server
 * and never ships to the portal.
 */
type V3 = [number, number, number];
interface Pose {
  pos: V3;
  look: V3;
}

// Home narrative: contribute (institutions) → review (membrane) → share (surface).
const HOME_KEYS: Pose[] = [
  { pos: [0.8, 1.5, 2.4], look: [0, 0.1, -7.2] },
  { pos: [7.2, 2.6, 4.2], look: [0.2, -0.2, -3.2] },
  { pos: [0.4, 5.4, 10.2], look: [0, -1.3, 0.8] },
];
const POSES: Record<Exclude<ScenePreset, "home">, Pose> = {
  surface: { pos: [3.6, 3.6, 8.4], look: [0.4, -1.4, 1.3] },
  membrane: { pos: [7.4, 2.0, 3.0], look: [0, 0, -3.2] },
  institutions: { pos: [0.8, 1.4, 2.0], look: [0, 0.1, -7.2] },
  lab: { pos: [0.8, 4.0, 8.2], look: [0.3, -1.4, 1.2] },
};

const ease = (t: number) => t * t * (3 - 2 * t);
function lerp3(a: V3, b: V3, t: number, out: THREE.Vector3) {
  return out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
function homePose(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const seg = p < 0.5 ? 0 : 1;
  const t = ease(Math.min(1, Math.max(0, (p - seg * 0.5) * 2)));
  lerp3(HOME_KEYS[seg].pos, HOME_KEYS[seg + 1].pos, t, pos);
  lerp3(HOME_KEYS[seg].look, HOME_KEYS[seg + 1].look, t, look);
}

export interface SceneCanvasProps {
  preset: ScenePreset;
  /** QA override (az:scene=force): never give up on slow (e.g. software) renderers. */
  forced: boolean;
  seed: string;
  tier: Tier;
  still: boolean;
  active: boolean;
  highlight: number;
  progress?: MotionValue<number>;
  onReady: () => void;
  onFallback: (reason: string) => void;
}

/** Owns the world's live uniforms (via a ref) and animates them, the camera and the governor per frame. */
function Rig({ preset, seed, highlight, still, progress, onReady, onFallback, tier, forced }: Omit<SceneCanvasProps, "active">) {
  const { camera, size, gl, setDpr, invalidate } = useThree();
  const uniforms = useRef<WorldUniforms | null>(null);
  const onBuilt = useCallback((u: WorldUniforms) => {
    uniforms.current = u;
  }, []);
  const count = PARTICLES[preset === "home" ? "narrative" : "backdrop"][tier];
  const state = useRef({ time: 8, p: still ? STILL_PROGRESS : FIXED_PROGRESS[preset], ready: false, frames: 0, acc: 0, slow: 0, degraded: 0 });
  const pointer = useRef({ x: 0, y: 0, yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 });
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());

  // Leave room for the text column: shift (not zoom) the frustum so the scene sits right of centre.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= 1024) cam.setViewOffset(size.width, size.height, -size.width * 0.18, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);

  // Parallax follows the pointer anywhere on the page; the lab preset also supports dragging.
  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      const r = pointer.current;
      r.x = (e.clientX / window.innerWidth) * 2 - 1;
      r.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (preset === "lab" && r.dragging) {
        r.yaw = Math.max(-0.44, Math.min(0.44, r.yaw + (e.clientX - r.lastX) * 0.004));
        r.pitch = Math.max(-0.17, Math.min(0.17, r.pitch + (e.clientY - r.lastY) * 0.003));
        r.lastX = e.clientX;
        r.lastY = e.clientY;
      }
    };
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => Object.assign(pointer.current, { dragging: true, lastX: e.clientX, lastY: e.clientY });
    const onUp = () => (pointer.current.dragging = false);
    window.addEventListener("pointermove", onMove, { passive: true });
    if (preset === "lab") {
      el.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, preset, still]);

  useFrame((frame, rawDelta) => {
    const u = uniforms.current;
    if (!u) return;
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 20);
    if (!still) s.time += dt;
    const target = still ? STILL_PROGRESS : preset === "home" && progress ? progress.get() : FIXED_PROGRESS[preset];
    s.p = still ? target : THREE.MathUtils.damp(s.p, target, 4, dt);
    const p = s.p;

    u.flow.uTime.value = s.time;
    u.flow.uProgress.value = p;
    u.flow.uPixelRatio.value = frame.gl.getPixelRatio();
    u.membrane.uTime.value = s.time;
    u.membrane.uOpacity.value = THREE.MathUtils.smoothstep(p, 0.12, 0.38) * (1 - 0.85 * THREE.MathUtils.smoothstep(p, 0.7, 1));
    u.surface.uTime.value = s.time;
    u.surface.uOpacity.value = THREE.MathUtils.smoothstep(p, 0.58, 0.95);
    const boundary = 0.3 * (1 - 0.6 * THREE.MathUtils.smoothstep(p, 0.45, 1));
    const hl = u.flow.uHighlight.value as number;
    u.boundaries.forEach((m, i) => (m.opacity = hl < 0 ? boundary : i === hl ? 0.55 : boundary * 0.5));

    // Camera.
    if (preset === "home") homePose(p, pos.current, look.current);
    else {
      const pose = POSES[preset];
      pos.current.set(...pose.pos);
      look.current.set(...pose.look);
      if (!still) pos.current.x += Math.sin(s.time * 0.08) * 0.5;
    }
    const r = pointer.current;
    offset.current.set(r.x * 0.45, -r.y * 0.25, 0);
    frame.camera.position.lerp(pos.current.add(offset.current), still ? 1 : 1 - Math.exp(-3 * dt));
    frame.camera.lookAt(look.current);
    if (preset === "lab") {
      u.points.parent!.rotation.y = THREE.MathUtils.damp(u.points.parent!.rotation.y, r.yaw, 5, dt);
      u.points.parent!.rotation.x = THREE.MathUtils.damp(u.points.parent!.rotation.x, r.pitch, 5, dt);
    }

    if (!s.ready) {
      s.ready = true;
      onReady();
    }

    // Frame-time governor: degrade particles and pixel ratio before ever dropping frames for long.
    if (still) return;
    s.frames++;
    s.acc += rawDelta;
    if (s.acc >= 1) {
      const fps = s.frames / s.acc;
      s.frames = 0;
      s.acc = 0;
      if (s.time < 10) return; // ignore warm-up (shader compile, first layout)
      s.slow = fps < 45 ? s.slow + 1 : 0;
      if (s.slow >= 2) {
        s.slow = 0;
        s.degraded++;
        const geo = u.points.geometry;
        const count = geo.getAttribute("position").count;
        geo.setDrawRange(0, Math.floor(count * Math.pow(0.6, s.degraded)));
        setDpr(Math.max(1, DPR_MAX[tier] - 0.25 * s.degraded));
        if (s.degraded >= 3 && fps < 24 && !forced) onFallback("too-slow");
      }
    }
  });
  return (
    <group>
      <World count={count} seed={seed} highlight={highlight} onBuilt={onBuilt} />
    </group>
  );
}

export default function SceneCanvas({ active, ...rig }: SceneCanvasProps) {
  const { tier, still } = rig;
  return (
    <Canvas
      flat
      dpr={[1, DPR_MAX[tier]]}
      gl={{ antialias: false, stencil: false, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 38, near: 0.1, far: 60, position: [0, 1, 8] }}
      frameloop={still ? "demand" : active ? "always" : "never"}
      resize={{ debounce: 200 }}
      style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", () => rig.onFallback("context-lost"), { once: true });
      }}
    >
      <fog attach="fog" args={[BRAND.abyss, 7, 24]} />
      <Rig {...rig} />
    </Canvas>
  );
}
