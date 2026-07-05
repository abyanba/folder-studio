/**
 * Browser-only canvas orchestrator. Rasterizes the SVG-string builders
 * (base shape, elements, texture, clip mask) onto a real 2D canvas and applies
 * the auto-trim transform, then hands the finished canvas to {@link exportPng}
 * etc. Ported from public/legacy.html `buildExportCanvas` (L921-945) and
 * `_recolorCanvas` (L590-605).
 *
 * This module is NOT unit-tested in jsdom — jsdom cannot rasterize SVG data
 * URLs onto a canvas — so it is verified in real Chrome via the dev harness.
 * All pure sub-pieces it calls (SVG strings, ICO bytes, trim/text-layout math)
 * live in their own modules and ARE unit-tested.
 *
 * Icon bodies are injected through `deps.getIconBody` (the Iconify cache is a
 * Phase-6 concern); `deps.loadImage`/`deps.createCanvas` default to browser
 * globals so callers normally pass only `getIconBody`.
 */

import { CDX, CDY, FH, FW } from "@/lib/constants";
import { getHex, hexA } from "@/lib/color";
import { isGradient } from "@/types/gradient";
import type { FolderDocument } from "@/types/document";
import type { FolderElement, TextElement } from "@/types/element";
import { buildBaseShapeSvg, getBaseShapeMask } from "./baseShapes";
import { buildDrawSvg, buildIconSvg, buildShapeSvg } from "./elementSvg";
import type { IconBody } from "./elementSvg";
import { buildTextureSvg } from "./textures";
import { computeTextLayout, lineY, underlineX, underlineYOffset } from "./textLayout";
import { toSvgDataUrl } from "./svgDataUrl";
import { computeTrimBounds, computeTrimTransform } from "./trim";

/** A loaded raster source; `naturalWidth`/`Height` present for `HTMLImageElement`. */
export type LoadedImage = CanvasImageSource &
  Partial<{ naturalWidth: number; naturalHeight: number }>;

export type ImageLoader = (src: string) => Promise<LoadedImage>;
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export interface RenderDeps {
  /** Resolve an icon's SVG body + intrinsic viewBox, or null if not loaded. */
  getIconBody: (name: string, variant: string) => IconBody | null;
  /** Load an image from a URL/data-URL. Defaults to `new Image()`. */
  loadImage?: ImageLoader;
  /** Create a canvas. Defaults to `document.createElement("canvas")`. */
  createCanvas?: CanvasFactory;
}

