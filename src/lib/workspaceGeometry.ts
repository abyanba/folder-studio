/**
 * Workspace coordinate mapping + multi-select snap, complementing the pure
 * single-element helpers in `geometry.ts`. Ported from the multi-select and
 * rotate/marquee branches of the legacy `onMove`/`onUp` (docs/index.html
 * L665, L692, L700).
 *
 * "Content" coordinates are relative to the content-rect origin (CDX, CDY)
 * inside the folder; element `x`/`y` are stored in this space. Because the
 * workspace is unscaled (1 screen px = 1 content px), pointer deltas map 1:1.
 */

import { CDW, CDH, CDX, CDY } from "@/lib/constants";
import type { Rect } from "@/lib/geometry";

export interface IdRect extends Rect {
  id: string;
}

export interface GroupSnapResult {
  overrides: Record<string, { x: number; y: number }>;
  snapV: boolean;
  snapH: boolean;
  snapVX: number | null;
  snapHY: number | null;
}

const SNAP_THRESHOLD = 7;

/**
 * Move a group of elements by (dx, dy), snapping the group's bounding-box center
 * to the content-rect center within {@link SNAP_THRESHOLD}px. Returns per-id
 * `{x,y}` overrides plus which guides to show.
 */
export function groupMoveSnap(movingEls: IdRect[], dx: number, dy: number): GroupSnapResult {
  const gx1 = Math.min(...movingEls.map((m) => m.x)) + dx;
  const gy1 = Math.min(...movingEls.map((m) => m.y)) + dy;
  const gx2 = Math.max(...movingEls.map((m) => m.x + m.width)) + dx;
  const gy2 = Math.max(...movingEls.map((m) => m.y + m.height)) + dy;
  const gcx = (gx1 + gx2) / 2;
  const gcy = (gy1 + gy2) / 2;
  const midX = CDW / 2;
  const midY = CDH / 2;

  let sdx = 0;
  let sdy = 0;
  let snapV = false;
  let snapH = false;
  if (Math.abs(gcx - midX) < SNAP_THRESHOLD) {
    sdx = midX - gcx;
    snapV = true;
  }
  if (Math.abs(gcy - midY) < SNAP_THRESHOLD) {
    sdy = midY - gcy;
    snapH = true;
  }

  const overrides: Record<string, { x: number; y: number }> = {};
  for (const m of movingEls) {
    overrides[m.id] = { x: m.x + dx + sdx, y: m.y + dy + sdy };
  }
  return { overrides, snapV, snapH, snapVX: snapV ? midX : null, snapHY: snapH ? midY : null };
}

/** Client-space center of an element, given the `[data-ws]` bounding rect. */
export function elementCenterClient(
  wsRect: { left: number; top: number },
  el: Rect,
): { cx: number; cy: number } {
  return {
    cx: wsRect.left + CDX + el.x + el.width / 2,
    cy: wsRect.top + CDY + el.y + el.height / 2,
  };
}

/** Convert two client-space corners of a marquee to a content-space rect. */
export function marqueeToContent(
  wsRect: { left: number; top: number },
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rect {
  const l = wsRect.left + CDX;
  const t = wsRect.top + CDY;
  const cx1 = Math.min(x1, x2) - l;
  const cy1 = Math.min(y1, y2) - t;
  const cx2 = Math.max(x1, x2) - l;
  const cy2 = Math.max(y1, y2) - t;
  return { x: cx1, y: cy1, width: cx2 - cx1, height: cy2 - cy1 };
}

/** Ids of elements whose bounding box overlaps `rect` (content space). */
export function marqueeHits(elements: IdRect[], rect: Rect): string[] {
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;
  return elements
    .filter((e) => e.x + e.width > rect.x && e.x < rx2 && e.y + e.height > rect.y && e.y < ry2)
    .map((e) => e.id);
}

export { CDX, CDY };
