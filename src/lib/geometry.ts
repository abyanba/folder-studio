/**
 * Pure geometry math for canvas interactions, ported from the legacy `onMove`
 * handler (docs/index.html L665-693). No DOM access — callers pass in the raw
 * pointer deltas and the element/others rects; the event wiring lands in Phase 4.
 */

import { CDW, CDH } from "@/lib/constants";
import type { ResizeHandle } from "@/types/interaction";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotatableRect extends Rect {
  /** Rotation in degrees. */
  rotation: number;
}

/**
 * Compute the new rect when dragging a resize handle by (dx, dy) screen pixels.
 * Accounts for the element's rotation and keeps the opposite anchor fixed.
 * Edge handles (n/s/e/w) resize one axis; corner handles preserve aspect ratio.
 * Minimum width/height is clamped to 20.
 */
export function resizeElement(
  el: RotatableRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): Rect {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ocx = el.x + el.width / 2;
  const ocy = el.y + el.height / 2;

  let nw: number;
  let nh: number;
  // Fixed (anchor) point in the old and new local frames.
  let fx: number;
  let fy: number;
  let nfx: number;
  let nfy: number;

  if (handle === "n" || handle === "s" || handle === "e" || handle === "w") {
    if (handle === "e" || handle === "w") {
      const ldx = dx * cos + dy * sin;
      nw = handle === "e" ? Math.max(20, el.width + ldx) : Math.max(20, el.width - ldx);
      nh = el.height;
    } else {
      const ldy = -dx * sin + dy * cos;
      nh = handle === "s" ? Math.max(20, el.height + ldy) : Math.max(20, el.height - ldy);
      nw = el.width;
    }
    if (handle === "e") {
      fx = -el.width / 2;
      fy = 0;
      nfx = -nw / 2;
      nfy = 0;
    } else if (handle === "w") {
      fx = el.width / 2;
      fy = 0;
      nfx = nw / 2;
      nfy = 0;
    } else if (handle === "s") {
      fx = 0;
      fy = -el.height / 2;
      nfx = 0;
      nfy = -nh / 2;
    } else {
      fx = 0;
      fy = el.height / 2;
      nfx = 0;
      nfy = nh / 2;
    }
  } else {
    const ldx = dx * cos + dy * sin;
    const asp = el.width / (el.height || 1);
    nw =
      handle === "se" || handle === "ne"
        ? Math.max(20, el.width + ldx)
        : Math.max(20, el.width - ldx);
    nh = nw / asp;
    if (handle === "se") {
      fx = -el.width / 2;
      fy = -el.height / 2;
      nfx = -nw / 2;
      nfy = -nh / 2;
    } else if (handle === "sw") {
      fx = el.width / 2;
      fy = -el.height / 2;
      nfx = nw / 2;
      nfy = -nh / 2;
    } else if (handle === "ne") {
      fx = -el.width / 2;
      fy = el.height / 2;
      nfx = -nw / 2;
      nfy = nh / 2;
    } else {
      fx = el.width / 2;
      fy = el.height / 2;
      nfx = nw / 2;
      nfy = nh / 2;
    }
  }

  const fxr = ocx + fx * cos - fy * sin;
  const fyr = ocy + fx * sin + fy * cos;
  const ncx = fxr - (nfx * cos - nfy * sin);
  const ncy = fyr - (nfx * sin + nfy * cos);
  return { x: ncx - nw / 2, y: ncy - nh / 2, width: nw, height: nh };
}

/**
 * Angle (degrees) for a rotate handle: the direction from the element center
 * to the pointer, offset by 90° so the top handle maps to 0°.
 */
export function rotateAngle(
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number,
): number {
  return (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI + 90;
}

export interface SnapResult {
  x: number;
  y: number;
  snapV: boolean;
  snapH: boolean;
  snapVX: number | null;
  snapHY: number | null;
}

const SNAP_THRESHOLD = 7;

/**
 * Move `el` by (dx, dy), snapping its left/center/right edges to the content-rect
 * thirds and to the edges/centers of `others` when within {@link SNAP_THRESHOLD}px.
 * Ported from the single-element branch of `onMove` (L665).
 */
export function snapMove(el: Rect, others: readonly Rect[], dx: number, dy: number): SnapResult {
  let snapNx = el.x + dx;
  let snapNy = el.y + dy;
  const ew = el.width;
  const eh = el.height;

  const xEdges: number[] = [0, CDW / 2, CDW];
  const yEdges: number[] = [0, CDH / 2, CDH];
  for (const o of others) {
    xEdges.push(o.x, o.x + o.width / 2, o.x + o.width);
    yEdges.push(o.y, o.y + o.height / 2, o.y + o.height);
  }

  const myXs = [snapNx, snapNx + ew / 2, snapNx + ew];
  const myYs = [snapNy, snapNy + eh / 2, snapNy + eh];
  let snapV = false;
  let snapH = false;
  let snapVX: number | null = null;
  let snapHY: number | null = null;

  for (const mx of myXs) {
    for (const ex of xEdges) {
      if (Math.abs(mx - ex) < SNAP_THRESHOLD) {
        snapNx += ex - mx;
        snapV = true;
        snapVX = ex;
        break;
      }
    }
    if (snapV) break;
  }
  for (const my of myYs) {
    for (const ey of yEdges) {
      if (Math.abs(my - ey) < SNAP_THRESHOLD) {
        snapNy += ey - my;
        snapH = true;
        snapHY = ey;
        break;
      }
    }
    if (snapH) break;
  }

  return { x: snapNx, y: snapNy, snapV, snapH, snapVX, snapHY };
}
