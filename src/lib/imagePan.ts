/**
 * Background-image crop panning (legacy `imgCrop`, public/legacy.html L698):
 * pointer deltas over the square preview pan `folderBgX/Y` (0..100 %) with a
 * zoom-scaled sensitivity; at zoom 1 there is nothing to pan.
 */

export interface ImagePanInput {
  /** Pointer delta in px since drag start. */
  dx: number;
  dy: number;
  /** Preview size in px. */
  width: number;
  height: number;
  zoom: number;
  /** folderBgX/Y at drag start. */
  startX: number;
  startY: number;
}

export function computeImagePan({
  dx,
  dy,
  width,
  height,
  zoom,
  startX,
  startY,
}: ImagePanInput): { x: number; y: number } {
  const zm = zoom || 1;
  const maxShift = ((zm - 1) / zm) * 100;
  if (maxShift <= 0) return { x: startX, y: startY };
  const sensX = (dx / width) * 100 * (1 / zm) * 2;
  const sensY = (dy / height) * 100 * (1 / zm) * 2;
  return {
    x: Math.max(0, Math.min(100, startX - sensX)),
    y: Math.max(0, Math.min(100, startY - sensY)),
  };
}
