import { describe, expect, it } from "vitest";
import {
  BASE_SHAPES,
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
  it("windows solid fill emits a base color and a wg gradient", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ff0000" }));
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('id="wg"');
    expect(svg).toContain("url(#wg)");
  });

  it("windows gradient fill routes through complexDefs", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: gradient }));
    expect(svg).toContain('<linearGradient id="wg"');
    expect(svg).toContain("url(#wg)");
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

describe("BASE_SHAPES ordering", () => {
  it("lists the solid-treatment shapes first", () => {
    expect(BASE_SHAPES[0].id).toBe("windows");
    expect(BASE_SHAPES.map((s) => s.id)).toContain("classic");
  });
});
