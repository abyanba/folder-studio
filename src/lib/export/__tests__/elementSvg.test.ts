// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildDrawSvg, buildIconSvg, buildShapeSvg } from "@/lib/export/elementSvg";
import type { IconBody } from "@/lib/export/elementSvg";
import {
  createDrawElement,
  createIconElement,
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
  it("renders a rounded rect with center stroke and no paint-order", () => {
    const el = createShapeElement("rect");
    el.borderRadius = 12;
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "center" };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain("<rect");
    expect(svg).toContain('rx="12"');
    expect(svg).toContain('stroke-width="4"'); // center → sw as-is
    expect(svg).not.toContain("paint-order");
    expect(svg).toContain('x="0"');
  });

  it("doubles stroke width and orders fill-under-stroke for inside strokes", () => {
    const el = createShapeElement("rect");
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "inside" };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain('stroke-width="8"');
    expect(svg).toContain('paint-order="fill stroke"');
  });

  it("insets the rect and orders stroke-under-fill for outside strokes", () => {
    const el = createShapeElement("rect");
    el.stroke = { color: "#000000", enabled: true, width: 4, position: "outside" };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain('paint-order="stroke fill"');
    expect(svg).toContain('x="4"'); // off = sw
    expect(svg).toContain('width="92"'); // 100 - 2*off
  });

  it("uses fill=none when fill is disabled", () => {
    const el = createShapeElement("rect");
    el.fill = { color: "#8cf0a8", enabled: false };
    expect(buildShapeSvg(el, 100, 100)).toContain('fill="none"');
  });

  it("emits a gradient <defs> and url(#gfx...) for a gradient fill", () => {
    const el = createShapeElement("rect");
    el.fill = { color: gradient, enabled: true };
    const svg = buildShapeSvg(el, 100, 100);
    expect(svg).toContain(`id="gfx${el.id}"`);
    expect(svg).toContain(`url(#gfx${el.id})`);
    expect(svg).toContain("<linearGradient");
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
