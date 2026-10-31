/**
 * GLSL for the governed-flow scene (template strings; Turbopack has no .glsl loader).
 * Colours arrive as linear THREE.Color uniforms; `colorspace_fragment` converts to sRGB output,
 * and the Canvas runs `flat` (no tone mapping) so brand colours render exactly.
 */

/** Observation particles: orbit inside their institution → cross the membrane (coarsened, green→mint)
 *  → settle on the shared surface. ~3% are return pulses travelling surface → institution. */
export const flowVertex = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uSize;
uniform float uCell;
uniform float uMembraneZ;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHighlight;
uniform vec3 uCenters[5];
uniform vec3 uGreen;
uniform vec3 uMint;
attribute vec3 aMid;
attribute vec3 aEnd;
attribute vec4 aMeta; // cluster, flow phase, seed, role (0 observation, 1 return pulse)
varying vec3 vColor;
varying float vAlpha;

vec3 bez(vec3 a, vec3 b, vec3 c, float t) {
  float u = 1.0 - t;
  return u * u * a + 2.0 * u * t * b + t * t * c;
}
vec3 rotY(vec3 p, float a) {
  float s = sin(a), c = cos(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  float cluster = aMeta.x;
  float phase = aMeta.y;
  float seed = aMeta.z;
  vec3 center = uCenters[int(cluster + 0.5)];
  vec3 rest = center + rotY(position - center, uTime * (0.12 + seed * 0.2));

  float flowShare = smoothstep(0.16, 0.58, uProgress);
  float settle = smoothstep(0.62, 0.94, uProgress);
  float flowing = step(phase, flowShare);
  float t = fract(uTime * (0.045 + seed * 0.04) + seed * 7.13);
  vec3 lift1 = mix(rest, aMid, 0.5) + vec3(0.0, 0.7 + seed * 0.8, 0.0);
  vec3 lift2 = mix(aMid, aEnd, 0.5) + vec3(0.0, 0.5, 0.0);
  vec3 travel = t < 0.5 ? bez(rest, lift1, aMid, t * 2.0) : bez(aMid, lift2, aEnd, t * 2.0 - 1.0);
  vec3 p = mix(rest, travel, flowing);
  p = mix(p, aEnd, settle * flowing);

  // De-identification: past the membrane, positions snap to a coarse grid and turn mint.
  float crossed = smoothstep(uMembraneZ - 0.1, uMembraneZ + 0.35, p.z);
  p = mix(p, floor(p / uCell + 0.5) * uCell, crossed);
  vColor = mix(uGreen, uMint, crossed);
  float alpha = 0.85;

  if (aMeta.w > 0.5) {
    float tp = fract(uTime * 0.1 + seed * 3.7);
    p = bez(aEnd, mix(aEnd, center, 0.5) + vec3(0.0, 2.4, 0.0), center, tp);
    vColor = uMint;
    alpha = settle * smoothstep(0.0, 0.08, tp) * (1.0 - smoothstep(0.82, 1.0, tp));
  }

  float emphasis = uHighlight < -0.5 ? 1.0 : (abs(cluster - uHighlight) < 0.5 ? 1.35 : 0.4);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.55 + seed * 0.9) * (aMeta.w > 0.5 ? 1.7 : 1.0);
  gl_PointSize = clamp(size * uPixelRatio * (9.0 / -mv.z), 1.0, 7.0 * uPixelRatio);
  vAlpha = alpha * emphasis * (1.0 - smoothstep(uFogNear, uFogFar, -mv.z));
}
`;

export const flowFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.04, d);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
  #include <colorspace_fragment>
}
`;

/** Review membrane: a lattice with soft edges and a slow scanning band. */
export const membraneVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const membraneFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uGreen;
uniform vec3 uMint;
varying vec2 vUv;
void main() {
  vec2 g = vUv * vec2(40.0, 20.0);
  vec2 w = fwidth(g);
  vec2 line = 1.0 - smoothstep(vec2(0.0), w * 1.5, abs(fract(g - 0.5) - 0.5));
  float grid = max(line.x, line.y);
  float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  float band = exp(-pow((vUv.y - fract(uTime * 0.06)) * 9.0, 2.0));
  vec3 color = mix(uGreen, uMint, 0.35 + band * 0.65);
  float alpha = (grid * 0.3 + 0.03 + band * 0.14) * edge * uOpacity;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

/** Shared learning surface: mint wire lines with a travelling highlight. */
export const surfaceVertex = /* glsl */ `
uniform float uFogNear;
uniform float uFogFar;
varying float vFog;
varying float vX;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = smoothstep(uFogNear, uFogFar, -mv.z);
  vX = position.x;
  gl_Position = projectionMatrix * mv;
}
`;

export const surfaceFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uMint;
varying float vFog;
varying float vX;
void main() {
  float sweep = exp(-pow(vX - (fract(uTime * 0.05) * 14.0 - 7.0), 2.0) * 0.6);
  float alpha = (0.32 + sweep * 0.5) * uOpacity * (1.0 - vFog);
  gl_FragColor = vec4(uMint, alpha);
  #include <colorspace_fragment>
}
`;
