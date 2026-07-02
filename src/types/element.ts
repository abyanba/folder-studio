/**
 * The layer/element model. Every item on the folder icon is a {@link FolderElement},
 * a discriminated union over `type`.
 *
 * Unlike the legacy app — where `visible`/`locked`/`scaleX`/`scaleY` were present on
 * some element types but not others, and IDs were numeric for shapes/text/images but
 * `"el"+n` strings for icons — every element here carries the full {@link BaseElement}
 * shape with string IDs. The element factories in `src/lib/elementFactories.ts`
 * guarantee all fields are populated at creation.
 */

import type { ColorValue } from "./gradient";

export type ElementType = "shape" | "text" | "image" | "icon" | "draw";

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees. */
  rotation: number;
  /** 0..1. */
  opacity: number;
  visible: boolean;
  locked: boolean;
  name: string;
  /** Horizontal flip factor (±1); also used for non-uniform scaling. */
  scaleX: number;
  /** Vertical flip factor (±1). */
  scaleY: number;
}

export type StrokePosition = "center" | "inside" | "outside";
export type LineCap = "round" | "butt" | "square";

export interface DropShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

/** Canvas `globalCompositeOperation` values used by image blend modes. */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export type ShapeType = "rect" | "ellipse" | "triangle" | "star" | "hexagon";

export interface ShapeElement extends BaseElement {
  type: "shape";
  shapeType: ShapeType;
  fill: { color: ColorValue; enabled: boolean };
  stroke: {
    color: string;
    enabled: boolean;
    width: number;
    position: StrokePosition;
  };
  borderRadius: number;
  dropShadow?: DropShadow;
}

export type TextAlign = "left" | "center" | "right";

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  /** CSS font-weight as a string, e.g. `"400"`, `"600"`. */
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: ColorValue;
  align: TextAlign;
  letterSpacing: number;
  lineHeight: number;
  underline: boolean;
  stroke?: { color: string; width: number; position: StrokePosition };
  shadow?: DropShadow;
}

export interface ImageElement extends BaseElement {
  type: "image";
  /** Data URL or object URL. SVG-as-data-URL is used for color logos. */
  src: string;
  blendMode?: BlendMode;
  stroke?: { color: string; enabled: boolean; width: number };
}

export type IconVariant =
  | "regular"
  | "bold"
  | "thin"
  | "light"
  | "fill"
  | "duotone"
  | "logo";

export interface IconElement extends BaseElement {
  type: "icon";
  /** Iconify/Phosphor icon name (or brand name for `iconVariant: "logo"`). */
  iconName: string;
  iconVariant: IconVariant;
  /** Key into the runtime icon-body cache. */
  iconCacheKey: string;
  color: ColorValue;
  dropShadow?: DropShadow;
}

export interface DrawElement extends BaseElement {
  type: "draw";
  /** SVG path `d` string, in the element's local (origWidth × origHeight) space. */
  svgPath: string;
  origWidth: number;
  origHeight: number;
  stroke: { color: ColorValue; size: number; linecap: LineCap };
}

export type FolderElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | IconElement
  | DrawElement;

export const isShape = (el: FolderElement): el is ShapeElement =>
  el.type === "shape";
export const isText = (el: FolderElement): el is TextElement =>
  el.type === "text";
export const isImage = (el: FolderElement): el is ImageElement =>
  el.type === "image";
export const isIcon = (el: FolderElement): el is IconElement =>
  el.type === "icon";
export const isDraw = (el: FolderElement): el is DrawElement =>
  el.type === "draw";
