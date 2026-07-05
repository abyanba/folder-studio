/**
 * Freehand/line/arc path helpers, ported from the legacy drawing code
 * (public/legacy.html L996, L997, L1001-1002).
 */

export interface Point {
  x: number;
  y: number;
}

/** A path anchor with optional cubic-bezier control handles (for the arc tool). */
export interface ControlPoint extends Point {
  h1x?: number;
  h1y?: number;
  h2x?: number;
  h2y?: number;
}

/**
 * Chaikin corner-cutting smoothing. Each iteration replaces every segment with
 * two points at 1/4 and 3/4, keeping the original endpoints.
 */
export function chaikinSmooth(pts: Point[], iterations = 2): Point[] {
  let p = pts;
  for (let i = 0; i < iterations; i++) {
    const np: Point[] = [p[0]];
    for (let j = 0; j < p.length - 1; j++) {
      np.push({
        x: 0.75 * p[j].x + 0.25 * p[j + 1].x,
        y: 0.75 * p[j].y + 0.25 * p[j + 1].y,
      });
      np.push({
        x: 0.25 * p[j].x + 0.75 * p[j + 1].x,
        y: 0.25 * p[j].y + 0.75 * p[j + 1].y,
      });
    }
    np.push(p[p.length - 1]);
    p = np;
  }
  return p;
}

/**
 * Build a quadratic-smoothed SVG path `d` from freehand points, translated by
 * (ox, oy) into local element space. A single point yields a zero-length dot.
 */
export function buildSvgPath(pts: Point[], ox = 0, oy = 0): string {
  if (!pts || !pts.length) return "";
  const p = pts.map((pt) => ({
    x: +(pt.x - ox).toFixed(1),
    y: +(pt.y - oy).toFixed(1),
  }));
  if (p.length === 1) return `M ${p[0].x} ${p[0].y} L ${p[0].x} ${p[0].y}`;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = +((p[i].x + p[i + 1].x) / 2).toFixed(1);
    const my = +((p[i].y + p[i + 1].y) / 2).toFixed(1);
    d += ` Q ${p[i].x} ${p[i].y} ${mx} ${my}`;
  }
  d += ` L ${p[p.length - 1].x} ${p[p.length - 1].y}`;
  return d;
}

/**
 * Build an SVG path `d` for the line/arc tools from anchor points (plus an
 * optional live cursor point). In `"arc"` mode, segments with meaningful control
 * handles become cubic beziers; otherwise straight line segments.
 */
export function buildShapeSvgPath(
  pts: ControlPoint[],
  cursor: Point | null,
  submode: "line" | "arc",
): string {
  const r = (n: number): number => +(+n).toFixed(1);
  const all: ControlPoint[] = [
    ...pts,
    ...(cursor
      ? [
          {
            x: cursor.x,
            y: cursor.y,
            h1x: cursor.x,
            h1y: cursor.y,
            h2x: cursor.x,
            h2y: cursor.y,
          },
        ]
      : []),
  ];
  if (!all.length) return "";
  let d = `M ${r(all[0].x)} ${r(all[0].y)}`;
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const curr = all[i];
    if (submode === "arc") {
      const ph =
        Math.abs((prev.h2x ?? prev.x) - prev.x) > 3 ||
        Math.abs((prev.h2y ?? prev.y) - prev.y) > 3;
      const ch =
        Math.abs((curr.h1x ?? curr.x) - curr.x) > 3 ||
        Math.abs((curr.h1y ?? curr.y) - curr.y) > 3;
      if (ph || ch) {
        d +=
          ` C ${r(ph ? prev.h2x! : prev.x)} ${r(ph ? prev.h2y! : prev.y)}` +
          ` ${r(ch ? curr.h1x! : curr.x)} ${r(ch ? curr.h1y! : curr.y)}` +
          ` ${r(curr.x)} ${r(curr.y)}`;
        continue;
      }
    }
    d += ` L ${r(curr.x)} ${r(curr.y)}`;
  }
  return d;
}
