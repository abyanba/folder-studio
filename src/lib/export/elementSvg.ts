/**
 * Per-element SVG string builders (icon, shape, freehand draw). These are
 * rasterized by the canvas orchestrator via `new Image()`. Text has no SVG form
 * (drawn directly on the canvas), so it lives in the orchestrator + textLayout.
 *
 * Ported from public/legacy.html L929 (icon), L932 (shape), L931 (draw).
 */

import { isGradient } from "@/types/gradient";
import type { DrawElement, IconElement, ShapeElement } from "@/types/element";
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
  let defs = "";
  const color = el.color;
  if (isGradient(color)) {
    const id = "giexp" + el.id;
    const isStroke = body.includes('stroke="currentColor"');
    body = isStroke
      ? body.replace(/stroke="currentColor"/g, `stroke="url(#${id})"`)
      : body.replace(/fill="currentColor"/g, `fill="url(#${id})"`);
    defs = `<defs>${gradientElement(id, color)}</defs>`;
  } else {
    body = body.replace(/currentColor/g, color || "#ffffff");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(ew)}" height="${Math.ceil(eh)}" viewBox="0 0 ${vw} ${vh}">${defs}${body}</svg>`;
}

/** Build the SVG for a shape element (rect/ellipse/triangle/star/hexagon). */
export function buildShapeSvg(el: ShapeElement, ew: number, eh: number): string {
  const sw = el.stroke.enabled ? el.stroke.width : 0;
  const sp = el.stroke.position;
  const actualSW = sp === "center" ? sw : sw * 2;
  const off = sp === "outside" ? sw : 0;
  const paintOrder = sp === "inside" ? "fill stroke" : sp === "outside" ? "stroke fill" : "";
  const poAttr = paintOrder ? ` paint-order="${paintOrder}"` : "";

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
  let inner: string;
  if (el.shapeType === "ellipse") {
    inner = `<ellipse cx="50" cy="50" rx="${50 - off}" ry="${50 - off}" ${common}${poAttr}/>`;
  } else if (el.shapeType === "triangle") {
    inner = `<polygon points="50,${off} ${100 - off},${100 - off} ${off},${100 - off}" ${common} stroke-linejoin="round"${poAttr}/>`;
  } else if (el.shapeType === "star") {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? 50 - off : (50 - off) * 0.42;
      pts.push(`${(50 + r * Math.cos(ang)).toFixed(1)},${(50 + r * Math.sin(ang)).toFixed(1)}`);
    }
    inner = `<polygon points="${pts.join(" ")}" ${common} stroke-linejoin="round"${poAttr}/>`;
  } else if (el.shapeType === "hexagon") {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 2;
      const r = 50 - off;
      pts.push(`${(50 + r * Math.cos(ang)).toFixed(1)},${(50 + r * Math.sin(ang)).toFixed(1)}`);
    }
    inner = `<polygon points="${pts.join(" ")}" ${common} stroke-linejoin="round"${poAttr}/>`;
  } else {
    const maxR = 50 - off;
    const rad = Math.min(el.borderRadius || 0, maxR);
    inner = `<rect x="${off}" y="${off}" width="${100 - off * 2}" height="${100 - off * 2}" rx="${rad}" ry="${rad}" ${common}${poAttr}/>`;
  }

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
