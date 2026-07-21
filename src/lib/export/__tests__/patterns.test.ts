// @vitest-environment node
/**
 * The shared pattern layer builder — the single SVG all three render paths
 * consume (editor injects, canvas rasterizes, vector export inlines). Uses a
 * hand-built body rather than the generated chunk so the composition is
 * asserted independently of the baked artwork.
 */

import { describe, expect, it } from "vitest";
import {
  buildPatternLayerSvg,
  buildPatternSvg,
  isFrontPattern,
  patternTileSize,
} from "@/lib/export/patterns";
import { createEmptyDocument } from "@/types/document";
import type { PatternSettings } from "@/types/document";
import type { Gradient } from "@/types/gradient";
import type { PatternBody } from "@/data/generated/patternBodies";

const body: PatternBody = {
  svg: '<svg width="20" height="10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h4v4H0z" fill="{{FG}}" fill-opacity="{{FGO}}"/></svg>',
  w: 20,
  h: 10,
  defaultScale: 2,
};

const MASK = '<svg width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/></svg>';

const settings = (over: Partial<PatternSettings> = {}): PatternSettings => ({
  ...createEmptyDocument().pattern,
  ...over,
});

const gradient: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "0", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "1", pos: 1, hue: 200, sat: 1, bri: 1 },
  ],
};

describe("buildPatternSvg (tile)", () => {
  it("substitutes a solid foreground colour and opacity", () => {
    const svg = buildPatternSvg(settings({ fgColor: "#ff0000", fgOpacity: 0.25 }), body);
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill-opacity="0.25"');
    expect(svg).not.toContain("{{");
  });

  it("paints a gradient foreground as WHITE, since the tile becomes an alpha mask", () => {
    // A gradient baked into the tile would restart every repeat instead of
    // spanning the folder, so the tile carries only coverage, not colour.
    const svg = buildPatternSvg(settings({ fgColor: gradient }), body);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain("{{");
  });

  it("clamps out-of-range opacities instead of emitting invalid SVG", () => {
    expect(buildPatternSvg(settings({ fgOpacity: 5 }), body)).toContain('fill-opacity="1"');
    expect(buildPatternSvg(settings({ fgOpacity: -2 }), body)).toContain('fill-opacity="0"');
  });

  it("never carries the background — that is a folder-wide layer", () => {
    // Per-tile it would sit under a gradient-masked foreground and could leave
    // gaps at the corners once the tiling rotates.
    expect(buildPatternSvg(settings({ bgColor: "#0000ff", bgOpacity: 1 }), body)).not.toContain(
      "<rect",
    );
  });
});

describe("buildPatternLayerSvg", () => {
  it("wraps everything in the supplied folder mask", () => {
    const svg = buildPatternLayerSvg(settings(), body, MASK);
    expect(svg).toContain('<mask id="pfolder">');
    expect(svg).toContain('<g mask="url(#pfolder)">');
  });

  it("gives the tile a viewBox so a scaled pattern fills its cell", () => {
    // Regression: without it the motif paints at natural size in the corner.
    const svg = buildPatternLayerSvg(settings({ scale: 1 }), body, MASK);
    expect(svg).toContain('width="40" height="20"'); // 20x10 tile at defaultScale 2
    expect(svg).toContain('viewBox="0 0 20 10"');
  });

  it("omits the background wash at zero opacity — the default transparent state", () => {
    expect(buildPatternLayerSvg(settings({ bgOpacity: 0 }), body, MASK)).not.toContain(
      'fill-opacity="0"',
    );
  });

  it("paints the background wash BEHIND the motif", () => {
    const svg = buildPatternLayerSvg(settings({ bgColor: "#0000ff", bgOpacity: 0.5 }), body, MASK);
    // Document order is paint order: the wash must precede the pattern rect.
    expect(svg.indexOf('fill="#0000ff"')).toBeLessThan(svg.indexOf("url(#ptile)"));
  });

  it("masks a folder-wide gradient with the tile rather than tinting each tile", () => {
    const svg = buildPatternLayerSvg(settings({ fgColor: gradient }), body, MASK);
    expect(svg).toContain('<linearGradient id="pgrad"');
    expect(svg).toContain('<mask id="pink">');
    expect(svg).toContain('fill="url(#pgrad)" mask="url(#pink)"');
    // The gradient spans the whole frame, not a tile.
    expect(svg).toContain('<rect width="380" height="380" fill="url(#pgrad)"');
  });

  it("emits no gradient machinery for a solid foreground", () => {
    const svg = buildPatternLayerSvg(settings({ fgColor: "#ff0000" }), body, MASK);
    expect(svg).not.toContain("pgrad");
    expect(svg).not.toContain("pink");
    expect(svg).toContain('fill="url(#ptile)"');
  });

  it("shifts the tiling origin via the pattern's x/y", () => {
    const svg = buildPatternLayerSvg(settings({ offsetX: 12, offsetY: -7 }), body, MASK);
    expect(svg).toContain('x="12" y="-7"');
  });

  it("rotates the tiling via patternTransform, leaving a gradient fixed to the folder", () => {
    const svg = buildPatternLayerSvg(settings({ fgColor: gradient, rotation: 45 }), body, MASK);
    expect(svg).toContain('patternTransform="rotate(45 190 190)"');
    // The gradient element itself carries no rotation.
    expect(svg).not.toMatch(/<linearGradient[^>]*rotate/);
  });

  it("namespaces its ids so the markup can be inlined beside other defs", () => {
    const svg = buildPatternLayerSvg(settings({ fgColor: gradient }), body, MASK, "pl");
    expect(svg).toContain('id="pltile"');
    expect(svg).toContain('id="plfolder"');
    expect(svg).toContain('id="plink"');
    expect(svg).toContain('id="plgrad"');
  });
});

describe("patternTileSize", () => {
  it("multiplies the baked default scale by the user scale", () => {
    // The baked scale normalises 8px..600px tiles, so `scale: 1` means "the
    // tuned default", not "the raw tile".
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
  it("is true only for a front span on a shape with a front/back split", () => {
    expect(isFrontPattern("windows", settings({ span: "front" }))).toBe(true);
    expect(isFrontPattern("macos", settings({ span: "front" }))).toBe(true);
    expect(isFrontPattern("windows", settings({ span: "full" }))).toBe(false);
  });

  it("ignores a front span on shapes with no front panel", () => {
    expect(isFrontPattern("classic", settings({ span: "front" }))).toBe(false);
  });
});
