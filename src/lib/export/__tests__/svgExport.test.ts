// @vitest-environment node
/**
 * True vector SVG composition (EXP-14). Verifies the root frame, that each
 * element type reuses its shared builder wrapped in a centered transform, that
 * text becomes real <text>, unloaded icons and patterns are surfaced as skipped,
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

  it("full image fill embeds the image plus the shading overlay", () => {
    const doc = createEmptyDocument();
    doc.folderFillMode = "image";
    doc.folderBgImage = "data:image/png;base64,x";
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain("<image");
    expect(svg).toContain("url(#wvm)"); // full-mode dark-back mask
    expect(svg).not.toContain("wfrontimg");
  });

  it("front-only image fill clips the image to the front and paints an adaptive back", () => {
    const doc = createEmptyDocument();
    doc.folderFillMode = "image";
    doc.folderBgImage = "data:image/png;base64,x";
    doc.folderBgImageColor = "#0098a5";
    doc.windowsImageMode = "front";
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain('mask="url(#wfrontimg)"'); // image clipped to front
    expect(svg).toContain("url(#wbg)"); // adaptive back gradient
    expect(svg).toContain("url(#wsh)"); // shine
    expect(svg).not.toContain("url(#wvm)"); // not the full-mode overlay
  });

  it("draws the contents paper on top of an image fill (image never affects it)", () => {
    const base = createEmptyDocument();
    base.folderFillMode = "image";
    base.folderBgImage = "data:image/png;base64,x";
    base.folderState = "contents";

    // Full mode: paper layer present and it is the LAST thing drawn (top-most).
    const full = buildExportSvg(base, 256, noIcon).svg;
    expect(full).toContain('mask="url(#wpm)"');
    expect(full.indexOf("wpm")).toBeGreaterThan(full.indexOf("<image"));

    // Front mode: paper still on top, after the front-masked image.
    const front = buildExportSvg({ ...base, windowsImageMode: "front" }, 256, noIcon).svg;
    expect(front).toContain('mask="url(#wpm)"');
    expect(front.indexOf("wpm")).toBeGreaterThan(front.indexOf("wfrontimg"));

    // Empty state → no paper layer.
    expect(buildExportSvg({ ...base, folderState: "empty" }, 256, noIcon).svg).not.toContain("wpm");
  });

  it("adds the color tint over the image in both span modes when the overlay is on", () => {
    const base = createEmptyDocument();
    base.folderFillMode = "image";
    base.folderBgImage = "data:image/png;base64,x";
    base.folderBgOverlayColor = "#ff00aa";
    base.folderBgOverlayOpacity = 0.5;

    const full = buildExportSvg(base, 256, noIcon).svg;
    expect(full).toContain('fill="#ff00aa"');
    expect(full).toContain('mask="url(#ovm)"');

    const front = buildExportSvg(
      { ...base, folderBgImageColor: "#0098a5", windowsImageMode: "front" },
      256,
      noIcon,
    ).svg;
    expect(front).toContain('fill="#ff00aa"');
    // Tint sits between the front-masked image and the shine.
    expect(front.indexOf("#ff00aa")).toBeGreaterThan(front.indexOf("wfrontimg"));

    // Off by default → no tint rect.
    expect(buildExportSvg(base, 256, noIcon).svg.includes("ovm")).toBe(true);
    const offDoc = { ...base, folderBgOverlayOpacity: 0 };
    expect(buildExportSvg(offDoc, 256, noIcon).svg.includes("ovm")).toBe(false);
  });

  it("wraps a shape in a centered transform reusing its builder", () => {
    const doc = createEmptyDocument();
    doc.elements = [createShapeElement("star", "Star")];
    const { svg, skipped } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain("<g transform=");
    expect(svg).toContain("<polygon"); // buildShapeSvg output for a star
    expect(skipped).toEqual([]);
  });

  it("inflates a shape's placement by the reach of an outside stroke", () => {
    const doc = createEmptyDocument();
    const el = createShapeElement("rect", "Box");
    el.width = 100;
    el.height = 100;
    el.stroke = { color: "#000000", enabled: true, width: 20, position: "outside" };
    doc.elements = [el];
    const { svg } = buildExportSvg(doc, 256, noIcon);
    // Stroke reaches 20/100 of the box (20px) past each edge, so the nested svg
    // is 140 wide and starts 20px above/left of the box — keeping it centred on
    // the element. Without the inflation the extra ring would be cropped, and
    // the raster export (which drawImages the same inflated box) would diverge.
    expect(svg).toContain('width="140" height="140"');
    expect(svg).toContain("translate(-70 -70)");
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

  it("lets text overflow its box by default, and clips it when `clip` is on", () => {
    const doc = createEmptyDocument();
    const t = createTextElement("T");
    doc.elements = [t];
    expect(buildExportSvg(doc, 256, noIcon).svg).not.toContain(`clip-path="url(#tc${t.id})"`);

    t.clip = true;
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain(`<clipPath id="tc${t.id}">`);
    expect(svg).toContain(`clip-path="url(#tc${t.id})"`);
    // Box-centered, matching the wrap group's local space.
    expect(svg).toContain(
      `<rect x="${-t.width / 2}" y="${-t.height / 2}" width="${t.width}" height="${t.height}"/>`,
    );
  });

  it("emits a folder mask when clip-to-folder is on", () => {
    const doc = createEmptyDocument();
    doc.clipToFolder = true;
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain('<mask id="folderclip">');
    expect(svg).toContain('mask="url(#folderclip)"');
  });

  it("stretches the clip mask to the frame so it matches the enlarged base shape", () => {
    const doc = createEmptyDocument();
    doc.clipToFolder = true;
    const { svg } = buildExportSvg(doc, 256, noIcon);
    // The mask's silhouette svg must be forced to 380 like the base shape, or it
    // renders at its intrinsic 256 and clips the folder to the top-left corner.
    const mask = svg.slice(svg.indexOf('<mask id="folderclip">'));
    expect(mask).toMatch(/<mask id="folderclip">.*<svg width="380" height="380" preserveAspectRatio="none"/);
  });

  it("preserves the background image aspect ratio (matches the editor, no square stretch)", () => {
    const doc = createEmptyDocument();
    doc.folderFillMode = "image";
    doc.folderBgImage = "data:image/png;base64,x";
    // 16:9 landscape at zoom 1: width fills the 380 frame, height follows ratio.
    const { svg } = buildExportSvg(doc, 256, { ...noIcon, bgImageSize: { w: 1600, h: 900 } });
    expect(svg).toContain('width="380" height="213.75"');
  });

  it("treats the background image as square when no size is supplied", () => {
    const doc = createEmptyDocument();
    doc.folderFillMode = "image";
    doc.folderBgImage = "data:image/png;base64,x";
    const { svg } = buildExportSvg(doc, 256, noIcon);
    expect(svg).toContain('width="380" height="380" href=');
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
