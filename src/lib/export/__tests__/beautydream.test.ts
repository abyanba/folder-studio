// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  baseShapeHasSplit,
  buildBaseShapeOverlaySvg,
  beautydreamDerivedTabColor,
  buildBaseShapeSvg,
  buildFrontImageBackSvg,
  getBaseShapeFillMask,
  getImageFillMask,
  getFrontMask,
  isFrontImage,
  shapeVariant,
} from "@/lib/export/baseShapes";
import { isFrontPattern } from "@/lib/export/patterns";
import { isFrontMaterial } from "@/lib/export/materials";
import { createEmptyDocument } from "@/types/document";
import { GRADIENT_PRESETS } from "@/data/gradientPresets";
import type { Gradient } from "@/types/gradient";

/** The shape's own default: the reference lavender, as a SOLID pick. */
const LAVENDER = "#2e4afa";

const doc = (over: object = {}) => ({
  ...createEmptyDocument(),
  baseShape: "beautydream",
  folderColor: LAVENDER,
  ...over,
});

const preset = (n: string): Gradient => ({
  kind: "linear",
  angle: 60,
  stops: GRADIENT_PRESETS.find((p) => p.name === n)!.stops,
});

describe("beautydream gradient-fill mode", () => {
  it("takes a multi-stop gradient pick as authored", () => {
    // Sunset/Custom are 3-tone designs — no single solid can express them, so
    // they stay gradient presets and the builder must not re-derive them.
    const s = buildBaseShapeSvg(doc({ folderColor: preset("Beautydream Sunset") }));
    for (const hex of ["#8a2387", "#ff4e50", "#f9d423"]) expect(s).toContain(hex);
    const c = buildBaseShapeSvg(doc({ folderColor: preset("Beautydream Custom") }));
    for (const hex of ["#b65592", "#fb6f71", "#f9cb52"]) expect(c).toContain(hex);
    // An authored gradient keeps its own angle (it is not a default), on both
    // variants; only the DERIVED sweep is pinned to the shape's 60°.
    expect(buildBaseShapeSvg(doc({ folderColor: { ...preset("Beautydream Sunset"), angle: 0 } })))
      .toContain('x1="50.0%" y1="100.0%" x2="50.0%" y2="0.0%"');
    expect(
      buildBaseShapeSvg(
        doc({ folderColor: { ...preset("Beautydream Sunset"), angle: 0 }, beautydreamVariant: "alternate" }),
      ),
    ).toContain('id="bd_front" x1="50.0%" y1="100.0%" x2="50.0%" y2="0.0%"');
  });

  it("flat takes the first stop of a gradient pick", () => {
    const svg = buildBaseShapeSvg(
      doc({ folderColor: preset("Beautydream Sunset"), beautydreamColorProfile: "flat" }),
    );
    expect(svg).not.toContain("linearGradient");
    expect(svg).toContain('fill="#8a2387"');
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
    // The image's adaptive color runs through the same anchors, so the tab is
    // the derived far tone — a distinct panel, not a copy of the photo.
    const front = back.slice(back.indexOf('id="bd_front"'), back.indexOf('id="bd_tab"'));
    expect(front).toContain('#4488cc');
    const tab = back.slice(back.indexOf('id="bd_tab"'), back.indexOf('</defs>'));
    expect(tab.indexOf('#92bfdd')).toBeLessThan(tab.indexOf('#4488cc'));
  });

  it("a full-span image carries the tab at half alpha, like the color render", () => {
    const img = { folderFillMode: "image" as const, windowsImageMode: "full" as const };
    const mask = getImageFillMask(doc({ ...img, beautydreamVariant: "alternate" }));
    // Tab at 0.5, front opaque and drawn over it (so the overlap composites to 1).
    expect(mask).toContain('d="M185.311 47.2141H150.779C142.176 47.2709 134.009 43.4442 128.557 36.8026L117.185 21.0814C111.825 14.3814 103.658 10.5368 95.0681 10.6698H70.6553C26.8379 10.6698 10.6671 36.3861 10.6671 80.114L10.667 106.666C10.6126 111.864 101.319 74.5246 101.334 69.3332L127.966 60.306C138.667 63.9998 208 53.3332 185.311 47.2141Z" fill="#ffffff" opacity="0.5"');
    expect(mask.indexOf("M185.311")).toBeLessThan(mask.indexOf("M231.63"));
    // The one-piece base variant has no tab, so it keeps the plain opaque mask.
    expect(getImageFillMask(doc(img))).not.toContain('opacity="0.5"');
    // No shading overlay is needed on top — the half-alpha tab does the work.
    expect(buildBaseShapeOverlaySvg("beautydream", "alternate")).toBeNull();
    expect(buildBaseShapeOverlaySvg("beautydream", "base")).toBeNull();
    // The full-span mask is the whole silhouette (tab + front).
    const fill = getBaseShapeFillMask(alt({ folderFillMode: "image" }));
    expect(fill).toContain("M185.311 47.2141");
    expect(fill).toContain("M231.63 63.976");
  });
});

describe("beautydream tab color", () => {
  it("seeds the custom-tab field from the derived far tone", () => {
    expect(beautydreamDerivedTabColor(doc())).toBe("#8e9eff");
    expect(beautydreamDerivedTabColor(doc({ folderColor: "#fd5900" }))).toBe("#ffde00");
  });

  it("derives the tab from the image color in image-fill mode", () => {
    expect(
      beautydreamDerivedTabColor(doc({ folderFillMode: "image", folderBgImageColor: "#22b4fa" })),
    ).toBe("#7ddcff");
  });

  it("honours a custom tab color, solid or gradient", () => {
    const alt = { beautydreamVariant: "alternate" as const };
    expect(buildBaseShapeSvg(doc({ ...alt, folderBackColor: "#ff0000" }))).toContain('fill="#ff0000"');
    const g = buildBaseShapeSvg(
      doc({
        ...alt,
        folderBackColor: {
          kind: "linear" as const,
          angle: 90,
          stops: [
            { id: "0", pos: 0, hue: 0, sat: 1, bri: 1 },
            { id: "1", pos: 1, hue: 120, sat: 1, bri: 1 },
          ],
        },
      }),
    );
    expect(g).toContain('id="bd_tab" x1="0.0%" y1="50.0%" x2="100.0%" y2="50.0%"');
  });
});
