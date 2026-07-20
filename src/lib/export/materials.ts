/**
 * Surface materials — a procedural shading layer blended over the folder so it
 * reads as leather, metal, fabric or paper.
 *
 * The layer is grey light-and-shadow only: it never carries colour, so the
 * user's folder colour (or gradient, or image) shows through. Each render path
 * composites it with `soft-light` over everything beneath, which is what makes
 * a pattern pick up the grain — the material acts on the composite, not on one
 * layer. Canvas `globalCompositeOperation` and SVG `mix-blend-mode` were
 * verified pixel-identical for this blend before the feature was built.
 *
 * Recipes are tuned for icon scale, not photorealism: frequencies are coarse
 * enough to survive the 305×200 content rect at a 256px export. Fine grain
 * (the first paper attempt used baseFrequency 0.5) washes out to nothing.
 */

import { FH, FW } from "@/lib/constants";
import type { MaterialSettings } from "@/types/document";

/** Which knobs a material actually responds to — the panel shows only these. */
export type MaterialControl = "intensity" | "scale" | "angle";

export interface MaterialRecipe {
  id: string;
  name: string;
  /** feTurbulence type. */
  noise: "fractalNoise" | "turbulence";
  /** Base frequency [x, y]; anisotropy is what makes brushed metal read. */
  freq: [number, number];
  octaves: number;
  /** feDiffuseLighting surfaceScale — how deep the bumps read. */
  depth: number;
  /** Light elevation; low grazes the surface and exaggerates grain. */
  elevation: number;
  /** Default light/brush azimuth. */
  azimuth: number;
  controls: MaterialControl[];
}

export const MATERIALS: MaterialRecipe[] = [
  {
    id: "leather",
    name: "Leather",
    noise: "fractalNoise",
    freq: [0.045, 0.045],
    octaves: 5,
    depth: 3,
    elevation: 55,
    azimuth: 135,
    controls: ["intensity", "scale"],
  },
  {
    id: "metal",
    name: "Brushed metal",
    // Strongly anisotropic: almost no variation along the brush direction, a
    // lot across it. A symmetric noise reads as static, not as metal.
    noise: "fractalNoise",
    freq: [0.004, 0.35],
    octaves: 2,
    depth: 1.1,
    elevation: 68,
    azimuth: 90,
    controls: ["intensity", "scale", "angle"],
  },
  {
    id: "fabric",
    name: "Fabric",
    // `turbulence` (not fractalNoise) gives the cell-like weave.
    noise: "turbulence",
    freq: [0.12, 0.12],
    octaves: 2,
    depth: 2.2,
    elevation: 60,
    azimuth: 135,
    controls: ["intensity", "scale"],
  },
  {
    id: "paper",
    name: "Paper",
    noise: "fractalNoise",
    freq: [0.06, 0.06],
    octaves: 3,
    depth: 1.8,
    elevation: 66,
    azimuth: 120,
    controls: ["intensity", "scale"],
  },
];

export function getMaterialRecipe(id: string): MaterialRecipe | null {
  if (!id || id === "none") return null;
  return MATERIALS.find((m) => m.id === id) ?? null;
}

const num = (n: number): string => (Number.isFinite(n) ? +n.toFixed(4) : 0).toString();

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/** Stretch a 256-viewBox base-shape SVG to the workspace frame. */
function fillFrame(svg: string): string {
  return svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg width="${FW}" height="${FH}" preserveAspectRatio="none"`);
}

/**
 * The material shading layer as one self-contained `FW`×`FH` SVG, confined to
 * `maskSvg`. Consumed identically by all three render paths; each applies the
 * `soft-light` blend itself, since blending has to happen against the layers
 * already drawn beneath rather than inside this SVG.
 */
export function buildMaterialLayerSvg(
  material: MaterialSettings,
  maskSvg: string,
  idPrefix = "m",
): string | null {
  const recipe = getMaterialRecipe(material.id);
  if (!recipe) return null;

  // `scale` coarsens or tightens the grain. Dividing (not multiplying) keeps
  // the slider intuitive: larger scale = larger features.
  const s = Math.max(0.1, material.scale || 1);
  const fx = recipe.freq[0] / s;
  const fy = recipe.freq[1] / s;
  const azimuth = recipe.controls.includes("angle") ? material.angle : recipe.azimuth;

  const fId = `${idPrefix}f`;
  const maskId = `${idPrefix}mask`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">` +
    `<defs>` +
    `<filter id="${fId}" x="0%" y="0%" width="100%" height="100%">` +
    `<feTurbulence type="${recipe.noise}" baseFrequency="${num(fx)} ${num(fy)}" numOctaves="${recipe.octaves}" seed="${recipe.id.length * 7}" result="n"/>` +
    `<feDiffuseLighting in="n" lighting-color="#ffffff" surfaceScale="${num(recipe.depth)}" diffuseConstant="1">` +
    `<feDistantLight azimuth="${num(azimuth)}" elevation="${num(recipe.elevation)}"/>` +
    `</feDiffuseLighting>` +
    `</filter>` +
    `<mask id="${maskId}"><svg x="0" y="0" width="${FW}" height="${FH}">${fillFrame(maskSvg)}</svg></mask>` +
    `</defs>` +
    `<g mask="url(#${maskId})">` +
    `<rect width="${FW}" height="${FH}" filter="url(#${fId})" opacity="${num(clamp01(material.intensity))}"/>` +
    `</g>` +
    `</svg>`
  );
}

/**
 * Whether the material is confined to the front panel. Mirrors the pattern and
 * image-fill rule: only windows/macOS have a front/back split.
 */
export function isFrontMaterial(baseShape: string, material: MaterialSettings): boolean {
  if (material.span !== "front") return false;
  return baseShape === "windows" || baseShape === "macos";
}
