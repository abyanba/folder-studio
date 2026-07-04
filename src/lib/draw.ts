/**
 * Draw-tool commit math and eraser hit-testing, ported from the legacy
 * `commitDraw` / `commitShapePath` / erasing branch (docs/index.html
 * L698/L999/L1003). Pure — the pointer wiring lives in `useDrawTool`.
 */

import { buildShapeSvgPath, buildSvgPath, chaikinSmooth } from "./smoothing";
import type { ControlPoint, Point } from "./smoothing";
import type { CreateDrawInput } from "./elementFactories";
import type { ColorValue } from "@/types/gradient";
import type { FolderElement } from "@/types/element";

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
 * `size + 2` padding. Returns null for strokes under 2 points (legacy drops
 * them).
 */
export function computeFreehandCommit(draw: CurrentDraw): CreateDrawInput | null {
  if (draw.points.length < 2) return null;
  const pad = draw.size + 2;
  const smoothed = chaikinSmooth(draw.points, 2);
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
  if (points.length < 1) return null;
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

/**
 * Draw elements whose padded bounding box contains the cursor
 * (legacy eraser: `pad = drawSize / 2 + 6`).
 */
export function eraseHitIds(
  elements: FolderElement[],
  x: number,
  y: number,
  drawSize: number,
): string[] {
  const pad = drawSize / 2 + 6;
  return elements
    .filter(
      (e) =>
        e.type === "draw" &&
        x >= e.x - pad &&
        x <= e.x + e.width + pad &&
        y >= e.y - pad &&
        y <= e.y + e.height + pad,
    )
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
