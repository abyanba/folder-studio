/**
 * Text auto-fit helpers, ported from the legacy `autoFitSize` /
 * `autoFitSpacing` / `autoFitLineHeight` (public/legacy.html L655-657). The canvas
 * `measureText` is injectable so the math is unit-testable in jsdom.
 *
 * Size fit wraps through the SAME `computeTextLayout` the export renderer uses,
 * so the size it picks is measured against the lines that will actually be drawn
 * (the legacy version measured the whole string as one line and ignored `\n`).
 */

import { computeTextLayout } from "./export/textLayout";
import type { TextElement } from "@/types/element";

export type MeasureTextWidth = (text: string, font: string) => number;

export function cssFont(el: Pick<TextElement, "fontStyle" | "fontWeight" | "fontFamily">, size: number): string {
  return `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight} ${size}px "${el.fontFamily}"`;
}

let sharedCtx: CanvasRenderingContext2D | null = null;

/** Default width measurer backed by a shared offscreen canvas. */
export const canvasMeasure: MeasureTextWidth = (text, font) => {
  if (!sharedCtx) {
    sharedCtx = document.createElement("canvas").getContext("2d");
    if (!sharedCtx) return 0;
  }
  sharedCtx.font = font;
  return sharedCtx.measureText(text).width;
};

/**
 * Binary-search the largest font size (4–96) whose WRAPPED text fits the box.
 * Explicit `\n` breaks and word wrap both count toward the height, so a
 * two-line string is no longer measured as one very wide line.
 */
export function autoFitSize(el: TextElement, measure: MeasureTextWidth = canvasMeasure): number {
  let lo = 4;
  let hi = 96;
  let best = el.fontSize;
  const ls = el.letterSpacing || 0;
  const lh = el.lineHeight || 1.3;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const font = cssFont(el, mid);
    const { lines } = computeTextLayout(el.text, mid, lh, el.align, el.width, (s) => measure(s, font), ls);
    const th = lines.length * mid * lh;
    // Wrapping already caps line width, except a single glyph wider than the
    // box (`breakToken` always emits at least one char) — so still check it.
    const tw = Math.max(
      0,
      ...lines.map((l) => measure(l, font) + (l.length > 1 ? (l.length - 1) * ls : 0)),
    );
    if (tw <= el.width && th <= el.height) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Spread the leftover width across letter gaps (0.5 steps, clamped −2..20). */
export function autoFitSpacing(
  el: TextElement,
  measure: MeasureTextWidth = canvasMeasure,
): number | null {
  if (el.text.length <= 1) return null;
  const tw = measure(el.text, cssFont(el, el.fontSize));
  const spacing = Math.round(((el.width - tw) / (el.text.length - 1)) * 2) / 2;
  return Math.max(-2, Math.min(20, spacing));
}

/** Line height so the lines exactly fill the box (0.1 steps, min 0.5). */
export function autoFitLineHeight(el: TextElement): number {
  const numLines = Math.max(1, (el.text || "").split("\n").length);
  const lh = el.height / (numLines * el.fontSize);
  return Math.max(0.5, Math.round(lh * 10) / 10);
}
