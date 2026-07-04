// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CDW, CDH } from "@/lib/constants";
import {
  elementCenterClient,
  groupMoveSnap,
  marqueeHits,
  marqueeToContent,
} from "@/lib/workspaceGeometry";
import type { IdRect } from "@/lib/workspaceGeometry";

describe("groupMoveSnap", () => {
  it("applies the raw delta when the group is far from center", () => {
    const els: IdRect[] = [
      { id: "a", x: 0, y: 0, width: 20, height: 20 },
      { id: "b", x: 10, y: 0, width: 20, height: 20 },
    ];
    const r = groupMoveSnap(els, 5, 5);
    expect(r.snapV).toBe(false);
    expect(r.snapH).toBe(false);
    expect(r.overrides.a).toEqual({ x: 5, y: 5 });
    expect(r.overrides.b).toEqual({ x: 15, y: 5 });
  });

  it("snaps the group's center to the content-rect center on X", () => {
    const els: IdRect[] = [
      { id: "a", x: 0, y: 0, width: 100, height: 100 },
      { id: "b", x: 100, y: 0, width: 100, height: 100 },
    ];
    // group center x = 100; +50 → 150, within 7px of CDW/2 = 152.5
    const r = groupMoveSnap(els, 50, 0);
    expect(r.snapV).toBe(true);
    expect(r.snapVX).toBe(CDW / 2);
    expect(r.overrides.a.x).toBeCloseTo(52.5);
    expect(r.overrides.b.x).toBeCloseTo(152.5);
  });
});

describe("elementCenterClient", () => {
  it("offsets by the content-rect origin", () => {
    const c = elementCenterClient({ left: 100, top: 200 }, { x: 10, y: 20, width: 40, height: 60 });
    // 100 + CDX(38) + 10 + 20 ; 200 + CDY(130) + 20 + 30
    expect(c.cx).toBe(168);
    expect(c.cy).toBe(380);
  });
});

describe("marqueeToContent", () => {
  it("maps client corners to content space and normalizes", () => {
    // wsRect offset so that content origin lands at client (0,0)
    const rect = marqueeToContent({ left: -38, top: -130 }, 60, 80, 10, 20);
    expect(rect).toEqual({ x: 10, y: 20, width: 50, height: 60 });
  });
});

describe("marqueeHits", () => {
  it("returns ids of elements overlapping the rect", () => {
    const els: IdRect[] = [
      { id: "a", x: 10, y: 10, width: 20, height: 20 }, // inside
      { id: "b", x: 100, y: 100, width: 10, height: 10 }, // outside
      { id: "c", x: 40, y: 40, width: 30, height: 30 }, // overlaps edge
    ];
    expect(marqueeHits(els, { x: 0, y: 0, width: 50, height: 50 })).toEqual(["a", "c"]);
  });

  it("uses CDW/CDH-independent overlap (touching edges do not count)", () => {
    const els: IdRect[] = [{ id: "a", x: 50, y: 0, width: 10, height: 10 }];
    // rect right edge exactly at element left (50) → no overlap
    expect(marqueeHits(els, { x: 0, y: 0, width: 50, height: CDH })).toEqual([]);
  });
});
