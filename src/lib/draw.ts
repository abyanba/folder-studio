/**
 * Draw-tool commit math and eraser hit-testing, ported from the legacy
 * `commitDraw` / `commitShapePath` / erasing branch (public/legacy.html
 * L698/L999/L1003). Pure — the pointer wiring lives in `useDrawTool`.
 */

import { buildShapeSvgPath, buildSvgPath, chaikinSmooth } from "./smoothing";
import type { ControlPoint, Point } from "./smoothing";
import type { CreateDrawInput } from "./elementFactories";
import type { ColorValue } from "@/types/gradient";
import type { DrawElement, FolderElement } from "@/types/element";

export interface CurrentDraw {
  points: Point[];
  color: ColorValue;
  size: number;
  opacity: number;
}

function bounds(pts: Point[], pad: number) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const mnX = Math.min(...xs) - pad;
  const mnY = Math.min(...ys) - pad;
  const w = Math.max(Math.max(...xs) + pad - mnX, 2);
  const h = Math.max(Math.max(...ys) + pad - mnY, 2);
  return { mnX, mnY, w, h };
}

/**
 * Commit a freehand stroke: Chaikin-smooth (2 iterations), then bound with
 * `size + 2` padding. A single point commits as a dot (IN-10) — `buildSvgPath`
 * emits a zero-length `M/L` which the round linecap paints as a round dot.
 */
export function computeFreehandCommit(draw: CurrentDraw): CreateDrawInput | null {
  if (draw.points.length < 1) return null;
  const pad = draw.size + 2;
  // Chaikin on a lone point just duplicates it into a run of identical points.
  const smoothed = draw.points.length < 2 ? draw.points : chaikinSmooth(draw.points, 2);
  const { mnX, mnY, w, h } = bounds(smoothed, pad);
  return {
    x: mnX,
    y: mnY,
    width: w,
    height: h,
    origWidth: w,
    origHeight: h,
    svgPath: buildSvgPath(smoothed, mnX, mnY),
    strokeColor: draw.color,
    strokeSize: draw.size,
    opacity: draw.opacity,
    linecap: "round",
  };
}

/**
 * Commit a line/arc path: offset anchors AND their bezier handles into local
 * space with `size + 4` padding. Returns null when there is nothing to commit.
 */
export function computeShapeCommit(
  points: ControlPoint[],
  submode: "line" | "arc",
  color: ColorValue,
  size: number,
  opacity: number,
): CreateDrawInput | null {
  // A single anchor with no dragged handles is a bare `M x y` that renders
  // nothing — an invisible, selectable element polluting layers/undo (IN-08).
  // Require ≥2 points, or one point whose arc handles were actually dragged out.
  let draggedHandles = false;
  if (points.length === 1) {
    const p = points[0];
    draggedHandles =
      (p.h1x ?? p.x) !== p.x ||
      (p.h1y ?? p.y) !== p.y ||
      (p.h2x ?? p.x) !== p.x ||
      (p.h2y ?? p.y) !== p.y;
  }
  if (points.length < 2 && !draggedHandles) return null;
  const pad = size + 4;
  const { mnX, mnY, w, h } = bounds(points, pad);
  const off = points.map((p) => ({
    ...p,
    x: p.x - mnX,
    y: p.y - mnY,
    h1x: (p.h1x ?? p.x) - mnX,
    h1y: (p.h1y ?? p.y) - mnY,
    h2x: (p.h2x ?? p.x) - mnX,
    h2y: (p.h2y ?? p.y) - mnY,
  }));
  const svgPath = buildShapeSvgPath(off, null, submode);
  if (!svgPath) return null;
  return {
    x: mnX,
    y: mnY,
    width: w,
    height: h,
    origWidth: w,
    origHeight: h,
    svgPath,
    strokeColor: color,
    strokeSize: size,
    opacity,
    linecap: "round",
  };
}

