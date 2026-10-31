import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { flowFragment, flowVertex, membraneFragment, membraneVertex, surfaceFragment, surfaceVertex } from "@/components/three/shaders";
import { mulberry32, hashSeed, surfaceHeight, surfaceShape } from "@/components/three/presets";

/** World layout: institutions at the back, the review membrane in the middle, the shared surface in front. */
// A shallow arc in depth so the institutions read as separate places, not a row.
export const CENTERS = [
  new THREE.Vector3(-2.9, 0.45, -7.7),
  new THREE.Vector3(-1.45, -0.35, -6.8),
  new THREE.Vector3(0, 0.8, -7.3),
  new THREE.Vector3(1.45, -0.4, -6.7),
  new THREE.Vector3(2.9, 0.3, -7.6),
];
export const MEMBRANE_Z = -2.5;
const SURFACE = { width: 9, depth: 5, z0: -0.8, y0: -1.5, scale: 1.2 };
const FOG = { near: 7, far: 24 };
export const BRAND = { green: "#69d393", mint: "#5fffbe", abyss: "#0d1c4f" };

export interface WorldUniforms {
  flow: Record<string, THREE.IUniform>;
  membrane: Record<string, THREE.IUniform>;
  surface: Record<string, THREE.IUniform>;
  boundaries: THREE.LineBasicMaterial[];
  points: THREE.Points;
}

function surfacePoint(shape: ReturnType<typeof surfaceShape>, u: number, v: number, out: THREE.Vector3) {
  return out.set((u - 0.5) * SURFACE.width, SURFACE.y0 + surfaceHeight(shape, u, v) * SURFACE.scale, SURFACE.z0 + v * SURFACE.depth);
}

function buildFlowGeometry(count: number, seed: string) {
  const rand = mulberry32(hashSeed(`flow:${seed}`));
  const shape = surfaceShape(seed);
  const position = new Float32Array(count * 3);
  const mid = new Float32Array(count * 3);
  const end = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const cluster = i % CENTERS.length;
    const c = CENTERS[cluster];
    // Uniform point in a sphere around the institution.
    const r = 0.5 * Math.cbrt(rand());
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    position.set([c.x + r * Math.sin(phi) * Math.cos(theta), c.y + r * Math.cos(phi), c.z + r * Math.sin(phi) * Math.sin(theta)], i * 3);
    mid.set([c.x * 0.5 + (rand() - 0.5) * 3.2, 0.2 + (rand() - 0.5) * 3.4, MEMBRANE_Z], i * 3);
    surfacePoint(shape, rand(), rand(), v);
    end.set([v.x, v.y, v.z], i * 3);
    meta.set([cluster, rand(), rand(), rand() < 0.03 ? 1 : 0], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("aMid", new THREE.BufferAttribute(mid, 3));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 3));
  geo.setAttribute("aMeta", new THREE.BufferAttribute(meta, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -2), 14);
  return geo;
}

function buildSurfaceGeometry(seed: string) {
  const shape = surfaceShape(seed);
  const NU = 56;
  const NV = 28;
  const pts: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) {
    for (let i = 0; i < NU; i++) {
      surfacePoint(shape, i / NU, j / NV, a);
      surfacePoint(shape, (i + 1) / NU, j / NV, b);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  for (let i = 0; i <= NU; i += 2) {
    for (let j = 0; j < NV; j++) {
      surfacePoint(shape, i / NU, j / NV, a);
      surfacePoint(shape, i / NU, (j + 1) / NV, b);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

/**
 * Builds every object once (memoised) and hands the live uniforms back to the rig, which
 * animates them in useFrame without React re-renders. Everything is disposed on unmount.
 */
export function World({ count, seed, highlight, onBuilt }: { count: number; seed: string; highlight: number; onBuilt: (u: WorldUniforms) => void }) {
  const built = useMemo(() => {
    const green = new THREE.Color(BRAND.green);
    const mint = new THREE.Color(BRAND.mint);
    const flowGeo = buildFlowGeometry(count, seed);
    const flowMat = new THREE.ShaderMaterial({
      vertexShader: flowVertex,
      fragmentShader: flowFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPixelRatio: { value: 1 },
        uSize: { value: 3.1 },
        uCell: { value: 0.2 },
        uMembraneZ: { value: MEMBRANE_Z },
        uFogNear: { value: FOG.near },
        uFogFar: { value: FOG.far },
        uHighlight: { value: highlight },
        uCenters: { value: CENTERS },
        uGreen: { value: green },
        uMint: { value: mint },
      },
    });
    const points = new THREE.Points(flowGeo, flowMat);
    points.frustumCulled = false;

    const membraneGeo = new THREE.PlaneGeometry(10, 5);
    const membraneMat = new THREE.ShaderMaterial({
      vertexShader: membraneVertex,
      fragmentShader: membraneFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uGreen: { value: green }, uMint: { value: mint } },
    });

    const surfaceGeo = buildSurfaceGeometry(seed);
    const surfaceMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uMint: { value: mint }, uFogNear: { value: FOG.near }, uFogFar: { value: FOG.far } },
    });

    const boundaryGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.72, 1));
    const boundaryMats = CENTERS.map(
      () => new THREE.LineBasicMaterial({ color: green, transparent: true, opacity: 0.25, depthWrite: false, fog: true }),
    );
    return { points, flowGeo, flowMat, membraneGeo, membraneMat, surfaceGeo, surfaceMat, boundaryGeo, boundaryMats };
  }, [count, seed, highlight]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    onBuilt({
      flow: built.flowMat.uniforms,
      membrane: built.membraneMat.uniforms,
      surface: built.surfaceMat.uniforms,
      boundaries: built.boundaryMats,
      points: built.points,
    });
    invalidate(); // demand-mode (reduced motion) needs one frame once uniforms exist
    return () => {
      built.flowGeo.dispose();
      built.flowMat.dispose();
      built.membraneGeo.dispose();
      built.membraneMat.dispose();
      built.surfaceGeo.dispose();
      built.surfaceMat.dispose();
      built.boundaryGeo.dispose();
      for (const m of built.boundaryMats) m.dispose();
    };
  }, [built, onBuilt, invalidate]);

  return (
    <>
      {CENTERS.map((c, i) => (
        <lineSegments key={i} geometry={built.boundaryGeo} material={built.boundaryMats[i]} position={c} />
      ))}
      <mesh geometry={built.membraneGeo} material={built.membraneMat} position={[0, 0.2, MEMBRANE_Z]} />
      <lineSegments geometry={built.surfaceGeo} material={built.surfaceMat} />
      <primitive object={built.points} />
    </>
  );
}
