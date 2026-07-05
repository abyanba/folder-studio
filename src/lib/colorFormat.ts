/**
 * Color text-format helpers for the picker's hex/rgb/hsl/hsv input, ported
 * from the legacy `getColorStr`/`setFromInput`/`rgb2hsl` (public/legacy.html
 * L899-917). Pure and unit-testable.
 */

import { getHex, rgbToHex } from "./color";

export type ColorTextFormat = "hex" | "rgb" | "hsl" | "hsv";

export const COLOR_TEXT_FORMATS: ColorTextFormat[] = ["hex", "rgb", "hsl", "hsv"];

/** RGB (0..255) → HSL (h 0..360, s/l 0..100, rounded ints). */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const mx = Math.max(rn, gn, bn);
  const mn = Math.min(rn, gn, bn);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === rn) h = 60 * (((gn - bn) / d + 6) % 6);
    else if (mx === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** HSL (h 0..360, s/l 0..100) → RGB (0..255 ints). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

/** Hex → display string in the given format (e.g. rgb → `"245, 197, 66"`). */
export function formatColor(hex: string, fmt: ColorTextFormat): string {
  if (fmt === "hex") return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (fmt === "rgb") return `${r}, ${g}, ${b}`;
  if (fmt === "hsl") {
    const [h, s, l] = rgbToHsl(r, g, b);
    return `${h}, ${s}, ${l}`;
  }
  // hsv
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    if (mx === rn) h = 60 * (((gn - bn) / d + 6) % 6);
    else if (mx === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  return `${Math.round(h)}, ${Math.round((mx > 0 ? d / mx : 0) * 100)}, ${Math.round(mx * 100)}`;
}

const NUM3 = /(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/;

/**
 * Parse user text in the given format to a `#rrggbb` hex, or `null` if it
 * doesn't parse. Hex accepts 3- or 6-digit, `#` optional.
 */
export function parseColorInput(value: string, fmt: ColorTextFormat): string | null {
  const v = value.trim();
  if (fmt === "hex") {
    const m = v.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (!m) return null;
    let hex = m[1].toLowerCase();
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return `#${hex}`;
  }
  const m = v.match(NUM3);
  if (!m) return null;
  const [a, b, c] = [+m[1], +m[2], +m[3]];
  if (fmt === "rgb") {
    if (a > 255 || b > 255 || c > 255) return null;
    return rgbToHex(a, b, c);
  }
  if (fmt === "hsl") {
    if (a > 360 || b > 100 || c > 100) return null;
    const [r, g, bb] = hslToRgb(a, b, c);
    return rgbToHex(r, g, bb);
  }
  // hsv
  if (a > 360 || b > 100 || c > 100) return null;
  return getHex(a, b / 100, c / 100);
}