function defaultLoadImage(src: string): Promise<LoadedImage> {
  return new Promise<LoadedImage>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function defaultCreateCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

/** Redraw the base folder (bg image or colored base shape) onto the canvas. */
async function recolorCanvas(
  canvas: HTMLCanvasElement,
  doc: FolderDocument,
  size: number,
  loadImage: ImageLoader,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = doc.folderOpacity ?? 1;
  if (doc.folderFillMode === "image" && doc.folderBgImage) {
    const bi = await loadImage(doc.folderBgImage);
    const zm = doc.folderBgZoom || 1;
    const bpx = (doc.folderBgX ?? 50) / 100;
    const bpy = (doc.folderBgY ?? 50) / 100;
    const dw = size * zm;
    const dh = size * zm;
    const dx = -(dw - size) * bpx;
    const dy = -(dh - size) * bpy;
    ctx.drawImage(bi, dx, dy, dw, dh);
  } else {
    const img = await loadImage(toSvgDataUrl(buildBaseShapeSvg(doc)));
    ctx.drawImage(img, 0, 0, size, size);
  }
  ctx.globalAlpha = 1;
}

/** Draw a single text element directly with the 2D context (no SVG form). */
function renderText(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  size: number,
  ew: number,
  eh: number,
): void {
  const sx = size / FW;
  const fontSizePx = el.fontSize * sx;
  ctx.font = `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight} ${fontSizePx}px "${el.fontFamily}"`;

  const sortedStops = isGradient(el.color)
    ? [...el.color.stops].sort((a, b) => a.pos - b.pos)
    : [];
  // Solid fallback color, also used for the underline stroke.
  const solidColor = isGradient(el.color)
    ? getHex(sortedStops[0].hue, sortedStops[0].sat, sortedStops[0].bri)
    : el.color;

  if (isGradient(el.color)) {
    let tg: CanvasGradient;
    if (el.color.kind === "radial") {
      tg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(ew, eh) / 2);
    } else {
      const ang = (el.color.angle || 90) * (Math.PI / 180);
      tg = ctx.createLinearGradient(
        -Math.sin(ang) * (ew / 2),
        Math.cos(ang) * (eh / 2),
        Math.sin(ang) * (ew / 2),
        -Math.cos(ang) * (eh / 2),
      );
    }
    sortedStops.forEach((st) => tg.addColorStop(st.pos, getHex(st.hue, st.sat, st.bri)));
    ctx.fillStyle = tg;
  } else {
    ctx.fillStyle = el.color;
  }

  ctx.textAlign = el.align;
  ctx.textBaseline = "middle";
  if (el.letterSpacing) ctx.letterSpacing = el.letterSpacing + "px";

  const layout = computeTextLayout(el.text, fontSizePx, el.lineHeight, el.align, ew);
  const { lines, tx } = layout;

  const drawUnderline = (): void => {
    if (!el.underline) return;
    ctx.save();
    ctx.strokeStyle = solidColor;
    ctx.lineWidth = Math.max(1, fontSizePx * 0.06);
    lines.forEach((line, li) => {
      const w2 = ctx.measureText(line).width;
      const ux = underlineX(el.align, tx, w2);
      const uy = lineY(layout, li) + underlineYOffset(fontSizePx);
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(ux + w2, uy);
      ctx.stroke();
    });
    ctx.restore();
  };

  if (el.shadow) {
    ctx.save();
    ctx.shadowOffsetX = el.shadow.x * sx;
    ctx.shadowOffsetY = el.shadow.y * sx;
    ctx.shadowBlur = el.shadow.blur * sx;
    ctx.shadowColor = hexA(el.shadow.color, el.shadow.opacity ?? 1);
    lines.forEach((line, li) => ctx.fillText(line, tx, lineY(layout, li)));
    ctx.restore();
  }

  if (el.stroke && el.stroke.width > 0) {
    const pf = el.stroke.position || "outside";
    ctx.lineWidth = el.stroke.width * sx * (pf === "center" ? 1 : 2);
    ctx.strokeStyle = el.stroke.color || "#000";
    ctx.lineJoin = "round";
    lines.forEach((line, li) => {
      const y = lineY(layout, li);
      if (pf === "inside") {
        ctx.fillText(line, tx, y);
        ctx.save();
        ctx.strokeText(line, tx, y);
        ctx.restore();
      } else {
        // "outside" and "center" both stroke-then-fill in the legacy renderer.
        ctx.strokeText(line, tx, y);
        ctx.fillText(line, tx, y);
      }
    });
  } else {
    lines.forEach((line, li) => ctx.fillText(line, tx, lineY(layout, li)));
  }

  drawUnderline();
}

/** Draw a single non-text element (icon/image/draw/shape). */
async function renderElement(
  ctx: CanvasRenderingContext2D,
  el: FolderElement,
  size: number,
  deps: RenderDeps,
  loadImage: ImageLoader,
): Promise<void> {
  const sx = size / FW;
  const sy = size / FH;
  const ex = CDX * sx + el.x * sx;
  const ey = CDY * sy + el.y * sy;
  const ew = el.width * sx;
  const eh = el.height * sy;

  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  if ((el.type === "icon" || el.type === "shape" || el.type === "image") && el.dropShadow) {
    const ds = el.dropShadow;
    ctx.shadowOffsetX = ds.x * (size / FW);
    ctx.shadowOffsetY = ds.y * (size / FH);
    ctx.shadowBlur = ds.blur * (size / FW);
    ctx.shadowColor = hexA(ds.color, ds.opacity ?? 1);
  }
  ctx.translate(ex + ew / 2, ey + eh / 2);
  ctx.rotate(el.rotation * (Math.PI / 180));

  if (el.type === "icon") {
    const body = deps.getIconBody(el.iconName, el.iconVariant || "regular");
    if (body) {
      const img = await loadImage(toSvgDataUrl(buildIconSvg(el, body, ew, eh)));
      ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
    }
  } else if (el.type === "image") {
    const img = await loadImage(el.src);
    if (el.blendMode && el.blendMode !== "normal") {
      ctx.globalCompositeOperation = el.blendMode;
    }
    ctx.scale(el.scaleX ?? 1, el.scaleY ?? 1);
    ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
    if (el.stroke?.enabled && (el.stroke.width || 0) > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = el.stroke.color || "#000000";
      ctx.lineWidth = (el.stroke.width || 2) * (size / FW);
      ctx.strokeRect(-ew / 2, -eh / 2, ew, eh);
    }
  } else if (el.type === "draw") {
    const img = await loadImage(toSvgDataUrl(buildDrawSvg(el, ew, eh)));
    ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
  } else if (el.type === "shape") {
    const img = await loadImage(toSvgDataUrl(buildShapeSvg(el, ew, eh)));
    ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
  } else {
    renderText(ctx, el, size, ew, eh);
  }

  ctx.restore();
}

