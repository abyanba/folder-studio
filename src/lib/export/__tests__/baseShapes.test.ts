// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BASE_SHAPES,
  buildBaseShapeOverlaySvg,
  buildBaseShapeSvg,
  getBaseShapeMask,
  toShapeColorState,
} from "@/lib/export/baseShapes";
import { createEmptyDocument } from "@/types/document";
import type { FolderDocument } from "@/types/document";
import type { Gradient } from "@/types/gradient";

const gradient: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
  ],
};

function doc(patch: Partial<FolderDocument>): FolderDocument {
  return { ...createEmptyDocument(), ...patch };
}

describe("toShapeColorState", () => {
  it("derives HSV from a solid hex", () => {
    expect(toShapeColorState("#ff0000")).toEqual({
      mode: "solid",
      hue: 0,
      sat: 1,
      bri: 1,
      stops: [],
      gradType: "linear",
      gradAngle: 0,
    });
  });

  it("passes through gradient kind/angle/stops", () => {
    const cs = toShapeColorState(gradient);
    expect(cs.mode).toBe("gradient");
    expect(cs.gradType).toBe("linear");
    expect(cs.gradAngle).toBe(90);
    expect(cs.stops).toHaveLength(2);
  });
});

describe("buildBaseShapeSvg — simple (template) shapes", () => {
  it("substitutes a solid color and removes both placeholders", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: "#ff0000" }));
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).not.toContain("__COLOR__");
    expect(svg).not.toContain("__DEFS__");
  });

  it("injects a <defs> gradient and url(#fg) fill for a gradient fill", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: gradient }));
    expect(svg).toContain("<defs>");
    expect(svg).toContain('id="fg"');
    expect(svg).toContain("url(#fg)");
    expect(svg).not.toContain("__DEFS__");
    expect(svg).not.toContain("__COLOR__");
  });
});

describe("buildBaseShapeSvg — complex (generator) shapes", () => {
  it("windows solid fill emits front + back gradients and the shine", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ff0000" }));
    // Base color is the front gradient's deep stop.
    expect(svg).toContain('offset="1" stop-color="#ff0000"');
    expect(svg).toContain("url(#wg)");
    // Back panel has its own darker gradient (tab / top strip / bottom rim).
    expect(svg).toContain("url(#wbg)");
    // Top-edge shine: white stroke fading left→right, clipped to the front.
    expect(svg).toContain("url(#wsh)");
    expect(svg).toContain('clip-path="url(#wfc)"');
  });

  it("windows back panel is darker than the base color", () => {
    // Teal base #0098a5 → official-style back darkens hard (low sat headroom).
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#0098a5" }));
    const back = /id="wbg"[^>]*><stop stop-color="(#[0-9a-f]{6})"/.exec(svg);
    expect(back).not.toBeNull();
    // The tab top's HSV value (max RGB channel) must be visibly darker than
    // the base's (0xa5), no matter where the hue shift puts the max channel.
    const channels = [1, 3, 5].map((i) => parseInt(back![1].slice(i, i + 2), 16));
    expect(Math.max(...channels)).toBeLessThan(0xa5 * 0.85);
  });

  it("windows gradient fill keeps the user's gradient on the front and derives the back from the deepest stop", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: gradient }));
    expect(svg).toContain('<linearGradient id="wg"');
    expect(svg).toContain("url(#wg)");
    expect(svg).toContain("url(#wbg)");
    expect(svg).toContain("url(#wsh)");
  });

  it("file-folder solid renders its layered paths", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "file-folder", folderColor: "#3366cc" }));
    expect(svg).toContain('fill="#3366cc"');
    expect(svg).toContain('fill-opacity="0.05"');
  });
});

describe("unknown base shape falls back to the first (classic)", () => {
  it("buildBaseShapeSvg uses classic for an unknown id", () => {
    const unknown = buildBaseShapeSvg(doc({ baseShape: "does-not-exist", folderColor: "#ff0000" }));
    const classic = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: "#ff0000" }));
    expect(unknown).toBe(classic);
  });

  it("getBaseShapeMask returns a white silhouette and falls back for unknowns", () => {
    expect(getBaseShapeMask("classic")).toContain('fill="white"');
    expect(getBaseShapeMask("nope")).toBe(getBaseShapeMask("classic"));
  });
});

describe("buildBaseShapeOverlaySvg — image-fill shading overlay", () => {
  it("windows gets a shading mask (back minus front) plus the shine", () => {
    const svg = buildBaseShapeOverlaySvg("windows");
    expect(svg).not.toBeNull();
    expect(svg).toContain('mask="url(#wvm)"');
    expect(svg).toContain('stroke="url(#wsh)"');
    // Shading is a black gradient, not a flat fill.
    expect(svg).toContain('stop-color="#000000"');
  });

  it("shapes without an overlay treatment return null", () => {
    expect(buildBaseShapeOverlaySvg("classic")).toBeNull();
    expect(buildBaseShapeOverlaySvg("macos")).toBeNull();
    expect(buildBaseShapeOverlaySvg("does-not-exist")).toBeNull();
  });
});

describe("BASE_SHAPES ordering", () => {
  it("lists the solid-treatment shapes first", () => {
    expect(BASE_SHAPES[0].id).toBe("windows");
    expect(BASE_SHAPES.map((s) => s.id)).toContain("classic");
  });
});
