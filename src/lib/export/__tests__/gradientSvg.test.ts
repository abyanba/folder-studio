// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  gradSVGCoords,
  gradientDefs,
  gradientDefsUserSpace,
  gradientElement,
  gradientElementUserSpace,
  gradientLine,
  gradientStops,
} from "@/lib/export/gradientSvg";
import type { Gradient } from "@/types/gradient";

const linear: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
  ],
};

describe("gradSVGCoords", () => {
  it("maps 0deg bottom→top", () => {
    expect(gradSVGCoords(0)).toEqual({ x1: "50.0%", y1: "100.0%", x2: "50.0%", y2: "0.0%" });
  });
  it("maps 90deg left→right", () => {
    expect(gradSVGCoords(90)).toEqual({ x1: "0.0%", y1: "50.0%", x2: "100.0%", y2: "50.0%" });
  });
  it("maps 180deg top→bottom", () => {
    expect(gradSVGCoords(180)).toEqual({ x1: "50.0%", y1: "0.0%", x2: "50.0%", y2: "100.0%" });
  });
});

describe("gradientLine", () => {
  it("gives box-scaled userSpace endpoints (90deg → left→right)", () => {
    const l = gradientLine(90, 100, 40);
    expect(l.x1).toBeCloseTo(0);
    expect(l.x2).toBeCloseTo(100);
    expect(l.y1).toBeCloseTo(20);
    expect(l.y2).toBeCloseTo(20);
  });
  it("scales endpoints to the box aspect (45deg, wide box)", () => {
    const l = gradientLine(45, 200, 100);
    // dx = sin·w = 0.707·200 ≈ 141.4, dy = -cos·h = -0.707·100 ≈ -70.7
    expect(l.x2 - l.x1).toBeCloseTo(Math.sin(Math.PI / 4) * 200);
    expect(l.y2 - l.y1).toBeCloseTo(-Math.cos(Math.PI / 4) * 100);
  });
});

describe("gradientStops", () => {
  it("emits stops sorted by position with hex colors", () => {
    expect(gradientStops(linear)).toBe(
      '<stop offset="0%" stop-color="#ff0000"/><stop offset="100%" stop-color="#0000ff"/>',
    );
  });
  it("adds stop-opacity only for stops with alpha < 1 (fade to transparent)", () => {
    const g: Gradient = {
      kind: "linear",
      angle: 90,
      stops: [
        { id: "a", pos: 0, hue: 0, sat: 1, bri: 1, alpha: 1 },
        { id: "b", pos: 1, hue: 0, sat: 1, bri: 1, alpha: 0 },
      ],
    };
    expect(gradientStops(g)).toBe(
      '<stop offset="0%" stop-color="#ff0000"/><stop offset="100%" stop-color="#ff0000" stop-opacity="0"/>',
    );
  });
});

describe("gradientElement", () => {
  it("builds a linear gradient with angle coords", () => {
    const out = gradientElement("g1", linear);
    expect(out).toContain('<linearGradient id="g1"');
    expect(out).toContain('x1="0.0%"');
    expect(out).toContain('stop-color="#ff0000"');
  });
  it("builds a radial gradient centered at 50%", () => {
    const out = gradientElement("g2", { ...linear, kind: "radial" });
    expect(out).toContain('<radialGradient id="g2" cx="50%" cy="50%" r="50%">');
  });
  it("gradientDefs wraps the element in <defs>", () => {
    expect(gradientDefs("g3", linear)).toBe(`<defs>${gradientElement("g3", linear)}</defs>`);
  });
});

describe("gradientElementUserSpace", () => {
  it("uses userSpaceOnUse with viewBox-relative endpoints for linear", () => {
    const out = gradientElementUserSpace("d1", { ...linear, angle: 90 }, 100, 40);
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
    // angle 90: x1 = 50 - sin*50 = 0.0, x2 = 100.0; y stays at height/2 = 20.0
    expect(out).toContain('x1="0.0"');
    expect(out).toContain('x2="100.0"');
    expect(out).toContain('y1="20.0"');
  });
  it("uses centered radius for radial userSpace", () => {
    const out = gradientElementUserSpace("d2", { ...linear, kind: "radial" }, 100, 40);
    expect(out).toContain('cx="50" cy="20" r="50"');
  });
  it("gradientDefsUserSpace wraps in <defs>", () => {
    expect(gradientDefsUserSpace("d3", linear, 10, 10)).toBe(
      `<defs>${gradientElementUserSpace("d3", linear, 10, 10)}</defs>`,
    );
  });
});
