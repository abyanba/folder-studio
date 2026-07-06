/**
 * Pure text-layout math for the canvas text renderer. The actual ctx.fillText /
 * measureText / gradient calls stay in the orchestrator; this computes the
 * multi-line vertical layout and underline geometry. Ported from L933.
 *
 * All inputs are already in canvas pixels (i.e. fontSize * scale).
 */

import type { TextAlign } from "@/types/element";

export interface TextLayout {
  lines: string[];
  /** Line height in pixels. */
  lineHeightPx: number;
  /** Baseline y of the first line, relative to the element center. */
  startY: number;
  /** x anchor for the configured text alignment, relative to the element center. */
  tx: number;
}

/** Measures a substring's width in canvas px (font already applied by the caller). */
export type MeasureText = (text: string) => number;

/** Width of `s` including letter-spacing gaps between characters. */
function widthWithSpacing(s: string, measure: MeasureText, letterSpacing: number): number {
  if (!s.length) return 0;
  return measure(s) + letterSpacing * (s.length - 1);
}

/** Character-break a single token too wide to fit, mirroring CSS `break-word`. */
function breakToken(
  word: string,
  maxWidth: number,
  measure: MeasureText,
  letterSpacing: number,
): string[] {
  const pieces: string[] = [];
  let cur = "";
  for (const ch of word) {
    const candidate = cur + ch;
    if (cur && widthWithSpacing(candidate, measure, letterSpacing) > maxWidth) {
      pieces.push(cur);
      cur = ch;
    } else {
      cur = candidate;
    }
  }
  if (cur) pieces.push(cur);
  return pieces.length ? pieces : [""];
}

/** Greedy word-wrap of one explicit line at `maxWidth`, breaking over-wide words. */
function wrapLine(
  line: string,
  maxWidth: number,
  measure: MeasureText,
  letterSpacing: number,
): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (widthWithSpacing(candidate, measure, letterSpacing) <= maxWidth) {
      cur = candidate;
      continue;
    }
    if (cur) {
      out.push(cur);
      cur = "";
    }
    if (widthWithSpacing(word, measure, letterSpacing) <= maxWidth) {
      cur = word;
    } else {
      const pieces = breakToken(word, maxWidth, measure, letterSpacing);
      for (let i = 0; i < pieces.length - 1; i++) out.push(pieces[i]);
      cur = pieces[pieces.length - 1];
    }
  }
  out.push(cur);
  return out;
}

/**
 * Compute the multi-line vertical layout. When `measure` is supplied the text is
 * greedy word-wrapped at `elementWidth` (EXP-04) — over-wide words character-break
 * like CSS `break-word`; without it, only explicit `\n` splits are honored (the
 * legacy behavior kept for non-measuring callers). `letterSpacing` widens the
 * wrap measurement so spaced text wraps where it actually renders.
 */
export function computeTextLayout(
  text: string,
  fontSizePx: number,
  lineHeight: number,
  align: TextAlign,
  elementWidth: number,
  measure?: MeasureText,
  letterSpacing = 0,
): TextLayout {
  const explicit = (text || "").split("\n");
  const lines = measure
    ? explicit.flatMap((l) => wrapLine(l, elementWidth, measure, letterSpacing))
    : explicit;
  const lineHeightPx = fontSizePx * (lineHeight || 1.3);
  const totalH = lines.length * lineHeightPx;
  const startY = -totalH / 2 + lineHeightPx / 2;
  const tx = align === "left" ? -elementWidth / 2 : align === "right" ? elementWidth / 2 : 0;
  return { lines, lineHeightPx, startY, tx };
}

/** Baseline y for line `index`. */
export function lineY(layout: TextLayout, index: number): number {
  return layout.startY + index * layout.lineHeightPx;
}

/** Left x of an underline given the alignment anchor and the measured line width. */
export function underlineX(align: TextAlign, tx: number, lineWidth: number): number {
  return align === "left" ? tx : align === "right" ? tx - lineWidth : tx - lineWidth / 2;
}

/** Vertical offset of the underline below the baseline. */
export function underlineYOffset(fontSizePx: number): number {
  return fontSizePx * 0.42;
}
