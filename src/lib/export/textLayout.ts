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

export function computeTextLayout(
  text: string,
  fontSizePx: number,
  lineHeight: number,
  align: TextAlign,
  elementWidth: number,
): TextLayout {
  const lines = (text || "").split("\n");
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
