/**
 * Draw commit math and eraser hit-testing (5d), ported from the legacy
 * commitDraw/commitShapePath/erasing behaviors.
 */

import { describe, expect, it } from "vitest";
import {
  computeFreehandCommit,
  computeShapeCommit,
  eraseHitIds,
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

  it("hits draw elements within bbox + drawSize/2+6 padding, never other types", () => {
    const els = [drawEl, shapeEl];
    // pad = 8/2+6 = 10 → hit zone x 90..150, y 90..130.
    expect(eraseHitIds(els, 95, 95, 8)).toEqual([drawEl.id]);
    expect(eraseHitIds(els, 89, 95, 8)).toEqual([]);
    expect(eraseHitIds(els, 149, 129, 8)).toEqual([drawEl.id]);
    expect(eraseHitIds(els, 151, 129, 8)).toEqual([]);
  });
});

describe("symmetricHandles", () => {
  it("mirrors h1 about the anchor from the dragged h2", () => {
    const p = symmetricHandles({ x: 50, y: 50 }, { x: 70, y: 40 });
    expect(p).toEqual({ x: 50, y: 50, h2x: 70, h2y: 40, h1x: 30, h1y: 60 });
  });
});
