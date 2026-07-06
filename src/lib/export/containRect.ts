/**
 * Letterbox math for `object-fit: contain` (EXP-02). Given a source's natural
 * size and a destination box, returns the offset + size of the largest rect that
 * fits inside the box while preserving aspect ratio, centered. The editor gets
 * this for free from CSS `object-fit: contain`; the export canvas needs the
 * explicit rect so both paths frame images identically.
 */

export interface ContainRect {
  /** Offset from the box's top-left. */
  dx: number;
  dy: number;
  /** Fitted draw size. */
  dw: number;
  dh: number;
}

export function containRect(
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
): ContainRect {
  // Degenerate source (unknown natural size) → fill the box, matching a
  // stretched fallback rather than dividing by zero.
  if (natW <= 0 || natH <= 0) return { dx: 0, dy: 0, dw: boxW, dh: boxH };
  const scale = Math.min(boxW / natW, boxH / natH);
  const dw = natW * scale;
  const dh = natH * scale;
  return { dx: (boxW - dw) / 2, dy: (boxH - dh) / 2, dw, dh };
}
