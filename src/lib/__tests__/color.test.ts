// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getHex, gradientToCss, hexToHsv, textGradientCss } from "@/lib/color";
import type { Gradient } from "@/types/gradient";

const RB: Gradient = {
  kind: "linear",
  angle: 45,
  stops: [
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
  ],
};

describe("color", () => {
  it("converts HSV to hex for primaries", () => {
    expect(getHex(0, 0, 0)).toBe("#000000");
    expect(getHex(0, 0, 1)).toBe("#ffffff");
    expect(getHex(0, 1, 1)).toBe("#ff0000");
    expect(getHex(120, 1, 1)).toBe("#00ff00");
    expect(getHex(240, 1, 1)).toBe("#0000ff");
  });

  it("round-trips hex -> HSV -> hex for exact colors", () => {
    for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"]) {
      const [h, s, v] = hexToHsv(hex);
      expect(getHex(h, s, v)).toBe(hex);
    }
  });

  it("returns [0,0,0] for malformed hex", () => {
    expect(hexToHsv("")).toEqual([0, 0, 0]);
    expect(hexToHsv("#fff")).toEqual([0, 0, 0]);
  });

  it("builds linear and radial gradient CSS", () => {
    const g: Gradient = {
      kind: "linear",
      angle: 90,
      stops: [
        { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
        { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
      ],
    };
    expect(gradientToCss(g)).toBe("linear-gradient(90deg,#ff0000 0%,#0000ff 100%)");
    expect(gradientToCss({ ...g, kind: "radial" })).toBe(
      "radial-gradient(circle,#ff0000 0%,#0000ff 100%)",
    );
  });

  it("sorts gradient stops by position", () => {
    const g: Gradient = {
      kind: "linear",
      angle: 0,
      stops: [
        { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
        { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
      ],
    };
    expect(gradientToCss(g)).toBe("linear-gradient(0deg,#ff0000 0%,#0000ff 100%)");
  });
});

describe("textGradientCss (EXP-05)", () => {
  it("keeps the plain angle for a square box", () => {
    expect(textGradientCss(RB, 100, 100)).toBe(
      "linear-gradient(45.00deg,#ff0000 0%,#0000ff 100%)",
    );
  });

  it("aspect-corrects the angle for a non-square box", () => {
    // atan2(sin45·200, cos45·100) = atan2(2,1) ≈ 63.43°
    expect(textGradientCss(RB, 200, 100)).toBe(
      "linear-gradient(63.43deg,#ff0000 0%,#0000ff 100%)",
    );
  });

  it("uses an explicit max(w,h)/2 radius for radial text gradients", () => {
    expect(textGradientCss({ ...RB, kind: "radial" }, 200, 100)).toBe(
      "radial-gradient(circle 100px at center,#ff0000 0%,#0000ff 100%)",
    );
  });
});
