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

/**
 * A surface material on one element. The folder-wide {@link MaterialSettings}
 * is this plus a `span` — which is meaningless per element, since an element
 * has no front/back split. Declared here rather than imported from
 * `types/document` to keep the dependency one-way (document imports element).
 */
export interface ElementMaterial {
  /** `MATERIALS` recipe id, or `"none"`. */
  id: string;
  /** 0-1 strength of the surface shading. */
  intensity: number;
  /** Multiplies the recipe's grain size — larger is coarser. */
  scale: number;
  /** Light/brush azimuth in degrees; only recipes listing `"angle"` use it. */
  angle: number;
}

/** Applied when a material is first chosen; matches the folder-level defaults. */
export const DEFAULT_ELEMENT_MATERIAL: ElementMaterial = {
  id: "none",
  intensity: 0.7,
  scale: 1,
  angle: 90,
};

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
  /**
   * Surface material shading this element's own pixels. Honoured for shape,
   * text and icon (which covers mono logos) — read it through
   * {@link elementMaterial}, never directly, so the unsupported types can't
   * pick one up in one render path and not another.
   */
  material?: ElementMaterial;
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
  /** Inner shadow, cast inside the shape's own outline (independent of dropShadow). */
  innerShadow?: DropShadow;
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
  /** Clip glyphs to the element box. Default (absent/false) lets them overflow. */
  clip?: boolean;
  stroke?: { color: string; width: number; position: StrokePosition };
  shadow?: DropShadow;
  /** Inner shadow, cast inside the glyph outlines (independent of `shadow`). */
  innerShadow?: DropShadow;
}

export interface ImageElement extends BaseElement {
  type: "image";
  /** Data URL or object URL. SVG-as-data-URL is used for color logos. */
  src: string;
  /**
   * Brand key when this image is a placed *color* logo (vs. a user upload).
   * Lets a placed color logo route to the Logos panel and be swapped in place;
   * absent on ordinary images. Mono logos are `icon` elements instead.
   */
  logoName?: string;
  /** Which svgl theme variant a color logo is showing (dark default where one exists). */
  logoVariant?: "light" | "dark";
  blendMode?: BlendMode;
  stroke?: { color: string; enabled: boolean; width: number };
  dropShadow?: DropShadow;
}

export type IconVariant =
  | "regular"
  | "bold"
  | "thin"
  | "light"
  | "fill"
  | "duotone"
  | "logo"
  // A user-added single-body tintable icon (custom asset). Like "logo" it has
  // no style variants, but it is NOT a brand logo — it lives in the icon
  // library and routes to the Icons panel (see isLogoElement).
  | "custom";

export interface IconElement extends BaseElement {
  type: "icon";
  /** Iconify/Phosphor icon name (or brand name for `iconVariant: "logo"`). */
  iconName: string;
  iconVariant: IconVariant;
  /** Key into the runtime icon-body cache. */
  iconCacheKey: string;
  color: ColorValue;
  dropShadow?: DropShadow;
  /** Inner shadow, cast inside the icon's own alpha (independent of dropShadow). */
  innerShadow?: DropShadow;
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

/** Element types that render a material. Images bring their own pixels, and a
 *  draw stroke is a few px at export scale — grain wouldn't survive either. */
export const MATERIAL_ELEMENT_TYPES: ElementType[] = ["shape", "text", "icon"];

/**
 * The material to shade `el` with, or undefined. The single gate every render
 * path asks, so an unsupported type can never be materialed in one path only.
 */
export function elementMaterial(el: FolderElement): ElementMaterial | undefined {
  if (!el.material || el.material.id === "none") return undefined;
  return MATERIAL_ELEMENT_TYPES.includes(el.type) ? el.material : undefined;
}

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

/**
 * A placed brand logo: a mono logo (tintable `icon` with `iconVariant: "logo"`)
 * or a color logo (`image` carrying a `logoName`). Used to route a clicked logo
 * to the Logos panel instead of Icons/Image.
 */
export const isLogoElement = (el: FolderElement): boolean =>
  (el.type === "icon" && el.iconVariant === "logo") ||
  (el.type === "image" && el.logoName != null);

/** The brand key of a logo element (see {@link isLogoElement}), else null. */
export function logoElementName(el: FolderElement): string | null {
  if (el.type === "icon" && el.iconVariant === "logo") return el.iconName;
  if (el.type === "image" && el.logoName != null) return el.logoName;
  return null;
}
