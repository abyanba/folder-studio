// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildDrawSvg, buildIconSvg, buildImageStrokeSvg, buildShapeSvg } from "@/lib/export/elementSvg";
import type { IconBody } from "@/lib/export/elementSvg";
import {
  createDrawElement,
  createIconElement,
  createImageElement,
  createShapeElement,
} from "@/lib/elementFactories";
import type { Gradient } from "@/types/gradient";

const gradient: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
  ],
};

describe("buildShapeSvg", () => {
  // The reference case, in element pixels: a 5x5 square with a 2-wide stroke.
  // The path always sits ON the element box, so the fill core stays 5x5 for
  // outside, and the box only grows by what the stroke adds beyond it.
  const square = (position: "outside" | "center" | "inside") => {
    const el = createShapeElement("rect");
    el.borderRadius = 0;
    // viewBox is 100 wide and the element is 5px, so width 40 == 2 element px.
    el.stroke = { color: "#000000", enabled: true, width: 40, position };
    return el;
  };

  it("grows the box by the full width for an outside stroke (5x5 -> 9x9)", () => {
    const svg = buildShapeSvg(square("outside"), 5, 5);
    // Overflow 40 units == 2px on each side ⇒ 5 + 2 + 2 = 9.
    expect(svg).toContain('width="9" height="9"');
    expect(svg).toContain('viewBox="-40 -40 180 180"');
    // Band is double width, masked to the outside half ⇒ 2px of visible stroke.
    expect(svg).toContain('stroke-width="80"');
    expect(svg).toContain("mask=");
    // Geometry stays on the box: the white core is untouched at 5x5.
    expect(svg).toContain('x="0" y="0" width="100" height="100"');
  });

  it("grows the box by half the width for a center stroke (5x5 -> 7x7)", () => {
    const svg = buildShapeSvg(square("center"), 5, 5);
    // Overflow 20 units == 1px on each side ⇒ 5 + 1 + 1 = 7.
    expect(svg).toContain('width="7" height="7"');
    expect(svg).toContain('viewBox="-20 -20 140 140"');
    expect(svg).toContain('stroke-width="40"'); // straddles: 1px in, 1px out
    expect(svg).not.toContain("mask=");
    expect(svg).not.toContain("clip-path=");
  });

  it("leaves the box unchanged for an inside stroke (5x5 stays 5x5)", () => {
    const svg = buildShapeSvg(square("inside"), 5, 5);
    expect(svg).toContain('width="5" height="5"');
    expect(svg).toContain('viewBox="0 0 100 100"');
    // Double width clipped to the shape ⇒ 2px eaten off the core, none outside.
    expect(svg).toContain('stroke-width="80"');
    expect(svg).toContain("clip-path=");
  });

  it("paints fill and stroke as separate elements, not via paint-order", () => {
    const el = createShapeElement("rect");
    el.borderRadius = 12;
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "center" };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain('rx="12"');
    expect(svg).not.toContain("paint-order");
    // An unfilled shape must still show a correctly-sized outside stroke, which
    // the old fill-covers-the-inner-half trick could not do.
    el.fill.enabled = false;
    el.stroke.position = "outside";
    const unfilled = buildShapeSvg(el, 100, 100);
    expect(unfilled).toContain("mask=");
    expect(unfilled).not.toContain('fill="none" stroke="none"');
  });

  it("paints no fill when fill is disabled", () => {
    const el = createShapeElement("rect");
    el.fill = { color: "#8cf0a8", enabled: false };
    // Nothing to paint at all with no stroke either — the old builder emitted a
    // `fill="none"` no-op element here, which rendered identically.
    expect(buildShapeSvg(el, 100, 100)).not.toContain("#8cf0a8");

    // With a stroke it is stroke-only: the fill element is still absent.
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "inside" };
    const stroked = buildShapeSvg(el, 100, 100);
    expect(stroked).toContain('stroke="#000000"');
    expect(stroked).not.toContain("#8cf0a8");
  });

  it("emits a gradient <defs> and url(#gfx...) for a gradient fill", () => {
    const el = createShapeElement("rect");
    el.fill = { color: gradient, enabled: true };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain(`id="gfx${el.id}"`);
    expect(svg).toContain(`url(#gfx${el.id})`);
    expect(svg).toContain("<linearGradient");
  });

  it("clips inside strokes to the shape's own outline (not just viewBox edges)", () => {
    // Rects touch all four viewBox edges, so viewBox clipping alone would mask
    // an inside stroke; ellipses only touch at 4 tangent points, so the old
    // implementation left a visible bleed around the rest of the circumference.
    const el = createShapeElement("ellipse");
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "inside" };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain("<clipPath");
    expect(svg).toMatch(/clip-path="url\(#gsclip/);
  });

  it("renders the right primitive per shapeType", () => {
    expect(buildShapeSvg(createShapeElement("ellipse"), 100, 100)).toContain("<ellipse");
    expect(buildShapeSvg(createShapeElement("triangle"), 100, 100)).toContain("<polygon");
    // star has 10 points, hexagon 6
    const star = buildShapeSvg(createShapeElement("star"), 100, 100);
    expect(star.match(/,/g)?.length).toBe(10);
    const hex = buildShapeSvg(createShapeElement("hexagon"), 100, 100);
    expect(hex.match(/,/g)?.length).toBe(6);
  });

  it("emits an inner-shadow filter scaled into the 100×100 viewBox", () => {
    const el = createShapeElement("rect");
    el.innerShadow = { x: 2, y: 4, blur: 5, color: "#123456", opacity: 0.4 };
    // Element is 50×100 → px→viewBox scale is 2 in x, 1 in y.
    const svg = buildShapeSvg(el, 50, 100);
    expect(svg).toContain(`<filter id="sis${el.id}"`);
    expect(svg).toContain(`filter="url(#sis${el.id})"`);
    expect(svg).toContain('dx="4"'); // 2 * (100/50)
    expect(svg).toContain('dy="4"'); // 4 * (100/100)
    expect(svg).toContain('stdDeviation="10 5"'); // blur * (sx, sy)
    expect(svg).toContain('flood-color="#123456"');
    expect(svg).toContain('flood-opacity="0.4"');
  });

  it("omits the inner-shadow filter when unset", () => {
    const svg = buildShapeSvg(createShapeElement("rect"), 100, 100);
    expect(svg).not.toContain("<filter");
  });
});

