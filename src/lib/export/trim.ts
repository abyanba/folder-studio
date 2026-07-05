/**
 * Auto-trim: find the opaque bounding box of a rendered canvas and compute the
 * transform that recenters/scales it to fill the export canvas with a small pad.
 * Ported from public/legacy.html L941-943.
 */

export interface TrimBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** True when the canvas is effectively empty (no opaque pixels). */
  empty: boolean;
}

/** Scan RGBA `data` (length `size*size*4`) for the opaque bounding box. */
export function computeTrimBounds(data: Uint8ClampedArray, size: number): TrimBounds {
  let x0 = size;
  let y0 = size;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 4) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, empty: !(x0 < x1 && y0 < y1) };
}

export interface TrimTransform {
  srcX: number;
  srcY: number;
  /** Source box width/height including padding. */
  tw: number;
  th: number;
  scale: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Given opaque `bounds`, compute the `drawImage` source/destination transform
 * that pads (~2%), scales to fit, and centers the content on a `size` canvas.
 * Returns null when the source is empty (caller should leave the canvas as-is).
 */
export function computeTrimTransform(bounds: TrimBounds, size: number): TrimTransform | null {
  if (bounds.empty) return null;
  const pad = Math.round(size * 0.02);
  const tw = bounds.x1 - bounds.x0 + 1 + pad * 2;
  const th = bounds.y1 - bounds.y0 + 1 + pad * 2;
  const srcX = Math.max(0, bounds.x0 - pad);
  const srcY = Math.max(0, bounds.y0 - pad);
  const scale = Math.min(size / tw, size / th);
  const dw = tw * scale;
  const dh = th * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  return { srcX, srcY, tw, th, scale, dx, dy, dw, dh };
}
