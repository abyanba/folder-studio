/**
 * Per-element SVG string builders (icon, shape, freehand draw). These are
 * rasterized by the canvas orchestrator via `new Image()`. Text has no SVG form
 * (drawn directly on the canvas), so it lives in the orchestrator + textLayout.
 *
 * Ported from public/legacy.html L929 (icon), L932 (shape), L931 (draw).
 */

import { isGradient } from "@/types/gradient";
import type { DrawElement, DropShadow, IconElement, ShapeElement } from "@/types/element";
import {
  gradientDefsUserSpace,
  gradientElement,
} from "./gradientSvg";

/** Iconify icon body + intrinsic viewBox size. */
export interface IconBody {
  body: string;
  width?: number;
  height?: number;
}

/** Trim trailing zeros so filter attrs stay compact. */
const n = (v: number): string => Number(v.toFixed(3)).toString();

/**
 * An inner-shadow `<filter>` clipped to the source's own alpha, so the shadow
 * falls *inside* the shape/icon outline. Offsets and blur arrive in element
 * pixels and are scaled into the SVG's user space by (`sx`, `sy`) — the two
 * builders use viewBoxes (100×100 shapes, vw×vh icons) stretched to the element
 * box, so x and y can scale differently.
 *
 * Recipe: invert SourceAlpha (outside becomes opaque), blur + offset it, flood
 * the shadow color through that inverted mask, then clip the result back inside
 * SourceGraphic and paint it over the original.
 */
export function innerShadowFilter(id: string, s: DropShadow, sx: number, sy: number): string {
  const dx = n(s.x * sx);
  const dy = n(s.y * sy);
  const bx = n(Math.max(0, s.blur) * sx);
  const by = n(Math.max(0, s.blur) * sy);
  const op = n(s.opacity ?? 1);
  return (
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>` +
    `<feGaussianBlur stdDeviation="${bx} ${by}"/>` +
    `<feOffset dx="${dx}" dy="${dy}" result="o"/>` +
    `<feFlood flood-color="${s.color}" flood-opacity="${op}"/>` +
    `<feComposite in2="o" operator="in"/>` +
    `<feComposite in2="SourceGraphic" operator="in" result="sh"/>` +
    `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge>` +
    `</filter>`
  );
}

/** Build the SVG for an icon element, applying its solid/gradient color. */
export function buildIconSvg(
  el: IconElement,
  iconBody: IconBody,
  ew: number,
  eh: number,
): string {
  const vw = iconBody.width ?? 256;
  const vh = iconBody.height ?? 256;
  let body = iconBody.body ?? "";
  let defsInner = "";
  const color = el.color;
  if (isGradient(color)) {
    const id = "giexp" + el.id;
    const isStroke = body.includes('stroke="currentColor"');
    body = isStroke
      ? body.replace(/stroke="currentColor"/g, `stroke="url(#${id})"`)
      : body.replace(/fill="currentColor"/g, `fill="url(#${id})"`);
    defsInner += gradientElement(id, color);
  } else {
    body = body.replace(/currentColor/g, color || "#ffffff");
  }
  if (el.innerShadow && ew > 0 && eh > 0) {
    const fid = "iis" + el.id;
    defsInner += innerShadowFilter(fid, el.innerShadow, vw / ew, vh / eh);
    body = `<g filter="url(#${fid})">${body}</g>`;
  }
  const defs = defsInner ? `<defs>${defsInner}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(ew)}" height="${Math.ceil(eh)}" viewBox="0 0 ${vw} ${vh}">${defs}${body}</svg>`;
}

/**
 * Shape geometry (opening tag + coordinate attrs, no fill/stroke/closing) for a
 * given inward inset `off`. Shared by the visible element and the "inside"
 * stroke clip-path so both agree on the exact same outline.
 */
