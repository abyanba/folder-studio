// @vitest-environment node
import { describe, expect, it } from "vitest";
import { containRect } from "@/lib/export/containRect";

describe("containRect", () => {
  it("returns the box unchanged for a matching aspect ratio", () => {
    expect(containRect(100, 100, 200, 200)).toEqual({ dx: 0, dy: 0, dw: 200, dh: 200 });
  });

  it("letterboxes a wide image in a square box (vertical bars top/bottom)", () => {
    // 200×100 into 200×200 → fits width, half height, centered vertically.
    expect(containRect(200, 100, 200, 200)).toEqual({ dx: 0, dy: 50, dw: 200, dh: 100 });
  });

  it("pillarboxes a tall image in a square box (bars left/right)", () => {
    expect(containRect(100, 200, 200, 200)).toEqual({ dx: 50, dy: 0, dw: 100, dh: 200 });
  });

  it("fits into a non-square box on the constraining axis", () => {
    // 100×100 into 400×200 → height-constrained to 200, width 200, centered.
    expect(containRect(100, 100, 400, 200)).toEqual({ dx: 100, dy: 0, dw: 200, dh: 200 });
  });

  it("fills the box when natural size is unknown", () => {
    expect(containRect(0, 0, 120, 80)).toEqual({ dx: 0, dy: 0, dw: 120, dh: 80 });
  });
});
