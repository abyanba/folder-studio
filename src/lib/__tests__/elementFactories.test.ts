// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { __resetIdCounterForTests } from "@/lib/id";
import { CDH, CDW } from "@/lib/constants";
import {
  createDrawElement,
  createIconElement,
  createImageElement,
  createShapeElement,
  createTextElement,
} from "@/lib/elementFactories";
import type { BaseElement, FolderElement } from "@/types/element";

const BASE_KEYS: (keyof BaseElement)[] = [
  "id",
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "opacity",
  "visible",
  "locked",
  "name",
  "scaleX",
  "scaleY",
];

function expectFullBase(el: FolderElement) {
  for (const key of BASE_KEYS) {
    expect(el[key], `missing base field: ${key}`).not.toBeUndefined();
  }
  expect(typeof el.id).toBe("string");
  expect(el.visible).toBe(true);
  expect(el.locked).toBe(false);
  expect(el.scaleX).toBe(1);
  expect(el.scaleY).toBe(1);
}

describe("element factories", () => {
  beforeEach(() => __resetIdCounterForTests());

  it("every factory yields a fully-populated BaseElement", () => {
    expectFullBase(createShapeElement());
    expectFullBase(createTextElement());
    expectFullBase(createImageElement("data:x", 10, 10));
    expectFullBase(
      createIconElement({
        iconName: "star",
        iconVariant: "regular",
        iconCacheKey: "star",
        color: "#fff",
      }),
    );
    expectFullBase(
      createDrawElement({
        x: 1,
        y: 2,
        width: 10,
        height: 10,
        origWidth: 10,
        origHeight: 10,
        svgPath: "M 0 0 L 1 1",
        strokeColor: "#fff",
        strokeSize: 8,
      }),
    );
  });

  it("assigns unique string ids across calls", () => {
    const a = createShapeElement();
    const b = createShapeElement();
    expect(a.id).not.toBe(b.id);
  });

  it("centers shapes in the content rect", () => {
    const s = createShapeElement("rect");
    expect(s.x).toBe((CDW - s.width) / 2);
    expect(s.y).toBe((CDH - s.height) / 2);
    expect(s.shapeType).toBe("rect");
  });

  it("constrains oversized images to 55% of the content rect", () => {
    const img = createImageElement("data:x", 1000, 1000);
    expect(img.width).toBeLessThanOrEqual(CDW * 0.55 + 0.001);
    expect(img.height).toBeLessThanOrEqual(CDH * 0.55 + 0.001);
  });

  it("spawns icons at the fixed top-left offset", () => {
    const icon = createIconElement({
      iconName: "star",
      iconVariant: "regular",
      iconCacheKey: "star",
      color: "#fff",
    });
    expect(icon.x).toBe(40);
    expect(icon.y).toBe(40);
  });

  it("preserves draw element geometry and stroke", () => {
    const d = createDrawElement({
      x: 5,
      y: 6,
      width: 30,
      height: 40,
      origWidth: 30,
      origHeight: 40,
      svgPath: "M 0 0 L 1 1",
      strokeColor: "#abc",
      strokeSize: 12,
      linecap: "round",
    });
    expect(d).toMatchObject({
      x: 5,
      y: 6,
      width: 30,
      height: 40,
      svgPath: "M 0 0 L 1 1",
      stroke: { color: "#abc", size: 12, linecap: "round" },
    });
  });
});