function shapeGeometry(el: ShapeElement, off: number): string {
  if (el.shapeType === "ellipse") {
    return `<ellipse cx="50" cy="50" rx="${50 - off}" ry="${50 - off}"`;
  } else if (el.shapeType === "triangle") {
    return `<polygon points="50,${off} ${100 - off},${100 - off} ${off},${100 - off}"`;
  } else if (el.shapeType === "star") {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? 50 - off : (50 - off) * 0.42;
      pts.push(`${(50 + r * Math.cos(ang)).toFixed(1)},${(50 + r * Math.sin(ang)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(" ")}"`;
  } else if (el.shapeType === "hexagon") {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 2;
      const r = 50 - off;
      pts.push(`${(50 + r * Math.cos(ang)).toFixed(1)},${(50 + r * Math.sin(ang)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(" ")}"`;
  }
  const maxR = 50 - off;
  const rad = Math.min(el.borderRadius || 0, maxR);
  return `<rect x="${off}" y="${off}" width="${100 - off * 2}" height="${100 - off * 2}" rx="${rad}" ry="${rad}"`;
}

/** Build the SVG for a shape element (rect/ellipse/triangle/star/hexagon). */
export function buildShapeSvg(el: ShapeElement, ew: number, eh: number): string {
  const sw = el.stroke.enabled ? el.stroke.width : 0;
  const sp = el.stroke.position;
  const actualSW = sp === "center" ? sw : sw * 2;
  const off = sp === "outside" ? sw : 0;
  const paintOrder = sp === "inside" ? "fill stroke" : sp === "outside" ? "stroke fill" : "";
  const poAttr = paintOrder ? ` paint-order="${paintOrder}"` : "";
  const linejoinAttr = el.shapeType === "rect" || el.shapeType === "ellipse" ? "" : ` stroke-linejoin="round"`;

  let defs = "";
  let fillStr: string;
  if (!el.fill.enabled) {
    fillStr = "none";
  } else if (isGradient(el.fill.color)) {
    const id = "gfx" + el.id;
    defs = `<defs>${gradientElement(id, el.fill.color)}</defs>`;
    fillStr = `url(#${id})`;
  } else {
    fillStr = el.fill.color;
  }
  const strokeC = el.stroke.enabled ? el.stroke.color : "none";

  const common = `fill="${fillStr}" stroke="${strokeC}" stroke-width="${actualSW}"`;

  // "inside" doubles the stroke width (centered on the true outline) then relies
  // on a clip-path of that same outline to discard the outer half. Clipping to
  // the shape itself (rather than just the viewBox edge) keeps the stroke fully
  // interior for every shape type, not just rects that happen to touch all four
  // viewBox edges.
  let clipAttr = "";
  if (sp === "inside" && sw > 0) {
    const clipId = "gsclip" + el.id;
    defs += `<clipPath id="${clipId}">${shapeGeometry(el, 0)}/></clipPath>`;
    clipAttr = ` clip-path="url(#${clipId})"`;
  }

  let filterAttr = "";
  if (el.innerShadow && ew > 0 && eh > 0) {
    const fid = "sis" + el.id;
    defs += innerShadowFilter(fid, el.innerShadow, 100 / ew, 100 / eh);
    filterAttr = ` filter="url(#${fid})"`;
  }

  const inner = `${shapeGeometry(el, off)} ${common}${linejoinAttr}${poAttr}${clipAttr}${filterAttr}/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(ew)}" height="${Math.ceil(eh)}" viewBox="0 0 100 100" preserveAspectRatio="none">${defs}${inner}</svg>`;
}

/** Build the SVG for a freehand draw element (its path in local viewBox space). */
export function buildDrawSvg(el: DrawElement, ew: number, eh: number): string {
  const vbW = el.origWidth || el.width;
  const vbH = el.origHeight || el.height;
  let defs = "";
  let strokeStr: string;
  if (isGradient(el.stroke.color)) {
    const id = "gdx" + el.id;
    defs = gradientDefsUserSpace(id, el.stroke.color, vbW, vbH);
    strokeStr = `url(#${id})`;
  } else {
    strokeStr = el.stroke.color;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(ew)}" height="${Math.ceil(eh)}" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="none">${defs}<path d="${el.svgPath}" stroke="${strokeStr}" stroke-width="${el.stroke.size}" fill="none" stroke-linecap="${el.stroke.linecap}" stroke-linejoin="round"/></svg>`;
}
