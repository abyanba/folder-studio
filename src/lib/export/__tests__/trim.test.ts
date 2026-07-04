// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeTrimBounds, computeTrimTransform } from "@/lib/export/trim";

/** Set the alpha byte of pixel (x,y) in a size×size RGBA buffer. */
function setAlpha(data: Uint8ClampedArray, size: number, x: number, y: number, a: number): void {
  data[(y * size + x) * 4 + 3] = a;
}

describe("computeTrimBounds", () => {
  it("finds the opaque bounding box (alpha > 4)", () => {
    const size = 8;
    const data = new Uint8ClampedArray(size * size * 4);
    setAlpha(data, size, 2, 3, 255);
    setAlpha(data, size, 5, 6, 128);
    setAlpha(data, size, 1, 1, 3); // below threshold — ignored
    const b = computeTrimBounds(data, size);
    expect(b).toEqual({ x0: 2, y0: 3, x1: 5, y1: 6, empty: false });
  });

  it("reports empty when nothing is opaque", () => {
    const size = 4;
    const b = computeTrimBounds(new Uint8ClampedArray(size * size * 4), size);
    expect(b.empty).toBe(true);
  });

  it("reports empty for a single opaque pixel (no positive-area box)", () => {
    const size = 4;
    const data = new Uint8ClampedArray(size * size * 4);
    setAlpha(data, size, 2, 2, 255);
    expect(computeTrimBounds(data, size).empty).toBe(true);
  });
});

describe("computeTrimTransform", () => {
  it("returns null for empty bounds", () => {
    expect(computeTrimTransform({ x0: 0, y0: 0, x1: 0, y1: 0, empty: true }, 100)).toBeNull();
  });

  it("pads, scales, and centers a square box", () => {
    // box 40..60 on a 100 canvas → 21px wide, pad = 2 → tw = 25
    const t = computeTrimTransform({ x0: 40, y0: 40, x1: 60, y1: 60, empty: false }, 100);
    expect(t).not.toBeNull();
    expect(t!.tw).toBe(25);
    expect(t!.th).toBe(25);
    expect(t!.srcX).toBe(38);
    expect(t!.srcY).toBe(38);
    expect(t!.scale).toBeCloseTo(4); // 100 / 25
    expect(t!.dw).toBeCloseTo(100);
    expect(t!.dh).toBeCloseTo(100);
    expect(t!.dx).toBeCloseTo(0);
    expect(t!.dy).toBeCloseTo(0);
  });

  it("centers a non-square box on the shorter axis", () => {
    // wide box → scale limited by width; vertical letterboxing
    const t = computeTrimTransform({ x0: 0, y0: 40, x1: 99, y1: 59, empty: false }, 100)!;
    expect(t.dw).toBeGreaterThan(t.dh);
    expect(t.dx).toBeCloseTo(0);
    expect(t.dy).toBeGreaterThan(0);
    // destination is centered
    expect(t.dx * 2 + t.dw).toBeCloseTo(100);
    expect(t.dy * 2 + t.dh).toBeCloseTo(100);
  });
});
