// @vitest-environment node
/**
 * The surface-material shading layer. The layer is grey light-and-shadow only —
 * it must never introduce colour, or it would fight the user's folder colour
 * instead of sitting on it.
 */

import { describe, expect, it } from "vitest";
import {
  MATERIALS,
  materialRegion,
  buildElementMaterialFilter,
  buildMaterialLayerSvg,
  getMaterialRecipe,
  isFrontMaterial,
  withElementMaterial,
} from "@/lib/export/materials";
import { buildShapeSvg } from "@/lib/export/elementSvg";
import { createShapeElement } from "@/lib/elementFactories";
import { createEmptyDocument } from "@/types/document";
import type { MaterialSettings } from "@/types/document";
import type { ElementMaterial, ShapeElement } from "@/types/element";

const MASK = '<svg width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/></svg>';

const settings = (over: Partial<MaterialSettings> = {}): MaterialSettings => ({
  ...createEmptyDocument().material,
  ...over,
});

describe("material recipes", () => {
  it("ships the four surfaces", () => {
    expect(MATERIALS.map((m) => m.id)).toEqual(["leather", "metal", "fabric", "paper"]);
  });

  it("keeps grain coarse enough to survive an icon-scale export", () => {
    // The content rect is 305x200 workspace units and a 256px export scales it
    // to ~205x135. A base frequency much above ~0.2 yields sub-pixel features
    // that wash out entirely — the first paper attempt used 0.5 and vanished.
    for (const m of MATERIALS) {
      const finest = Math.max(m.freq[0], m.freq[1]);
      expect(finest, m.id).toBeLessThanOrEqual(0.4);
    }
  });

  it("only exposes a light-direction control where direction is the effect", () => {
    // Brushed metal reads by its streak direction; the others do not.
    expect(getMaterialRecipe("metal")!.controls).toContain("angle");
    for (const id of ["leather", "fabric", "paper"]) {
      expect(getMaterialRecipe(id)!.controls, id).not.toContain("angle");
    }
  });

  it("resolves unknown and none ids to no material", () => {
    expect(getMaterialRecipe("none")).toBeNull();
    expect(getMaterialRecipe("")).toBeNull();
    expect(getMaterialRecipe("velvet")).toBeNull();
  });
});