/** Shift every coordinate pair in a pairs-only draw path (M/L/Q/C) by (dx,dy). */
function translatePath(svgPath: string, dx: number, dy: number): string {
  let i = 0;
  return svgPath.replace(/-?\d*\.?\d+/g, (m) => {
    const v = parseFloat(m) + (i++ % 2 === 0 ? dx : dy);
    return String(Number(v.toFixed(2)));
  });
}

/**
 * Patch that resizes a draw element's stroke while keeping the wider stroke from
 * clipping at the viewBox edge. The stroke's half-width can exceed the padding
 * baked in at draw time, so we re-pad the box around the path's own bounds
 * (`newSize/2 + 2`), re-center the element in place, and translate the path to
 * sit at the new inset — the on-screen path scale and center are preserved, and
 * both renderers keep drawing the element into its (now larger) box.
 */
export function strokeSizePatch(el: DrawElement, newSize: number): Partial<DrawElement> {
  const pts = pathPolyline(el.svgPath);
  const stroke = { ...el.stroke, size: newSize };
  if (pts.length === 0) return { stroke };

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const tw = Math.max(...xs) - minX;
  const th = Math.max(...ys) - minY;

  const pad = newSize / 2 + 2;
  const newOrigW = Math.max(tw + 2 * pad, 2);
  const newOrigH = Math.max(th + 2 * pad, 2);
  const sx = el.width / (el.origWidth || el.width || 1);
  const sy = el.height / (el.origHeight || el.height || 1);
  const newW = newOrigW * sx;
  const newH = newOrigH * sy;

  return {
    x: el.x + (el.width - newW) / 2,
    y: el.y + (el.height - newH) / 2,
    width: newW,
    height: newH,
    origWidth: newOrigW,
    origHeight: newOrigH,
    svgPath: translatePath(el.svgPath, pad - minX, pad - minY),
    stroke,
  };
}

/** Coarse polyline of a draw path: every coordinate pair (incl. bezier controls). */
function pathPolyline(svgPath: string): Point[] {
  const nums = svgPath.match(/-?\d*\.?\d+/g);
  if (!nums) return [];
  const pts: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return pts;
}

/** Distance from point (px,py) to the segment a→b. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * True when (x,y) is within `pad` of the stroke's actual path (IN-09), not just
 * its bounding box — so the empty corner of a long diagonal stroke no longer
 * deletes it. The padded bbox is a cheap pre-filter before the segment test.
 */
export function strokeHitTest(
  el: { x: number; y: number; width: number; height: number; origWidth: number; origHeight: number; svgPath: string },
  x: number,
  y: number,
  pad: number,
): boolean {
  if (x < el.x - pad || x > el.x + el.width + pad || y < el.y - pad || y > el.y + el.height + pad) {
    return false;
  }
  const sx = el.width / (el.origWidth || el.width || 1);
  const sy = el.height / (el.origHeight || el.height || 1);
  const pts = pathPolyline(el.svgPath).map((p) => ({ x: el.x + p.x * sx, y: el.y + p.y * sy }));
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(x - pts[0].x, y - pts[0].y) <= pad;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= pad) return true;
  }
  return false;
}

/**
 * Draw elements whose stroke passes within `drawSize / 2 + 6` of the cursor
 * (legacy pad, now measured to the path not the bbox — IN-09).
 */
export function eraseHitIds(
  elements: FolderElement[],
  x: number,
  y: number,
  drawSize: number,
): string[] {
  const pad = drawSize / 2 + 6;
  return elements
    .filter((e) => e.type === "draw" && strokeHitTest(e, x, y, pad))
    .map((e) => e.id);
}

/** Mirror `h1` about the anchor from the dragged `h2` (arc-tool handle drag). */
export function symmetricHandles(anchor: Point, cursor: Point): ControlPoint {
  return {
    x: anchor.x,
    y: anchor.y,
    h2x: cursor.x,
    h2y: cursor.y,
    h1x: 2 * anchor.x - cursor.x,
    h1y: 2 * anchor.y - cursor.y,
  };
}
