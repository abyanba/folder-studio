/**
 * Pure gradient math used by the editor: neighbor interpolation for
 * click-added stops (legacy parity) and the hex→seed-gradient conversion.
 */

import { describe, expect, it } from "vitest";
import { interpolateStop } from "@/components/color/GradientEditor";
import { gradientFromHex } from "@/components/color/ColorField";
import type { GradientStop } from "@/types/gradient";

const stops: GradientStop[] = [
  { id: "a", pos: 0, hue: 100, sat: 0.2, bri: 0.4 },
  { id: "b", pos: 1, hue: 200, sat: 0.8, bri: 1 },
];

describe("interpolateStop", () => {
  it("lerps HSV between neighbors", () => {
    const mid = interpolateStop(stops, 0.5);
    expect(mid.hue).toBeCloseTo(150);
    expect(mid.sat).toBeCloseTo(0.5);
    expect(mid.bri).toBeCloseTo(0.7);
    expect(mid.pos).toBe(0.5);
  });

  it("copies the nearest stop outside the range", () => {
    const inner: GradientStop[] = [
      { id: "a", pos: 0.4, hue: 100, sat: 0.2, bri: 0.4 },
      { id: "b", pos: 0.6, hue: 200, sat: 0.8, bri: 1 },
    ];
    expect(interpolateStop(inner, 0.1).hue).toBe(100);
    expect(interpolateStop(inner, 0.9).hue).toBe(200);
  });

  it("interpolates against unsorted stop arrays", () => {
    const mid = interpolateStop([stops[1], stops[0]], 0.25);
    expect(mid.hue).toBeCloseTo(125);
  });
});

describe("gradientFromHex", () => {
  it("seeds a linear gradient anchored on the hex color", () => {
    const g = gradientFromHex("#ff0000"); // hue 0, sat 1, bri 1
    expect(g.kind).toBe("linear");
    expect(g.angle).toBe(90);
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0].pos).toBe(0);
    expect(g.stops[0].hue).toBeCloseTo(0);
    expect(g.stops[0].sat).toBeCloseTo(1);
    expect(g.stops[1].hue).toBeCloseTo(40);
    expect(g.stops[0].id).not.toBe(g.stops[1].id);
  });
});
