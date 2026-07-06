/**
 * SVG gradient `<defs>` builders shared by the base-shape, element, and draw
 * renderers. Ported from public/legacy.html L919 (gradSVGCoords) and the inline
 * gradient defs in L929/L931/L932/L582-584.
 *
 * Note: the legacy base-folder convention `(angle-90)` with cos/sin is
 * algebraically identical to the element convention here, so one helper covers
 * both screen-percentage linear gradients.
 */

import { getHex } from "@/lib/color";
import type { Gradient } from "@/types/gradient";

export interface GradCoords {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
}

/** Percentage endpoint coords for a linear gradient at `angle` degrees. */
export function gradSVGCoords(angle: number): GradCoords {
  const a = (angle * Math.PI) / 180;
  return {
    x1: (50 - Math.sin(a) * 50).toFixed(1) + "%",
    y1: (50 + Math.cos(a) * 50).toFixed(1) + "%",
    x2: (50 + Math.sin(a) * 50).toFixed(1) + "%",
    y2: (50 - Math.cos(a) * 50).toFixed(1) + "%",
  };
}

export interface GradientLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The single userSpace linear-gradient endpoint formula (AR-01), for a `w`×`h`
 * box with origin at its top-left. This is the aspect-distorted convention every
 * SVG/canvas path uses — the same one `gradSVGCoords` expresses in percentages.
 * Shapes, icons, freehand draws, and canvas text gradients all derive from here.
 */
export function gradientLine(angleDeg: number, w: number, h: number): GradientLine {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x1: w / 2 - Math.sin(a) * (w / 2),
    y1: h / 2 + Math.cos(a) * (h / 2),
    x2: w / 2 + Math.sin(a) * (w / 2),
    y2: h / 2 - Math.cos(a) * (h / 2),
  };
}

/** `<stop>` tags for a gradient's stops, sorted by position. */
export function gradientStops(gradient: Gradient): string {
  return [...gradient.stops]
    .sort((a, b) => a.pos - b.pos)
    .map(
      (s) =>
        `<stop offset="${Math.round(s.pos * 100)}%" stop-color="${getHex(s.hue, s.sat, s.bri)}"/>`,
    )
    .join("");
}

/** A screen-percentage `<linearGradient>`/`<radialGradient>` element (no `<defs>` wrapper). */
export function gradientElement(id: string, gradient: Gradient): string {
  const stops = gradientStops(gradient);
  if (gradient.kind === "radial") {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
  }
  const c = gradSVGCoords(gradient.angle);
  return `<linearGradient id="${id}" x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}">${stops}</linearGradient>`;
}

/** Screen-percentage gradient wrapped in `<defs>`. */
export function gradientDefs(id: string, gradient: Gradient): string {
  return `<defs>${gradientElement(id, gradient)}</defs>`;
}

/**
 * A userSpace gradient element for a given viewBox (used by freehand draw so the
 * gradient maps to the path's local coordinate box). Ported from L931.
 */
export function gradientElementUserSpace(
  id: string,
  gradient: Gradient,
  w: number,
  h: number,
): string {
  const stops = gradientStops(gradient);
  if (gradient.kind === "radial") {
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${w / 2}" cy="${h / 2}" r="${Math.max(w, h) / 2}">${stops}</radialGradient>`;
  }
  const { x1, y1, x2, y2 } = gradientLine(gradient.angle, w, h);
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}">${stops}</linearGradient>`;
}

export function gradientDefsUserSpace(
  id: string,
  gradient: Gradient,
  w: number,
  h: number,
): string {
  return `<defs>${gradientElementUserSpace(id, gradient, w, h)}</defs>`;
}