describe("buildMaterialLayerSvg", () => {
  it("returns null when no material is selected", () => {
    expect(buildMaterialLayerSvg(settings({ id: "none" }), MASK)).toBeNull();
  });

  it("emits only greyscale lighting — never a colour the user didn't pick", () => {
    const svg = buildMaterialLayerSvg(settings({ id: "leather" }), MASK)!;
    expect(svg).toContain('lighting-color="#ffffff"');
    // No fills or stops that would tint the folder.
    expect(svg).not.toMatch(/fill="#(?!ffffff)[0-9a-f]{6}"/i);
    expect(svg).not.toContain("<stop");
  });

  it("confines the layer to the supplied mask", () => {
    const svg = buildMaterialLayerSvg(settings({ id: "paper" }), MASK)!;
    expect(svg).toContain('<mask id="mmask">');
    expect(svg).toContain('<g mask="url(#mmask)">');
  });

  it("maps intensity onto the layer opacity", () => {
    expect(buildMaterialLayerSvg(settings({ id: "leather", intensity: 0.5 }), MASK)).toContain(
      'opacity="0.5"',
    );
    expect(buildMaterialLayerSvg(settings({ id: "leather", intensity: 9 }), MASK)).toContain(
      'opacity="1"',
    );
  });

  it("coarsens the grain as scale rises", () => {
    // Larger scale must mean larger features, i.e. a LOWER base frequency.
    const fine = buildMaterialLayerSvg(settings({ id: "leather", scale: 1 }), MASK)!;
    const coarse = buildMaterialLayerSvg(settings({ id: "leather", scale: 4 }), MASK)!;
    const freq = (s: string) => Number(/baseFrequency="([\d.]+)/.exec(s)![1]);
    expect(freq(coarse)).toBeLessThan(freq(fine));
  });

  it("honours the brush angle for metal and ignores it elsewhere", () => {
    const metal = buildMaterialLayerSvg(settings({ id: "metal", angle: 20 }), MASK)!;
    expect(metal).toContain('azimuth="20"');
    // Paper has no angle control, so it keeps its recipe azimuth.
    const paper = buildMaterialLayerSvg(settings({ id: "paper", angle: 20 }), MASK)!;
    expect(paper).toContain('azimuth="120"');
  });

  it("namespaces its ids so it can be inlined beside other defs", () => {
    const svg = buildMaterialLayerSvg(settings({ id: "fabric" }), MASK, "ml")!;
    expect(svg).toContain('id="mlf"');
    expect(svg).toContain('id="mlmask"');
  });
});

describe("buildElementMaterialFilter", () => {
  const mat = (over: Partial<ElementMaterial> = {}): ElementMaterial => ({
    id: "leather",
    intensity: 0.7,
    scale: 1,
    angle: 90,
    ...over,
  });

  it("returns null when there is no material", () => {
    expect(buildElementMaterialFilter(mat({ id: "none" }), "f")).toBeNull();
  });

  it("clips the grain to the element's own alpha", () => {
    // Without this the grain would paint across the whole filter region and
    // smear over whatever sits behind the element.
    expect(buildElementMaterialFilter(mat(), "f")).toContain('in2="SourceAlpha" operator="in"');
  });

  it("blends the grain back over the element, not instead of it", () => {
    const svg = buildElementMaterialFilter(mat(), "f")!;
    expect(svg).toContain('in2="SourceGraphic" mode="soft-light"');
  });

  it("carries intensity as the grain's alpha", () => {
    expect(buildElementMaterialFilter(mat({ intensity: 0.4 }), "f")).toContain('slope="0.4"');
  });

  it("stays greyscale so the element's own colour survives", () => {
    expect(buildElementMaterialFilter(mat(), "f")).toContain('lighting-color="#ffffff"');
  });

  it("takes an explicit user-space region rather than a bbox percentage", () => {
    // Percentages resolve against the object bounding box, which for a masked
    // outside stroke is not the painted extent — that quietly eroded ~3% off
    // the stroke ring. Verified in Chrome: userSpaceOnUse restores it exactly.
    const svg = buildElementMaterialFilter(mat(), "f", 1, 1, { x: -12, y: -12, w: 148, h: 148 })!;
    expect(svg).toContain('filterUnits="userSpaceOnUse" x="-12" y="-12" width="148" height="148"');
    expect(svg).not.toContain("%");
  });

  it("inflates a region so grain covers what paints outside the box", () => {
    expect(materialRegion(100, 100, 0.15)).toEqual({ x: -15, y: -15, w: 130, h: 130 });
    // A shape's viewBox is offset when an outside stroke widens it.
    expect(materialRegion(124, 124, 0.5, -12, -12)).toEqual({ x: -74, y: -74, w: 248, h: 248 });
  });

  it("converts frequency into the caller's coordinate system", () => {
    const base = buildElementMaterialFilter(mat(), "f", 1, 1)!;
    const half = buildElementMaterialFilter(mat(), "f", 0.5, 0.5)!;
    const freq = (s: string): number[] =>
      /baseFrequency="([\d.]+) ([\d.]+)"/.exec(s)!.slice(1, 3).map(Number);
    expect(freq(half)[0]).toBeCloseTo(freq(base)[0] / 2, 6);
    expect(freq(half)[1]).toBeCloseTo(freq(base)[1] / 2, 6);
  });
});

describe("withElementMaterial", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>';
  const mat: ElementMaterial = { id: "fabric", intensity: 0.7, scale: 1, angle: 90 };

  it("leaves the element untouched when it has no material", () => {
    expect(withElementMaterial(svg, undefined, "x")).toBe(svg);
    expect(withElementMaterial(svg, { ...mat, id: "none" }, "x")).toBe(svg);
  });

  it("wraps the whole element so the grain sits above every fill and stroke", () => {
    const out = withElementMaterial(svg, mat, "x");
    expect(out).toContain('<g filter="url(#x)"><rect width="100" height="100"/></g>');
    // The root tag and its viewBox must survive, or the element would resize.
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">')).toBe(true);
  });
});

describe("element material scale-invariance", () => {
  // The bug class this exists to catch: a builder that derives grain frequency
  // from the RENDERED size looks right in the editor and wrong in every export,
  // and a test that only ever checks one size can't see it.
  const shape = (): ShapeElement => ({
    ...createShapeElement("rect"),
    material: { id: "leather", intensity: 0.7, scale: 1, angle: 90 },
  });

  const freq = (s: string): string => /baseFrequency="([^"]+)"/.exec(s)![1];

  it("gives a shape the same grain at editor size and at export size", () => {
    const el = shape();
    // Editor renders at workspace units; a 256px export renders at ~0.67x.
    expect(freq(buildShapeSvg(el, el.width, el.height))).toBe(
      freq(buildShapeSvg(el, el.width * 0.674, el.height * 0.674)),
    );
    // ...and at 1024px, ~2.7x.
    expect(freq(buildShapeSvg(el, el.width * 2.695, el.height * 2.695))).toBe(
      freq(buildShapeSvg(el, el.width, el.height)),
    );
  });

  it("gives a bigger shape more grain, not stretched grain", () => {
    const small = { ...shape(), width: 50, height: 50 };
    const big = { ...shape(), width: 200, height: 200 };
    const f = (el: ShapeElement): number => Number(freq(buildShapeSvg(el, el.width, el.height)).split(" ")[0]);
    // Frequency is per viewBox unit and the viewBox is normalized, so a shape
    // 4x larger must carry 4x the frequency to keep the grain the same size.
    expect(f(big)).toBeCloseTo(f(small) * 4, 6);
  });
});

describe("isFrontMaterial", () => {
  it("is true only for a front span on a shape with a front/back split", () => {
    expect(isFrontMaterial("windows", settings({ span: "front" }))).toBe(true);
    expect(isFrontMaterial("macos", settings({ span: "front" }))).toBe(true);
    expect(isFrontMaterial("windows", settings({ span: "full" }))).toBe(false);
    expect(isFrontMaterial("classic", settings({ span: "front" }))).toBe(false);
  });
});
