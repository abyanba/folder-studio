/**
 * True vector SVG export (EXP-14). Composes the *same* SVG-string builders the
 * editor and canvas use into one root `<svg>` — base shape, elements, clip mask
 * — instead of embedding a rasterized PNG. Text becomes real `<text>` (vector,
 * selectable) laid out with the shared {@link computeTextLayout} math.
 *
 * Pure and jsdom-testable: icon bodies and any `@font-face` CSS are injected via
 * `deps`, so no canvas/network here. The browser wiring (measuring text for
 * wrap, inlining fonts) lives in `exporters.ts` / `svgFonts.ts`.
 *
 * Known gaps vs the raster export, surfaced in `skipped`: the texture layer
 * (its source-atop-over-painted-pixels compositing has no clean SVG form) and
 * auto-trim (the SVG keeps the full workspace frame — vector output is
 * resolution-independent, so tight cropping matters less).
 */

import { CDX, CDY, FH, FW } from "@/lib/constants";
import { isGradient } from "@/types/gradient";
import type { FolderDocument } from "@/types/document";
import type { DropShadow, FolderElement, TextElement } from "@/types/element";
import { buildBaseShapeOverlaySvg, buildBaseShapeSvg, getBaseShapeMask } from "./baseShapes";
import { buildDrawSvg, buildIconSvg, buildShapeSvg } from "./elementSvg";
import type { IconBody } from "./elementSvg";
import { gradientElement } from "./gradientSvg";
import { computeTextLayout, lineY } from "./textLayout";
import type { MeasureText } from "./textLayout";

export interface SvgExportDeps {
  getIconBody: (name: string, variant: string) => IconBody | null;
  /** Optional text-measurer for word-wrap parity with the raster export. */
  measure?: (el: TextElement) => MeasureText;
  /** Optional `@font-face` CSS (data-URL fonts) to embed for a self-contained file. */
  fontFaceCss?: string;
}

