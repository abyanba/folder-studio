// @vitest-environment node
/**
 * The surface-material shading layer. The layer is grey light-and-shadow only —
 * it must never introduce colour, or it would fight the user's folder colour
 * instead of sitting on it.
 */

import { describe, expect, it } from "vitest";
import {
  MATERIALS,
  buildMaterialLayerSvg,
  getMaterialRecipe,
  isFrontMaterial,
} from "@/lib/export/materials";
import { createEmptyDocument } from "@/types/document";
import type { MaterialSettings } from "@/types/document";

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

describe("isFrontMaterial", () => {
  it("is true only for a front span on a shape with a front/back split", () => {
    expect(isFrontMaterial("windows", settings({ span: "front" }))).toBe(true);
    expect(isFrontMaterial("macos", settings({ span: "front" }))).toBe(true);
    expect(isFrontMaterial("windows", settings({ span: "full" }))).toBe(false);
    expect(isFrontMaterial("classic", settings({ span: "front" }))).toBe(false);
  });
});
