// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeRotation, resizeElement, rotateAngle, snapMove } from "@/lib/geometry";

describe("rotateAngle", () => {
  it("maps pointer direction to degrees with a +90 offset, folded into (-180,180]", () => {
    expect(rotateAngle(0, 0, 1, 0)).toBeCloseTo(90);
    expect(rotateAngle(0, 0, 0, 1)).toBeCloseTo(180);
    // AR-08: the raw `atan2 + 90` here is 270; one convention means -90.
    expect(rotateAngle(0, 0, -1, 0)).toBeCloseTo(-90);
  });
});

describe("normalizeRotation", () => {
  it("folds any angle into (-180, 180]", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(-90);
    expect(normalizeRotation(-270)).toBe(90);
    expect(normalizeRotation(720 + 45)).toBe(45);
    expect(normalizeRotation(-360)).toBe(0);
  });
});

describe("resizeElement (rotation = 0)", () => {
  const el = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };

  it("east handle keeps the west edge fixed", () => {
    const r = resizeElement(el, "e", 20, 0);
    expect(r).toEqual({ x: 0, y: 0, width: 120, height: 100 });
  });

  it("se corner preserves aspect ratio and pins the NW corner", () => {
    const r = resizeElement(el, "se", 20, 0);
    expect(r).toEqual({ x: 0, y: 0, width: 120, height: 120 });
  });

  it("clamps to a minimum of 20px", () => {
    const r = resizeElement(el, "e", -1000, 0);
    expect(r.width).toBe(20);
  });
});

describe("snapMove", () => {
  const el = { x: 100, y: 100, width: 50, height: 50 };

  it("snaps the left edge to the content-rect origin within threshold", () => {
    const r = snapMove(el, [], -96, 0);
    expect(r.x).toBe(0);
    expect(r.snapV).toBe(true);
    expect(r.snapVX).toBe(0);
  });

  it("does not snap when outside the 7px threshold", () => {
    const r = snapMove(el, [], -50, 0);
    expect(r.x).toBe(50);
    expect(r.snapV).toBe(false);
  });

  it("snaps to another element's edge", () => {
    const other = { x: 10, y: 100, width: 50, height: 50 };
    const r = snapMove(el, [other], -88, 0); // left edge -> 12, snaps to other.x = 10
    expect(r.x).toBe(10);
    expect(r.snapV).toBe(true);
    expect(r.snapVX).toBe(10);
  });

  it("picks the NEAREST candidate, not the first in iteration order (IN-05)", () => {
    // Left edge lands at 10: 5px from other A (15), 2px from other B (12).
    const a = { x: 15, y: 100, width: 50, height: 50 };
    const b = { x: 12, y: 100, width: 50, height: 50 };
    const r = snapMove(el, [a, b], -90, 0);
    expect(r.x).toBe(12); // the closer target, not A's 15
    expect(r.snapVX).toBe(12);
  });

  it("moves freely with snapping disabled (Alt held)", () => {
    const r = snapMove(el, [], -96, 0, true);
    expect(r.x).toBe(4);
    expect(r.snapV).toBe(false);
    expect(r.snapVX).toBeNull();
  });
});
