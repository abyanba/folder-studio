// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  baseShapeHasSplit,
  buildBaseShapeOverlaySvg,
  beautydreamDerivedTabColor,
  buildBaseShapeSvg,
  buildFrontImageBackSvg,
  getBaseShapeFillMask,
  getFrontMask,
  isFrontImage,
  shapeVariant,
} from "@/lib/export/baseShapes";
import { isFrontPattern } from "@/lib/export/patterns";
import { isFrontMaterial } from "@/lib/export/materials";
import { createEmptyDocument } from "@/types/document";
import { BEAUTYDREAM_LAVENDER, GRADIENT_PRESETS } from "@/data/gradientPresets";
import type { Gradient } from "@/types/gradient";

const doc = (over: object = {}) => ({
  ...createEmptyDocument(),
  baseShape: "beautydream",
  folderColor: BEAUTYDREAM_LAVENDER,
  ...over,
});

const preset = (n: string): Gradient => ({
  kind: "linear",
  angle: 60,
  stops: GRADIENT_PRESETS.find((p) => p.name === n)!.stops,
});

describe("beautydream", () => {
  it("base variant reproduces the lavender reference gradient", () => {
    const svg = buildBaseShapeSvg(doc());
    // reference: #2E4AFA bottom-left → #8E9EFF top-right (x1 6.7%,y1 75% → 93.3%,25%)
    expect(svg).toContain('x1="6.7%" y1="75.0%" x2="93.3%" y2="25.0%"');
    expect(svg).toContain('stop-color="#2e4afa"');
    expect(svg).toContain('stop-color="#8e9eff"');
  });

  it("preset stops round-trip to the reference hexes", () => {
    const s = buildBaseShapeSvg(doc({ folderColor: preset("Beautydream Sunset") }));
    for (const hex of ["#8a2387", "#ff4e50", "#f9d423"]) expect(s).toContain(hex);
    const c = buildBaseShapeSvg(doc({ folderColor: preset("Beautydream Custom") }));
    for (const hex of ["#b65592", "#fb6f71", "#f9cb52"]) expect(c).toContain(hex);
  });

  it("alternate paints a 50%-opacity tab with the gradient reversed", () => {
    const blue: Gradient = {
      kind: "linear",
      angle: 123, // ignored by the alternate — its angles are the variant
      stops: [
        { id: "0", pos: 0, hue: 212.4, sat: 1, bri: 1 }, // #0075ff
        { id: "1", pos: 1, hue: 187.7, sat: 0.698, bri: 1 }, // #4deaff
      ],
    };
    const svg = buildBaseShapeSvg(doc({ beautydreamVariant: "alternate", folderColor: blue }));
    expect(svg).toContain('opacity="0.5"');
    // front: bottom → top (app angle 0)
    expect(svg).toContain('id="bd_front" x1="50.0%" y1="100.0%" x2="50.0%" y2="0.0%"');
    // tab: top-right → bottom-left (app angle 240), stops swapped
    expect(svg).toContain('id="bd_tab" x1="93.3%" y1="25.0%" x2="6.7%" y2="75.0%"');
    const tab = svg.slice(svg.indexOf('id="bd_tab"'));
    expect(tab.indexOf("#4deaff")).toBeLessThan(tab.indexOf("#0075ff"));
  });

  it("flat drops every gradient", () => {
    const svg = buildBaseShapeSvg(
      doc({ beautydreamVariant: "alternate", beautydreamColorProfile: "flat" }),
    );
    expect(svg).not.toContain("linearGradient");
    expect(svg).toContain('fill="#2e4afa"'); // front = first stop
    expect(svg).toContain('fill="#8e9eff"'); // tab  = last stop
  });
});

