/**
 * Pure color conversions, ported from the legacy class methods
 * (public/legacy.html L570-573, L608). No React, no `this` — directly testable.
 */

import type { Gradient } from "@/types/gradient";

export type Rgb = [r: number, g: number, b: number];
export type Hsv = [h: number, s: number, v: number];

/** HSV (h:0..360, s:0..1, v:0..1) → RGB (0..255 ints). */
export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** HSV → hex string. */
export function getHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/** Hex string (`#rrggbb`) → HSV. Returns `[0,0,0]` for malformed input. */
export function hexToHsv(hex: string): Hsv {
  if (!hex || hex.length < 7) return [0, 0, 0];
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((((g - b) / d + 6) % 6) * 60);
    else if (mx === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}

/**
 * Hex (`#rrggbb`) + alpha → `rgba(...)` string. Pass-through if already `rgb(...)`.
 * Ported from the legacy `hexA` (public/legacy.html L896).
 */
export function hexA(hex: string, alpha = 1): string {
  const c = hex || "#000000";
  if (c.startsWith("rgb")) return c;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function stopList(gradient: Gradient): string {
  return [...gradient.stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${getHex(s.hue, s.sat, s.bri)} ${Math.round(s.pos * 100)}%`)
    .join(",");
}

/** Build a CSS `linear-gradient()`/`radial-gradient()` from a {@link Gradient}. */
export function gradientToCss(gradient: Gradient): string {
  const cs = stopList(gradient);
  return gradient.kind === "linear"
    ? `linear-gradient(${gradient.angle}deg,${cs})`
    : `radial-gradient(circle,${cs})`;
}

/**
 * Text-gradient CSS matched to the canvas/SVG userSpace convention for a `w`×`h`
 * box (EXP-05). For non-square boxes the CSS angle is aspect-corrected so the
 * gradient runs in the same direction the export draws it, and radial uses an
 * explicit `max(w,h)/2` radius to match `createRadialGradient`. Square boxes
 * collapse to the plain angle, so common text is unaffected.
 */
export function textGradientCss(gradient: Gradient, w: number, h: number): string {
  const cs = stopList(gradient);
  if (gradient.kind === "radial") {
    return `radial-gradient(circle ${Math.max(w, h) / 2}px at center,${cs})`;
  }
  const a = (gradient.angle * Math.PI) / 180;
  // Direction of the userSpace endpoint vector, expressed as a CSS angle
  // (0deg = up, clockwise). atan2(dx, -dy) with dx = sin·w, dy = -cos·h.
  let deg = (Math.atan2(Math.sin(a) * w, Math.cos(a) * h) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return `linear-gradient(${deg.toFixed(2)}deg,${cs})`;
}
