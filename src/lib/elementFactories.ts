/**
 * Element factories. These centralize the per-type default fields that the
 * legacy app scattered across `addShape`/`addText`/`addImage`/`addIconToCanvas`/
 * `commitDraw` (public/legacy.html L618/624/613/780/999), and guarantee every
 * element is created with the full BaseElement shape (string ID, visible, locked,
 * scaleX/scaleY, name).
 */

import { CDW, CDH } from "@/lib/constants";
import { createId } from "@/lib/id";
import type {
  ColorValue,
} from "@/types/gradient";
import type {
  DrawElement,
  IconElement,
  IconVariant,
  ImageElement,
  LineCap,
  ShapeElement,
  ShapeType,
  TextElement,
} from "@/types/element";

/** Common defaults shared by every element, centered in the content rect. */
function baseFields(width: number, height: number, name: string) {
  return {
    id: createId(),
    x: (CDW - width) / 2,
    y: (CDH - height) / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name,
    scaleX: 1,
    scaleY: 1,
  };
}

export function createShapeElement(
  shapeType: ShapeType = "rect",
  name = "Shape",
): ShapeElement {
  const size = 120;
  return {
    ...baseFields(size, size, name),
    type: "shape",
    shapeType,
    fill: { color: "#8cf0a8", enabled: true },
    stroke: { color: "#000000", enabled: false, width: 3, position: "center" },
    borderRadius: 0,
  };
}

export function createTextElement(name = "Text"): TextElement {
  return {
    ...baseFields(100, 32, name),
    type: "text",
    text: "Text",
    fontFamily: "Space Grotesk",
    fontSize: 18,
    fontWeight: "600",
    fontStyle: "normal",
    color: "#ffffff",
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.3,
    underline: false,
  };
}

/**
 * Create an image element, constraining the source dimensions to 55% of the
 * content rect (matching the legacy `addImage` fit), then centering.
 */
export function createImageElement(
  src: string,
  srcWidth: number,
  srcHeight: number,
  name = "Image",
  logoName?: string,
): ImageElement {
  const mw = CDW * 0.55;
  const mh = CDH * 0.55;
  let w = srcWidth;
  let h = srcHeight;
  if (w > mw) {
    h *= mw / w;
    w = mw;
  }
  if (h > mh) {
    w *= mh / h;
    h = mh;
  }
  return {
    ...baseFields(w, h, name),
    type: "image",
    src,
    ...(logoName != null ? { logoName } : {}),
  };
}

export interface CreateIconInput {
  iconName: string;
  iconVariant: IconVariant;
  iconCacheKey: string;
  color: ColorValue;
  name?: string;
}

export function createIconElement(input: CreateIconInput): IconElement {
  const size = 80;
  const el: IconElement = {
    ...baseFields(size, size, input.name ?? input.iconName),
    type: "icon",
    iconName: input.iconName,
    iconVariant: input.iconVariant,
    iconCacheKey: input.iconCacheKey,
    color: input.color,
  };
  // Legacy icons spawn at a fixed top-left offset rather than centered.
  el.x = 40;
  el.y = 40;
  return el;
}

export interface CreateDrawInput {
  x: number;
  y: number;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  svgPath: string;
  strokeColor: ColorValue;
  strokeSize: number;
  linecap?: LineCap;
  opacity?: number;
  name?: string;
}

export function createDrawElement(input: CreateDrawInput): DrawElement {
  return {
    ...baseFields(input.width, input.height, input.name ?? "Drawing"),
    // Draw elements keep their computed bounding-box origin (not centered).
    x: input.x,
    y: input.y,
    type: "draw",
    opacity: input.opacity ?? 1,
    svgPath: input.svgPath,
    origWidth: input.origWidth,
    origHeight: input.origHeight,
    stroke: {
      color: input.strokeColor,
      size: input.strokeSize,
      linecap: input.linecap ?? "round",
    },
  };
}
