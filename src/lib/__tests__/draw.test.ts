// @vitest-environment node
/**
 * Draw commit math and eraser hit-testing (5d), ported from the legacy
 * commitDraw/commitShapePath/erasing behaviors.
 */

import { describe, expect, it } from "vitest";
import {
  computeFreehandCommit,
  computeShapeCommit,
  eraseHitIds,
  strokeSizePatch,
  symmetricHandles,
} from "@/lib/draw";
import { createDrawElement, createShapeElement } from "@/lib/elementFactories";

describe("computeFreehandCommit", () => {
  const draw = {
    points: [
      { x: 10, y: 10 },
      { x: 50, y: 30 },
      { x: 90, y: 10 },
    ],
    color: "#ff0000",
    size: 8,
    opacity: 0.8,
  };

  it("returns null for fewer than 2 points", () => {
    expect(computeFreehandCommit({ ...draw, points: [{ x: 1, y: 1 }] })).toBeNull();
  });

  it("bounds the smoothed stroke with size+2 padding and is deterministic", () => {
    const a = computeFreehandCommit(draw)!;
    const b = computeFreehandCommit(draw)!;
    expect(a).toEqual(b);
    // pad = 10; smoothing keeps endpoints → x spans 10..90.
    expect(a.x).toBe(0);
    expect(a.width).toBe(100);
    expect(a.origWidth).toBe(a.width);
    expect(a.svgPath.startsWith("M ")).toBe(true);
    expect(a.opacity).toBe(0.8);
    expect(a.strokeSize).toBe(8);
  });
});

describe("computeShapeCommit", () => {
  it("returns null with no points", () => {
    expect(computeShapeCommit([], "line", "#fff", 4, 1)).toBeNull();
  });

  it("returns null for a single anchor with no dragged handles (IN-08)", () => {
    // A double-click that left one bare anchor must not commit an invisible path.
    const bare = [{ x: 30, y: 30, h1x: 30, h1y: 30, h2x: 30, h2y: 30 }];
    expect(computeShapeCommit(bare, "line", "#fff", 4, 1)).toBeNull();
    expect(computeShapeCommit(bare, "arc", "#fff", 4, 1)).toBeNull();
  });

  it("commits a single arc anchor whose handles were dragged out", () => {
    const dragged = [{ x: 30, y: 30, h1x: 10, h1y: 10, h2x: 50, h2y: 50 }];
    expect(computeShapeCommit(dragged, "arc", "#fff", 4, 1)).not.toBeNull();
  });

  it("offsets anchors and handles into local space with size+4 padding", () => {
    const pts = [
      { x: 20, y: 20, h1x: 20, h1y: 20, h2x: 40, h2y: 10 },
      { x: 100, y: 60, h1x: 80, h1y: 70, h2x: 100, h2y: 60 },
    ];
    const out = computeShapeCommit(pts, "arc", "#fff", 6, 1)!;
    // pad = 10 → bbox from anchors only: 20..100 / 20..60 → origin (10,10).
    expect(out.x).toBe(10);
    expect(out.y).toBe(10);
    expect(out.width).toBe(100);
    expect(out.height).toBe(60);
    // Handles produced a cubic segment in local coords.
    expect(out.svgPath).toContain("C ");
    expect(out.svgPath.startsWith("M 10 10")).toBe(true);
  });

  it("line mode emits straight segments", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ];
    const out = computeShapeCommit(pts, "line", "#fff", 2, 1)!;
    expect(out.svgPath).toContain("L ");
    expect(out.svgPath).not.toContain("C ");
  });
});

describe("eraseHitIds", () => {
  const drawEl = createDrawElement({
    x: 100,
    y: 100,
    width: 40,
    height: 20,
    origWidth: 40,
    origHeight: 20,
    svgPath: "M 0 0 L 40 20",
    strokeColor: "#fff",
    strokeSize: 4,
  });
  const shapeEl = createShapeElement("rect");
  shapeEl.x = 100;
  shapeEl.y = 100;

  it("hits within pad of the actual stroke path, never other types (IN-09)", () => {
    // Stroke runs (100,100)→(140,120); pad = 8/2+6 = 10.
    const els = [drawEl, shapeEl];
    // Near the start endpoint → hit.
    expect(eraseHitIds(els, 95, 95, 8)).toEqual([drawEl.id]);
    // Exactly on the end → hit.
    expect(eraseHitIds(els, 140, 120, 8)).toEqual([drawEl.id]);
    // Outside the padded bbox entirely → miss.
    expect(eraseHitIds(els, 89, 95, 8)).toEqual([]);
    // Inside the bbox but far from the diagonal (the corner that used to delete
    // the whole stroke) → now a miss.
    expect(eraseHitIds(els, 145, 95, 8)).toEqual([]);
  });
});

describe("strokeSizePatch", () => {
  // A path from (10,10)→(50,30): tight box 40×20, currently padded for size 4.
  const el = createDrawElement({
    x: 100,
    y: 100,
    width: 48,
    height: 28,
    origWidth: 48,
    origHeight: 28,
    svgPath: "M 10 10 L 50 30",
    strokeColor: "#fff",
    strokeSize: 4,
    linecap: "round",
  });

  it("grows the box to fit a wider stroke and keeps the element centered", () => {
    const patch = strokeSizePatch(el, 40);
    // New pad = 40/2 + 2 = 22 → origW = 40 + 44 = 84, origH = 20 + 44 = 64.
    expect(patch.origWidth).toBe(84);
    expect(patch.origHeight).toBe(64);
    // scale was 1 (width==origWidth) so display size tracks origW/origH.
    expect(patch.width).toBe(84);
    expect(patch.height).toBe(64);
    // Center is preserved: old center (124,114) == new center.
    expect(patch.x! + patch.width! / 2).toBeCloseTo(124);
    expect(patch.y! + patch.height! / 2).toBeCloseTo(114);
    expect(patch.stroke).toEqual({ color: "#fff", size: 40, linecap: "round" });
  });

  it("translates the path so it sits at the new inset (pad on every side)", () => {
    const patch = strokeSizePatch(el, 40);
    // minX/minY were 10,10; pad 22 → shift by +12 → path starts at 22,22.
    expect(patch.svgPath).toBe("M 22 22 L 62 42");
  });

  it("re-padding is idempotent for an unchanged size", () => {
    const patch = strokeSizePatch(el, 4);
    // pad = 4 → origW = 40+8 = 48 (unchanged), path re-anchored at 4,4.
    expect(patch.origWidth).toBe(48);
    expect(patch.svgPath).toBe("M 4 4 L 44 24");
  });
});

describe("symmetricHandles", () => {
  it("mirrors h1 about the anchor from the dragged h2", () => {
    const p = symmetricHandles({ x: 50, y: 50 }, { x: 70, y: 40 });
    expect(p).toEqual({ x: 50, y: 50, h2x: 70, h2y: 40, h1x: 30, h1y: 60 });
  });
});