describe("beautydream image / pattern / material span", () => {
  const alt = (over: object = {}) => doc({ beautydreamVariant: "alternate", ...over });

  it("only the alternate variant offers a front/back split", () => {
    expect(baseShapeHasSplit("beautydream", "alternate")).toBe(true);
    expect(baseShapeHasSplit("beautydream", "base")).toBe(false);
    expect(shapeVariant(alt())).toBe("alternate");
  });

  it("front-only image applies to the alternate but never to the base", () => {
    const img = { folderFillMode: "image" as const, windowsImageMode: "front" as const };
    expect(isFrontImage(alt(img))).toBe(true);
    expect(isFrontImage(doc(img))).toBe(false);
    // A front-span pattern/material follows the same rule.
    const pattern = { ...createEmptyDocument().pattern, span: "front" as const };
    expect(isFrontPattern("beautydream", pattern, "alternate")).toBe(true);
    expect(isFrontPattern("beautydream", pattern, "base")).toBe(false);
    const material = { ...createEmptyDocument().material, span: "front" as const };
    expect(isFrontMaterial("beautydream", material, "alternate")).toBe(true);
    expect(isFrontMaterial("beautydream", material, "base")).toBe(false);
  });

  it("front-only masks the fill to the front and paints a distinct tab behind it", () => {
    const mask = getFrontMask("beautydream", "alternate");
    expect(mask).toContain("M231.63 63.976"); // the front path
    expect(mask).not.toContain("M185.311 47.2141"); // ...and not the tab
    // The tab behind a photo derives a darker, more saturated tone than the
    // image's own color, so the two panels never read as one slab.
    const back = buildFrontImageBackSvg("beautydream", "#4488cc", null, null, "alternate");
    expect(back).toContain('opacity="0.5"');
    expect(back).toMatch(/fill="#4488cc"/); // front = the adaptive color
    const tab = back.slice(back.indexOf('opacity="0.5"'), back.indexOf('fill-rule'));
    expect(tab).toContain("#275d93"); // darker + richer than #4488cc
  });

  it("full-span fills get a tab-darkening overlay on the alternate only", () => {
    const overlay = buildBaseShapeOverlaySvg("beautydream", "alternate")!;
    expect(overlay).toContain('id="bdvm"');
    expect(overlay).toContain('stop-opacity="0.34"');
    expect(buildBaseShapeOverlaySvg("beautydream", "base")).toBeNull();
    // The full-span mask is the whole silhouette (tab + front).
    const fill = getBaseShapeFillMask(alt({ folderFillMode: "image" }));
    expect(fill).toContain("M185.311 47.2141");
    expect(fill).toContain("M231.63 63.976");
  });
});

describe("beautydream tab color", () => {
  it("a solid pick has no second tone, so both variants darken it instead", () => {
    const solid = doc({ folderColor: "#4488cc" });
    expect(buildBaseShapeSvg(solid)).toContain('fill="#4488cc"');
    expect(beautydreamDerivedTabColor(solid)).toBe("#275d93");
    const svg = buildBaseShapeSvg({ ...solid, beautydreamVariant: "alternate" });
    expect(svg).not.toContain("linearGradient");
    expect(svg).toContain('fill="#275d93"');
  });

  it("seeds the custom-tab field from the gradient's last stop", () => {
    expect(beautydreamDerivedTabColor(doc())).toBe("#8e9eff");
  });

  it("derives the tab from the image color in image-fill mode", () => {
    expect(
      beautydreamDerivedTabColor(doc({ folderFillMode: "image", folderBgImageColor: "#4488cc" })),
    ).toBe("#275d93");
    // ...and falls back to a neutral grey when the image has no sampled color.
    expect(beautydreamDerivedTabColor(doc({ folderFillMode: "image" }))).toBe("#626262");
  });

  it("honours a custom tab color, solid or gradient", () => {
    const alt = { beautydreamVariant: "alternate" as const };
    expect(buildBaseShapeSvg(doc({ ...alt, folderBackColor: "#ff0000" }))).toContain('fill="#ff0000"');
    const g = buildBaseShapeSvg(
      doc({ ...alt, folderBackColor: { kind: "linear", angle: 90, stops: BEAUTYDREAM_LAVENDER.stops } }),
    );
    expect(g).toContain('id="bd_tab" x1="0.0%" y1="50.0%" x2="100.0%" y2="50.0%"');
  });
});