/** Composite the texture pattern over the current canvas, clipped to content. */
async function renderTexture(
  ctx: CanvasRenderingContext2D,
  doc: FolderDocument,
  size: number,
  loadImage: ImageLoader,
  createCanvas: CanvasFactory,
): Promise<void> {
  const texSvg = buildTextureSvg(doc.texture);
  if (!texSvg) return;
  const tImg = await loadImage(toSvgDataUrl(texSvg));
  const exportScale = size / FW;
  const nW = tImg.naturalWidth || 10;
  const nH = tImg.naturalHeight || 10;
  const tileW = Math.max(1, Math.round(nW * doc.texture.scale * exportScale));
  const tileH = Math.max(1, Math.round(nH * doc.texture.scale * exportScale));
  const tile = createCanvas(tileW, tileH);
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(tImg, 0, 0, tileW, tileH);

  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = doc.texture.opacity;
  ctx.fillStyle = pattern;
  const rot = doc.texture.rotation || 0;
  if (rot) {
    // Match the editor's TextureOverlay: the tiled pattern rotates about the
    // folder center, with enough overdraw (its 220% layer) to keep the rotated
    // tiling covering every corner of the canvas.
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const over = size * 1.2;
    ctx.fillRect(-over, -over, over * 2, over * 2);
  } else {
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();
}

/**
 * Render `doc` to a `size`×`size` canvas: base recolor, elements below the
 * texture layer, texture, elements above it, optional clip-to-folder mask, and
 * the auto-trim pass. Returns the finished canvas (a fresh trimmed one when the
 * content needed recentering).
 */
export async function buildExportCanvas(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<HTMLCanvasElement> {
  const loadImage = deps.loadImage ?? defaultLoadImage;
  const createCanvas = deps.createCanvas ?? defaultCreateCanvas;

  const canvas = createCanvas(size, size);
  await recolorCanvas(canvas, doc, size, loadImage);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const tz = Math.min(doc.textureLayerZ, doc.elements.length);
  for (let i = 0; i < tz; i++) {
    const el = doc.elements[i];
    if (el.visible === false) continue;
    await renderElement(ctx, el, size, deps, loadImage);
  }

  await renderTexture(ctx, doc, size, loadImage, createCanvas);

  for (let i = tz; i < doc.elements.length; i++) {
    const el = doc.elements[i];
    if (el.visible === false) continue;
    await renderElement(ctx, el, size, deps, loadImage);
  }

  if (doc.clipToFolder) {
    const maskSvg = getBaseShapeMask(doc.baseShape);
    if (maskSvg) {
      const mi = await loadImage(toSvgDataUrl(maskSvg));
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mi, 0, 0, size, size);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // Auto-trim transparent padding so the icon fills the export canvas.
  const data = ctx.getImageData(0, 0, size, size).data;
  const bounds = computeTrimBounds(data, size);
  const t = computeTrimTransform(bounds, size);
  if (t) {
    const fc = createCanvas(size, size);
    const fctx = fc.getContext("2d");
    if (fctx) {
      fctx.drawImage(
        canvas,
        t.srcX,
        t.srcY,
        Math.min(t.tw, size - t.srcX),
        Math.min(t.th, size - t.srcY),
        t.dx,
        t.dy,
        t.dw,
        t.dh,
      );
      return fc;
    }
  }
  return canvas;
}
