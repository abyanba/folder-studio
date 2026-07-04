// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  computeTextLayout,
  lineY,
  underlineX,
  underlineYOffset,
} from "@/lib/export/textLayout";

describe("computeTextLayout", () => {
  it("splits lines and centers them vertically around the origin", () => {
    const layout = computeTextLayout("A\nB", 10, 1.3, "center", 100);
    expect(layout.lines).toEqual(["A", "B"]);
    expect(layout.lineHeightPx).toBe(13);
    // totalH = 26, startY = -13 + 6.5
    expect(layout.startY).toBe(-6.5);
    expect(layout.tx).toBe(0);
  });

  it("anchors tx to the left/right edge per alignment", () => {
    expect(computeTextLayout("x", 10, 1, "left", 100).tx).toBe(-50);
    expect(computeTextLayout("x", 10, 1, "right", 100).tx).toBe(50);
    expect(computeTextLayout("x", 10, 1, "center", 100).tx).toBe(0);
  });

  it("defaults line height to 1.3 when falsy", () => {
    expect(computeTextLayout("x", 10, 0, "center", 100).lineHeightPx).toBe(13);
  });

  it("treats empty text as a single empty line", () => {
    expect(computeTextLayout("", 10, 1, "center", 100).lines).toEqual([""]);
  });
});

describe("lineY", () => {
  it("advances the baseline by one line height per index", () => {
    const layout = computeTextLayout("A\nB\nC", 10, 1, "center", 100);
    expect(lineY(layout, 0)).toBe(layout.startY);
    expect(lineY(layout, 1)).toBe(layout.startY + 10);
    expect(lineY(layout, 2)).toBe(layout.startY + 20);
  });
});

describe("underlineX", () => {
  it("positions the underline start per alignment", () => {
    // left: starts at tx; right: tx - width; center: tx - width/2
    expect(underlineX("left", -50, 20)).toBe(-50);
    expect(underlineX("right", 50, 20)).toBe(30);
    expect(underlineX("center", 0, 20)).toBe(-10);
  });
});

describe("underlineYOffset", () => {
  it("sits below the baseline at 0.42 of the font size", () => {
    expect(underlineYOffset(20)).toBeCloseTo(8.4);
  });
});