export interface SvgExportResult {
  svg: string;
  skipped: string[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function elementLabel(el: FolderElement): string {
  return el.name?.trim() || el.id;
}

const num = (n: number): string => (Number.isFinite(n) ? +n.toFixed(3) : 0).toString();

/**
 * The centered transform wrapper mirroring the editor's `rotate() scale()` box,
 * with its origin at the element's center. Content drawn in center-relative
 * coords (text, image) passes through as-is; builder SVGs, which draw from a
 * (0,0) top-left, are shifted with {@link topLeft}.
 */
function wrap(el: FolderElement, ew: number, eh: number, inner: string, extra = ""): string {
  const cx = CDX + el.x + ew / 2;
  const cy = CDY + el.y + eh / 2;
  const t = `translate(${num(cx)} ${num(cy)}) rotate(${num(el.rotation)}) scale(${num(el.scaleX ?? 1)} ${num(el.scaleY ?? 1)})`;
  const op = el.opacity != null && el.opacity !== 1 ? ` opacity="${num(el.opacity)}"` : "";
  return `<g transform="${t}"${op}${extra}>${inner}</g>`;
}

/** Shift a top-left-origin builder SVG so it centers within the transform box. */
function topLeft(inner: string, ew: number, eh: number): string {
  return `<g transform="translate(${num(-ew / 2)} ${num(-eh / 2)})">${inner}</g>`;
}

/** Force a base-shape SVG (256 viewBox, sometimes a fixed 256 size) to fill the workspace. */
function fillBase(svg: string): string {
  return svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg width="${FW}" height="${FH}" preserveAspectRatio="none"`);
}

/** A drop-shadow `<filter>` def + the attribute to reference it, or empty strings. */
function dropShadow(el: FolderElement): { def: string; ref: string } {
  const ds = (el as { dropShadow?: DropShadow }).dropShadow;
  if (!ds || (el.type !== "icon" && el.type !== "shape" && el.type !== "image")) {
    return { def: "", ref: "" };
  }
  const id = `ds${el.id}`;
  const def = `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${num(ds.x)}" dy="${num(ds.y)}" stdDeviation="${num(ds.blur / 2)}" flood-color="${ds.color}" flood-opacity="${num(ds.opacity ?? 1)}"/></filter>`;
  return { def, ref: ` filter="url(#${id})"` };
}

/** One text element as vector `<text>` with the shared multi-line layout. */
function textMarkup(el: TextElement, defs: string[], measure?: MeasureText): string {
  const ew = el.width;
  const eh = el.height;
  const fontSizePx = el.fontSize;
  const layout = computeTextLayout(
    el.text,
    fontSizePx,
    el.lineHeight,
    el.align,
    ew,
    measure,
    measure ? el.letterSpacing || 0 : 0,
  );
  const anchor = el.align === "left" ? "start" : el.align === "right" ? "end" : "middle";

  let fill: string;
  if (isGradient(el.color)) {
    const id = `tg${el.id}`;
    defs.push(gradientElement(id, el.color));
    fill = `url(#${id})`;
  } else {
    fill = el.color;
  }

  const strokeAttrs =
    el.stroke && el.stroke.width > 0
      ? ` stroke="${el.stroke.color}" stroke-width="${num(el.stroke.width * (el.stroke.position === "center" ? 1 : 2))}" paint-order="${el.stroke.position === "inside" ? "fill" : "stroke"}"`
      : "";
  const shadow = el.shadow
    ? ((): string => {
        const id = `tsh${el.id}`;
        defs.push(
          `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${num(el.shadow.x)}" dy="${num(el.shadow.y)}" stdDeviation="${num(el.shadow.blur / 2)}" flood-color="${el.shadow.color}" flood-opacity="${num(el.shadow.opacity ?? 1)}"/></filter>`,
        );
        return ` filter="url(#${id})"`;
      })()
    : "";

  const tspans = layout.lines
    .map(
      (line, i) =>
        `<tspan x="${num(layout.tx)}" y="${num(lineY(layout, i))}">${escapeXml(line) || " "}</tspan>`,
    )
    .join("");

  const styleAttrs =
    `font-family="${escapeXml(el.fontFamily)}" font-size="${num(fontSizePx)}" font-weight="${el.fontWeight}"` +
    ` font-style="${el.fontStyle}" letter-spacing="${num(el.letterSpacing || 0)}"` +
    (el.underline ? ` text-decoration="underline"` : "");

  const inner = `<text text-anchor="${anchor}" dominant-baseline="central" fill="${fill}"${strokeAttrs}${shadow} ${styleAttrs}>${tspans}</text>`;
  // A clip keeps overflow hidden like the editor's box (EXP-04).
  const clipId = `tc${el.id}`;
  defs.push(
    `<clipPath id="${clipId}"><rect x="${num(-ew / 2)}" y="${num(-eh / 2)}" width="${num(ew)}" height="${num(eh)}"/></clipPath>`,
  );
  return wrap(el, ew, eh, `<g clip-path="url(#${clipId})">${inner}</g>`);
}

/** One element as SVG markup, or null when its icon body isn't loaded (skipped). */
function elementMarkup(
  el: FolderElement,
  deps: SvgExportDeps,
  defs: string[],
): string | null {
  const ew = el.width;
  const eh = el.height;

  if (el.type === "text") return textMarkup(el, defs, deps.measure?.(el));

  const ds = dropShadow(el);
  if (ds.def) defs.push(ds.def);

  if (el.type === "icon") {
    const body = deps.getIconBody(el.iconName, el.iconVariant || "regular");
    if (!body) return null;
    return wrap(el, ew, eh, topLeft(buildIconSvg(el, body, ew, eh), ew, eh), ds.ref);
  }
  if (el.type === "shape") return wrap(el, ew, eh, topLeft(buildShapeSvg(el, ew, eh), ew, eh), ds.ref);
  if (el.type === "draw") return wrap(el, ew, eh, topLeft(buildDrawSvg(el, ew, eh), ew, eh), ds.ref);
  // image
  const blend =
    el.blendMode && el.blendMode !== "normal" ? ` style="mix-blend-mode:${el.blendMode}"` : "";
  const strokeRect =
    el.stroke?.enabled && (el.stroke.width || 0) > 0
      ? `<rect x="${num(-ew / 2)}" y="${num(-eh / 2)}" width="${num(ew)}" height="${num(eh)}" fill="none" stroke="${el.stroke.color}" stroke-width="${num(el.stroke.width)}"/>`
      : "";
  const img = `<image x="${num(-ew / 2)}" y="${num(-eh / 2)}" width="${num(ew)}" height="${num(eh)}" href="${escapeXml(el.src)}" preserveAspectRatio="xMidYMid meet"${blend}/>`;
  return wrap(el, ew, eh, img + strokeRect, ds.ref);
}

/** Base folder markup: cropped background image, or the colored base shape. */
function baseMarkup(doc: FolderDocument): string {
  const op = doc.folderOpacity != null && doc.folderOpacity !== 1 ? ` opacity="${num(doc.folderOpacity)}"` : "";
  if (doc.folderFillMode === "image" && doc.folderBgImage) {
    const zm = doc.folderBgZoom || 1;
    const bpx = (doc.folderBgX ?? 50) / 100;
    const bpy = (doc.folderBgY ?? 50) / 100;
    const dw = FW * zm;
    const dh = FH * zm;
    const dx = -(dw - FW) * bpx;
    const dy = -(dh - FH) * bpy;
    const img = `<image x="${num(dx)}" y="${num(dy)}" width="${num(dw)}" height="${num(dh)}" href="${escapeXml(doc.folderBgImage)}" preserveAspectRatio="none"/>`;
    // Folder-structure shading over the image (same builder as the editor).
    const overlay = buildBaseShapeOverlaySvg(doc.baseShape);
    return `<g${op}>${img}${overlay ? fillBase(overlay) : ""}</g>`;
  }
  return `<g${op}>${fillBase(buildBaseShapeSvg(doc))}</g>`;
}

/**
 * Compose the whole design as one vector SVG at `size`×`size` (viewBox stays the
 * workspace, so the file is resolution-independent). Returns the markup plus the
 * labels of any layers that couldn't be included (unloaded icons, texture).
 */
export function buildExportSvg(
  doc: FolderDocument,
  size: number,
  deps: SvgExportDeps,
): SvgExportResult {
  const skipped: string[] = [];
  const defs: string[] = [];
  const body: string[] = [baseMarkup(doc)];

  const emit = (el: FolderElement): void => {
    if (el.visible === false) return;
    const markup = elementMarkup(el, deps, defs);
    if (markup) body.push(markup);
    else skipped.push(elementLabel(el));
  };

  const tz = Math.min(doc.textureLayerZ, doc.elements.length);
  for (let i = 0; i < tz; i++) emit(doc.elements[i]);
  if (doc.texture && doc.texture.id !== "none") {
    skipped.push("Texture (raster export only)");
  }
  for (let i = tz; i < doc.elements.length; i++) emit(doc.elements[i]);

  let content = body.join("");
  if (doc.clipToFolder) {
    const mask = getBaseShapeMask(doc.baseShape);
    if (mask) {
      defs.push(
        `<mask id="folderclip"><svg x="0" y="0" width="${FW}" height="${FH}">${mask}</svg></mask>`,
      );
      content = `<g mask="url(#folderclip)">${content}</g>`;
    }
  }

  const style = deps.fontFaceCss ? `<style>${deps.fontFaceCss}</style>` : "";
  const defsBlock = style || defs.length ? `<defs>${style}${defs.join("")}</defs>` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
    ` width="${size}" height="${size}" viewBox="0 0 ${FW} ${FH}">${defsBlock}${content}</svg>`;
  return { svg, skipped };
}