const iconEl = (color: Gradient | string) =>
  createIconElement({
    iconName: "star",
    iconVariant: "regular",
    iconCacheKey: "ph:star:regular",
    color,
  });

describe("buildIconSvg", () => {
  const fillBody: IconBody = { body: '<path fill="currentColor" d="M0 0h1v1h-1z"/>', width: 256, height: 256 };
  const strokeBody: IconBody = {
    body: '<path stroke="currentColor" fill="none" d="M0 0h1"/>',
    width: 24,
    height: 24,
  };

  it("replaces currentColor with a solid hex", () => {
    const svg = buildIconSvg(iconEl("#ff8800"), fillBody, 80, 80);
    expect(svg).toContain('fill="#ff8800"');
    expect(svg).not.toContain("currentColor");
    expect(svg).toContain('viewBox="0 0 256 256"');
  });

  it("swaps fill=currentColor for a gradient url and adds defs", () => {
    const el = iconEl(gradient);
    const svg = buildIconSvg(el, fillBody, 80, 80);
    expect(svg).toContain(`url(#giexp${el.id})`);
    expect(svg).toContain("<defs>");
    expect(svg).not.toContain('fill="currentColor"');
  });

  it("swaps stroke=currentColor for a gradient url on stroke-based icons", () => {
    const el = iconEl(gradient);
    const svg = buildIconSvg(el, strokeBody, 80, 80);
    expect(svg).toContain(`stroke="url(#giexp${el.id})"`);
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it("wraps the body in an inner-shadow filter scaled into the icon viewBox", () => {
    const el = iconEl("#000000");
    el.innerShadow = { x: 0, y: 2, blur: 3, color: "#000000", opacity: 0.5 };
    // 256 viewBox, 128px element → scale 2 in both axes.
    const svg = buildIconSvg(el, fillBody, 128, 128);
    expect(svg).toContain(`<filter id="iis${el.id}"`);
    expect(svg).toContain(`<g filter="url(#iis${el.id})">`);
    expect(svg).toContain('dy="4"'); // 2 * (256/128)
    expect(svg).toContain('stdDeviation="6 6"'); // 3 * 2
    expect(svg).toContain("<feComponentTransfer");
  });
});

const drawEl = (color: Gradient | string) =>
  createDrawElement({
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    origWidth: 100,
    origHeight: 40,
    svgPath: "M0 0 L100 40",
    strokeColor: color,
    strokeSize: 5,
    linecap: "round",
  });

describe("buildDrawSvg", () => {
  it("renders a solid stroked path with the local viewBox", () => {
    const svg = buildDrawSvg(drawEl("#00ff00"), 100, 40);
    expect(svg).toContain('stroke="#00ff00"');
    expect(svg).toContain('stroke-width="5"');
    expect(svg).toContain('viewBox="0 0 100 40"');
    expect(svg).toContain('d="M0 0 L100 40"');
  });

  it("uses a userSpace gradient def for a gradient stroke", () => {
    const el = drawEl(gradient);
    const svg = buildDrawSvg(el, 100, 40);
    expect(svg).toContain(`id="gdx${el.id}"`);
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(svg).toContain(`stroke="url(#gdx${el.id})"`);
  });
});

describe("buildImageStrokeSvg", () => {
  it("outlines the logo's own alpha via feMorphology, not the box", () => {
    const el = createImageElement("data:image/svg+xml,%3Csvg%3E%3C/svg%3E", 100, 80, "Logo", "acme");
    el.width = 100;
    el.height = 80;
    el.stroke = { color: "#ff0000", enabled: true, width: 3 };
    const svg = buildImageStrokeSvg(el, 100, 80);
    // Dilate the source ALPHA (the silhouette), not a rect around the box.
    expect(svg).toContain('<feMorphology in="SourceAlpha" operator="dilate" radius="3"');
    expect(svg).toContain('flood-color="#ff0000"');
    // The logo is embedded and letterboxed like object-fit: contain.
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain(`href="${el.src}"`);
    expect(svg).toContain('viewBox="0 0 100 80"');
  });
});
