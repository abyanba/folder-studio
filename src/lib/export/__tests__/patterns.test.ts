// @vitest-environment node
/**
 * The shared pattern tile builder — the one place a PatternSettings becomes SVG
 * for all three render paths. Uses a hand-built body rather than the generated
 * chunk so the math is asserted independently of the baked artwork.
 */

import { describe, expect, it } from "vitest";
import { buildPatternSvg, isFrontPattern, patternTileSize } from "@/lib/export/patterns";
import { createEmptyDocument } from "@/types/document";
import type { PatternBody } from "@/data/generated/patternBodies";

const body: PatternBody = {
  svg: '<svg width="20" height="10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h4v4H0z" fill="{{FG}}" fill-opacity="{{FGO}}"/></svg>',
  w: 20,
  h: 10,
  defaultScale: 2,
};

const settings = (over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...over });
function base() {
  return createEmptyDocument().pattern;
}

describe("buildPatternSvg", () => {
  it("substitutes the foreground color and opacity placeholders", () => {
    const svg = buildPatternSvg(settings({ fgColor: "#ff0000", fgOpacity: 0.25 }), body);
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill-opacity="0.25"');
    expect(svg).not.toContain("{{");
  });

  it("omits the background rect when the background is transparent", () => {
    const svg = buildPatternSvg(settings({ bgColor: "transparent" }), body);
    expect(svg).not.toContain("<rect");
  });

  it("paints the background rect BEHIND the motif", () => {
    const svg = buildPatternSvg(settings({ bgColor: "#0000ff", bgOpacity: 0.5 }), body);
    // Document order is paint order in SVG: the rect must precede the path, or
    // an opaque background would hide the pattern it sits behind.
    expect(svg.indexOf("<rect")).toBeLessThan(svg.indexOf("<path"));
    expect(svg).toContain('fill="#0000ff"');
    expect(svg).toContain('fill-opacity="0.5"');
  });

  it("drops the background rect at zero opacity rather than emitting a no-op", () => {
    expect(buildPatternSvg(settings({ bgColor: "#123456", bgOpacity: 0 }), body)).not.toContain(
      "<rect",
    );
  });

  it("clamps out-of-range opacities instead of emitting invalid SVG", () => {
    expect(buildPatternSvg(settings({ fgOpacity: 5 }), body)).toContain('fill-opacity="1"');
    expect(buildPatternSvg(settings({ fgOpacity: -2 }), body)).toContain('fill-opacity="0"');
  });
});

describe("patternTileSize", () => {
  it("multiplies the baked default scale by the user scale", () => {
    // The baked scale is what normalises 8px..600px tiles into a legible band,
    // so `scale: 1` must mean "the tuned default", not "the raw tile".
    expect(patternTileSize(settings({ scale: 1 }), body)).toEqual({ w: 40, h: 20 });
    expect(patternTileSize(settings({ scale: 0.5 }), body)).toEqual({ w: 20, h: 10 });
  });

  it("never collapses a tile below one unit", () => {
    const t = patternTileSize(settings({ scale: 0.0001 }), body);
    expect(t.w).toBeGreaterThanOrEqual(1);
    expect(t.h).toBeGreaterThanOrEqual(1);
  });
});

describe("isFrontPattern", () => {
  it("is true only for a front span on a shape that has a front/back split", () => {
    expect(isFrontPattern("windows", settings({ span: "front" }))).toBe(true);
    expect(isFrontPattern("macos", settings({ span: "front" }))).toBe(true);
    expect(isFrontPattern("windows", settings({ span: "full" }))).toBe(false);
  });

  it("ignores a front span on shapes with no front panel", () => {
    // Otherwise the pattern would be masked to a front that doesn't exist.
    expect(isFrontPattern("classic", settings({ span: "front" }))).toBe(false);
  });
});
