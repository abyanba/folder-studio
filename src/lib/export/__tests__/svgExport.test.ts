// @vitest-environment node
/**
 * True vector SVG composition (EXP-14). Verifies the root frame, that each
 * element type reuses its shared builder wrapped in a centered transform, that
 * text becomes real <text>, unloaded icons and textures are surfaced as skipped,
 * and clip-to-folder emits a mask. Font inlining is browser-only (svgFonts).
 */

import { describe, expect, it } from "vitest";
import { buildExportSvg } from "@/lib/export/svgExport";
import type { SvgExportDeps } from "@/lib/export/svgExport";
import {
  createIconElement,
  createShapeElement,
  createTextElement,
} from "@/lib/elementFactories";
import { createEmptyDocument } from "@/types/document";

const iconBody = { body: '<path fill="currentColor" d="M0 0h10v10H0z"/>', width: 256, height: 256 };
const withIcon: SvgExportDeps = { getIconBody: () => iconBody };
const noIcon: SvgExportDeps = { getIconBody: () => null };

describe("buildExportSvg", () => {
  it("frames the root at the workspace viewBox and requested pixel size", () => {
    const { svg } = buildExportSvg(createEmptyDocument(), 512, noIcon);
    expect(svg).toContain('viewBox="0 0 380 380"');
    expect(svg).toContain('width="512" height="512"');
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("includes the colored base shape stretched to fill the frame", () => {
    const { svg } = buildExportSvg(createEmptyDocument(), 256, noIcon);
    // Base is a real vector <svg> forced to the workspace size, not a raster <image>.
    expect(svg).toMatch(/<svg width="380" height="380" preserveAspectRatio="none"/);
    expect(svg).not.toContain("<image");
  });

  it("wraps a shape in a centered transform reusing its builder", () => {
    const doc = createEmptyDocument();
    doc.elements = [createShapeElement("star", "Star")];
    const { svg, skipped } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain("<g transform=");
    expect(svg).toContain("<polygon"); // buildShapeSvg output for a star
    expect(skipped).toEqual([]);
  });

  it("renders an icon when its body is loaded, and skips it otherwise", () => {
    const doc = createEmptyDocument();
    doc.elements = [
      createIconElement({ iconName: "house", iconVariant: "regular", iconCacheKey: "house", color: "#fff", name: "House" }),
    ];
    expect(buildExportSvg(doc, 256, withIcon).skipped).toEqual([]);
    expect(buildExportSvg(doc, 256, withIcon).svg).toContain("<path");

    const skipped = buildExportSvg(doc, 256, noIcon).skipped;
    expect(skipped).toEqual(["House"]);
  });

  it("renders text as vector <text> with per-line tspans and alignment", () => {
    const doc = createEmptyDocument();
    const t = createTextElement("T");
    t.text = "hello\nworld";
    t.align = "center";
    doc.elements = [t];
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain("<text");
    expect(svg).toContain('text-anchor="middle"');
    expect((svg.match(/<tspan/g) ?? []).length).toBe(2);
    expect(svg).toContain("hello");
    expect(svg).toContain("world");
  });

  it("escapes XML-special characters in text", () => {
    const doc = createEmptyDocument();
    const t = createTextElement("T");
    t.text = "a & b < c";
    doc.elements = [t];
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain("a &amp; b &lt; c");
  });

  it("emits a folder mask when clip-to-folder is on", () => {
    const doc = createEmptyDocument();
    doc.clipToFolder = true;
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain('<mask id="folderclip">');
    expect(svg).toContain('mask="url(#folderclip)"');
  });

  it("surfaces the texture layer as a skipped label", () => {
    const doc = createEmptyDocument();
    doc.texture = { ...doc.texture, id: "dots" };
    const { skipped } = buildExportSvg(doc, 256, noIcon);
    expect(skipped).toContain("Texture (raster export only)");
  });

  it("omits hidden elements", () => {
    const doc = createEmptyDocument();
    const s = createShapeElement("rect", "R");
    s.visible = false;
    doc.elements = [s];
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).not.toContain("<rect");
  });
});
