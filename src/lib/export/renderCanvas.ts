/**
 * Browser-only canvas orchestrator. Rasterizes the SVG-string builders
 * (base shape, elements, pattern, clip mask) onto a real 2D canvas and applies
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
import { getHex, hexA, stopColor } from "@/lib/color";
import { isGradient } from "@/types/gradient";
import type { FolderDocument } from "@/types/document";
import { elementMaterial } from "@/types/element";
import type { DropShadow, ElementMaterial, FolderElement, TextElement } from "@/types/element";
import {
  buildBaseShapeOverlaySvg,
  buildBaseShapePaperSvg,
  buildBaseShapeSvg,
  buildFrontImageBackSvg,
  buildFrontImageOverlaySvg,
  buildImageColorOverlaySvg,
  getBaseShapeMask,
  getFrontMask,
  isFrontImage,
} from "./baseShapes";
import { buildDrawSvg, buildIconSvg, buildImageStrokeSvg, buildShapeSvg, iconStrokePadPx, imageStrokePadPx, shapeStrokePadPx } from "./elementSvg";
import type { IconBody } from "./elementSvg";
import { containRect } from "./containRect";
import { gradientLine } from "./gradientSvg";
import { computeTextLayout, lineY, underlineX, underlineYOffset } from "./textLayout";
import { toSvgDataUrl } from "./svgDataUrl";
import { computeTrimBounds, computeTrimTransform } from "./trim";
import { buildPatternLayerSvg, isFrontPattern } from "./patterns";
import { buildMaterialLayerSvg, isFrontMaterial } from "./materials";
import { getPatternBody } from "@/lib/patternBodies";

/** A loaded raster source; `naturalWidth`/`Height` present for `HTMLImageElement`. */
export type LoadedImage = CanvasImageSource &
  Partial<{ naturalWidth: number; naturalHeight: number }>;

/** Resolves `null` on decode failure so callers skip the source, not crash (EXP-12). */
export type ImageLoader = (src: string) => Promise<LoadedImage | null>;
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export interface RenderDeps {
  /** Resolve an icon's SVG body + intrinsic viewBox, or null if not loaded. */
  getIconBody: (name: string, variant: string) => IconBody | null;
  /** Load an image from a URL/data-URL. Defaults to `new Image()`. */
  loadImage?: ImageLoader;
  /** Create a canvas. Defaults to `document.createElement("canvas")`. */
  createCanvas?: CanvasFactory;
  /**
   * Await document-driven asset readiness before rasterizing: hydrate icon
   * bodies (EXP-13) and load fonts (EXP-07). Injected so the pure pipeline stays
   * jsdom-testable; real callers pass `prepareDocumentAssets`.
   */
  prepare?: (doc: FolderDocument) => Promise<void>;
}

/** A rendered canvas plus the human-readable labels of any layers that failed to load. */
export interface ExportResult {
  canvas: HTMLCanvasElement;
  /** Element names (or ids) skipped because their image/body couldn't be loaded. */
  skipped: string[];
}

/** Human-readable label for a skipped layer (element name, falling back to id). */
function elementLabel(el: FolderElement): string {
  return el.name?.trim() || el.id;
}

function defaultLoadImage(src: string): Promise<LoadedImage | null> {
  return new Promise<LoadedImage | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
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
  createCanvas: CanvasFactory,
  skipped: string[],
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = doc.folderOpacity ?? 1;
  if (doc.folderFillMode === "image" && doc.folderBgImage) {
    const bi = await loadImage(doc.folderBgImage);
    if (bi) {
      const zm = doc.folderBgZoom || 1;
      const bpx = (doc.folderBgX ?? 50) / 100;
      const bpy = (doc.folderBgY ?? 50) / 100;
      // Mirror the editor's CSS `background-size: <zoom>%` (width set, height
      // auto): width is zoom×canvas and height follows the image's aspect ratio,
      // so a non-square photo isn't squashed into the square canvas.
      const natW = bi.naturalWidth || size;
      const natH = bi.naturalHeight || size;
      const dw = size * zm;
      const dh = dw * (natH / natW);
      const dx = -(dw - size) * bpx;
      const dy = -(dh - size) * bpy;
      // Color tint over the image (masked to the folder), below the structure.
      const tint = buildImageColorOverlaySvg(doc.baseShape, doc.folderBgOverlayColor, doc.folderBgOverlayOpacity);
      const tintImg = tint ? await loadImage(toSvgDataUrl(tint)) : null;
      if (isFrontImage(doc)) {
        // Compose the front-only base at full alpha on a temp canvas, then draw
        // it once at folderOpacity: image masked to the front, adaptive back
        // painted behind it, tint over that, structure overlay on top.
        const tmp = createCanvas(size, size);
        const tctx = tmp.getContext("2d");
        if (tctx) {
          tctx.drawImage(bi, dx, dy, dw, dh);
          const fm = await loadImage(toSvgDataUrl(getFrontMask(doc.baseShape)));
          if (fm) {
            tctx.globalCompositeOperation = "destination-in";
            tctx.drawImage(fm, 0, 0, size, size);
          }
          const back = await loadImage(
            toSvgDataUrl(
              buildFrontImageBackSvg(
                doc.baseShape,
                doc.folderBgImageColor ?? "#888888",
                doc.folderBackColor,
                doc.folderBgImageColor2,
              ),
            ),
          );
          if (back) {
            tctx.globalCompositeOperation = "destination-over";
            tctx.drawImage(back, 0, 0, size, size);
          }
          tctx.globalCompositeOperation = "source-over";
          if (tintImg) tctx.drawImage(tintImg, 0, 0, size, size);
          const shine = await loadImage(toSvgDataUrl(buildFrontImageOverlaySvg(doc.baseShape)));
          if (shine) tctx.drawImage(shine, 0, 0, size, size);
          // Paper peek on top — the image never affects it (self-clipped).
          const paperSvg = buildBaseShapePaperSvg(doc.baseShape, doc.folderState, doc.folderPaperColor);
          const paper = paperSvg ? await loadImage(toSvgDataUrl(paperSvg)) : null;
          if (paper) tctx.drawImage(paper, 0, 0, size, size);
          ctx.drawImage(tmp, 0, 0);
        }
      } else {
        ctx.drawImage(bi, dx, dy, dw, dh);
        if (tintImg) ctx.drawImage(tintImg, 0, 0, size, size);
        // Folder-structure shading over the image (same builder as the editor).
        const overlay = buildBaseShapeOverlaySvg(doc.baseShape);
        if (overlay) {
          const oi = await loadImage(toSvgDataUrl(overlay));
          if (oi) ctx.drawImage(oi, 0, 0, size, size);
        }
        // Paper peek on top — the image never affects it (self-clipped).
        const paperSvg = buildBaseShapePaperSvg(doc.baseShape, doc.folderState, doc.folderPaperColor);
        const paper = paperSvg ? await loadImage(toSvgDataUrl(paperSvg)) : null;
        if (paper) ctx.drawImage(paper, 0, 0, size, size);
      }
    } else {
      skipped.push("Folder background");
    }
  } else {
    const img = await loadImage(toSvgDataUrl(buildBaseShapeSvg(doc)));
    if (img) ctx.drawImage(img, 0, 0, size, size);
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

  // The box is a transform/selection frame, so text overflows it freely unless
  // `clip` is on — matching the editor's `overflow` and the SVG export.
  ctx.save();
  if (el.clip) {
    ctx.beginPath();
    ctx.rect(-ew / 2, -eh / 2, ew, eh);
    ctx.clip();
  }

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
      // One shared endpoint formula for every gradient (AR-01); box-centered.
      const gl = gradientLine(el.color.angle || 90, ew, eh);
      tg = ctx.createLinearGradient(gl.x1 - ew / 2, gl.y1 - eh / 2, gl.x2 - ew / 2, gl.y2 - eh / 2);
    }
    sortedStops.forEach((st) => tg.addColorStop(st.pos, stopColor(st.hue, st.sat, st.bri, st.alpha)));
    ctx.fillStyle = tg;
  } else {
    ctx.fillStyle = el.color;
  }

  ctx.textAlign = el.align;
  ctx.textBaseline = "middle";

  // Letter-spacing scales with the export like the font does. Prefer native
  // ctx.letterSpacing; fall back to manual per-char placement where it's
  // unsupported (older Safari — EXP-06).
  const ls = (el.letterSpacing || 0) * sx;
  const lsNative = ls !== 0 && "letterSpacing" in ctx;
  if (lsNative) ctx.letterSpacing = `${ls}px`;
  const lsManual = ls !== 0 && !lsNative;

  const measure = (s: string): number => ctx.measureText(s).width;
  // When ctx applies spacing itself, measureText already includes it.
  const wrapLs = lsNative ? 0 : ls;
  const lineWidth = (s: string): number => measure(s) + wrapLs * Math.max(0, s.length - 1);

  const layout = computeTextLayout(
    el.text,
    fontSizePx,
    el.lineHeight,
    el.align,
    ew,
    measure,
    wrapLs,
  );
  const { lines, tx } = layout;

  /** Draw one line's fill, honoring the manual letter-spacing fallback. */
  const fillLine = (line: string, y: number): void => {
    if (!lsManual) {
      ctx.fillText(line, tx, y);
      return;
    }
    const total = lineWidth(line);
    const startX = el.align === "left" ? tx : el.align === "right" ? tx - total : tx - total / 2;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";
    let cx = startX;
    for (const ch of line) {
      ctx.fillText(ch, cx, y);
      cx += measure(ch) + ls;
    }
    ctx.textAlign = prevAlign;
  };

  const drawUnderline = (): void => {
    if (!el.underline) return;
    ctx.save();
    ctx.strokeStyle = solidColor;
    ctx.lineWidth = Math.max(1, fontSizePx * 0.06);
    lines.forEach((line, li) => {
      const w2 = lineWidth(line);
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
    lines.forEach((line, li) => fillLine(line, lineY(layout, li)));
    ctx.restore();
  }

  if (el.stroke && el.stroke.width > 0) {
    const pf = el.stroke.position || "outside";
    // Only "outside" doubles (its inner half is covered by the fill below).
    // "center" and "inside" use the width as-is; "inside" can't be clipped to
    // the glyph outline here, so it renders like "center" rather than at 2×.
    ctx.lineWidth = el.stroke.width * sx * (pf === "outside" ? 2 : 1);
    ctx.strokeStyle = el.stroke.color || "#000";
    ctx.lineJoin = "round";
    lines.forEach((line, li) => {
      const y = lineY(layout, li);
      if (pf === "outside") {
        // Stroke under the fill: the fill covering the inner half is what turns
        // the doubled band into a `width`-wide band sitting outside the glyph.
        ctx.strokeText(line, tx, y);
        fillLine(line, y);
      } else {
        // "center"/"inside" straddle the glyph edge, so they paint OVER the
        // fill — under it, the fill would eat the inner half and leave a
        // half-width outside stroke instead.
        fillLine(line, y);
        ctx.strokeText(line, tx, y);
      }
    });
  } else {
    lines.forEach((line, li) => fillLine(line, lineY(layout, li)));
  }

  drawUnderline();
  ctx.restore();
}

/** Draw a single non-text element (icon/image/draw/shape). */
/** All-white mask, so the grain field covers the whole frame unclipped. */
const FULL_FRAME_MASK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/></svg>';

/**
 * Cast an inner shadow inside the glyphs already drawn on `layer`.
 *
 * Text is the one element with no SVG form the canvas can rasterize — a
 * data-URL SVG has no access to the document's fonts — so the filter the editor
 * and vector export share is rebuilt here with compositing ops. It is the same
 * recipe: the filter blurs the INVERTED alpha and offsets it; blurring an
 * inverse equals inverting the blur (blur is linear and preserves DC), so
 * subtracting the offset blurred glyph from a flood of the shadow colour gives
 * the identical field, which is then clipped back inside the glyphs.
 */
function applyInnerShadow(
  layer: HTMLCanvasElement,
  shadow: DropShadow,
  scale: number,
  createCanvas: CanvasFactory,
): void {
  const lctx = layer.getContext("2d");
  const shade = createCanvas(layer.width, layer.height);
  const sctx = shade.getContext("2d");
  if (!lctx || !sctx) return;

  sctx.fillStyle = hexA(shadow.color, shadow.opacity ?? 1);
  sctx.fillRect(0, 0, layer.width, layer.height);
  sctx.globalCompositeOperation = "destination-out";
  // `blur(<length>)` takes a standard deviation, which is what feGaussianBlur
  // takes too — so this is the same radius, not half or double it.
  if ("filter" in sctx) sctx.filter = `blur(${Math.max(0, shadow.blur) * scale}px)`;
  sctx.drawImage(layer, shadow.x * scale, shadow.y * scale);
  if ("filter" in sctx) sctx.filter = "none";
  // Clip the field back inside the glyphs, so the shadow falls INSIDE them.
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(layer, 0, 0);

  lctx.save();
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.drawImage(shade, 0, 0);
  lctx.restore();
}

/**
 * Text with any effect that needs its own layer — a surface material, an inner
 * shadow, or both. Shape and icon get both for free —
 * the canvas rasterizes the very SVG string the editor injects, filter and all.
 * Text is the one element with no shared SVG form (it is drawn with `fillText`),
 * so the same result is rebuilt here from two scratch layers: the glyphs, and
 * the grain intersected with the glyph alpha. Intersecting is what keeps the
 * grain inside the letterforms instead of smearing it over the folder behind.
 */
async function renderTextLayered(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  size: number,
  ew: number,
  eh: number,
  material: ElementMaterial | undefined,
  createCanvas: CanvasFactory,
  loadImage: ImageLoader,
): Promise<void> {
  const glyphs = createCanvas(size, size);
  const gctx = glyphs.getContext("2d");
  const grainSvg = material
    ? buildMaterialLayerSvg({ ...material, span: "full" }, FULL_FRAME_MASK)
    : null;
  const grainImg = grainSvg ? await loadImage(toSvgDataUrl(grainSvg)) : null;
  if (!gctx || (material && !grainImg)) {
    // No scratch canvas or the grain failed to decode: draw plain text rather
    // than dropping the element entirely.
    renderText(ctx, el, size, ew, eh);
    return;
  }

  // Inherit the caller's transform verbatim instead of recomputing it, so the
  // scratch layers can't drift from where the element actually sits.
  const t = ctx.getTransform();
  gctx.setTransform(t);
  renderText(gctx, el, size, ew, eh);
  // Inside the glyphs and BELOW the grain, so a materialed inner shadow picks
  // up the surface rather than sitting on top of it.
  if (el.innerShadow) applyInnerShadow(glyphs, el.innerShadow, size / FW, createCanvas);

  if (!grainImg) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(glyphs, 0, 0);
    ctx.restore();
    return;
  }

  // Grain drawn under the element's own transform, so it rotates with the text
  // exactly as the injected filter does in the editor and the vector export.
  // Allocated only now: text with an inner shadow but no material reaches the
  // early return above without ever paying for a second full-size canvas.
  const grain = createCanvas(size, size);
  const rctx = grain.getContext("2d");
  if (!rctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(glyphs, 0, 0);
    ctx.restore();
    return;
  }
  rctx.setTransform(t);
  // ponytail: one grain tile centred on the element. Text overflowing more than
  // half the canvas from its own centre would leave the excess unshaded — tile
  // a 2x2 grid here if that ever shows up.
  rctx.drawImage(grainImg, -size / 2, -size / 2, size, size);
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalCompositeOperation = "destination-in";
  rctx.drawImage(glyphs, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(glyphs, 0, 0);
  ctx.globalCompositeOperation = "soft-light";
  ctx.drawImage(grain, 0, 0);
  ctx.restore();
}

async function renderElement(
  ctx: CanvasRenderingContext2D,
  el: FolderElement,
  size: number,
  deps: RenderDeps,
  loadImage: ImageLoader,
  createCanvas: CanvasFactory,
  skipped: string[],
): Promise<void> {
  const sx = size / FW;
  const sy = size / FH;
  const ex = CDX * sx + el.x * sx;
  const ey = CDY * sy + el.y * sy;
  const ew = el.width * sx;
  const eh = el.height * sy;

  // A shadow plus partial opacity has to be composed at full alpha and faded
  // ONCE, or the shadow and the element each fade separately against the folder
  // and the shadow shows through the element that should be covering it. With a
  // white shadow under a dark 55%-opaque logo that visibly lightens the logo —
  // and the vector export never had the bug, because there `opacity` applies to
  // the already-filtered group as a unit. This restores that grouping.
  const shadow =
    (el as { dropShadow?: DropShadow }).dropShadow ?? (el as { shadow?: DropShadow }).shadow;
  const opacity = el.opacity ?? 1;
  if (opacity < 1 && shadow) {
    const tmp = createCanvas(size, size);
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.setTransform(ctx.getTransform());
      await renderElement(tctx, { ...el, opacity: 1 }, size, deps, loadImage, createCanvas, skipped);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      return;
    }
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  if ((el.type === "icon" || el.type === "shape" || el.type === "image") && el.dropShadow) {
    const ds = el.dropShadow;
    ctx.shadowOffsetX = ds.x * (size / FW);
    ctx.shadowOffsetY = ds.y * (size / FH);
    ctx.shadowBlur = ds.blur * (size / FW);
    ctx.shadowColor = hexA(ds.color, ds.opacity ?? 1);
  }
  ctx.translate(ex + ew / 2, ey + eh / 2);
  ctx.rotate(el.rotation * (Math.PI / 180));
  // Flip/non-uniform scale applies to EVERY element type here, mirroring the
  // editor's single `rotate() scale()` transform on the element wrapper — not
  // just images (EXP-01). Keep this above the branches so text flips too.
  ctx.scale(el.scaleX ?? 1, el.scaleY ?? 1);

  if (el.type === "icon") {
    const body = deps.getIconBody(el.iconName, el.iconVariant || "regular");
    const img = body ? await loadImage(toSvgDataUrl(buildIconSvg(el, body, ew, eh))) : null;
    if (img) {
      // A stroke grows buildIconSvg's viewBox beyond the box (like images), so
      // draw it inflated by that same outward reach or the ring is cropped.
      const { px, py } = iconStrokePadPx(el, ew, eh);
      ctx.drawImage(img, -ew / 2 - px, -eh / 2 - py, ew + px * 2, eh + py * 2);
    } else skipped.push(elementLabel(el));
  } else if (el.type === "image") {
    const hasStroke = el.stroke?.enabled && (el.stroke.width || 0) > 0;
    // With a stroke, render the shape-hugging outline SVG (feMorphology dilate
    // of the logo's own alpha) — the same builder the editor injects. Without
    // one, the fast path draws el.src directly.
    const img = hasStroke
      ? await loadImage(toSvgDataUrl(buildImageStrokeSvg(el, ew, eh)))
      : await loadImage(el.src);
    if (img) {
      if (el.blendMode && el.blendMode !== "normal") {
        ctx.globalCompositeOperation = el.blendMode;
      }
      if (hasStroke) {
        // The outline SVG letterboxes the image (xMidYMid meet) inside the
        // element box, but is inflated by the outline's outward reach so the
        // ring isn't cropped — draw it offset by that same pad.
        const { px, py } = imageStrokePadPx(el, ew, eh);
        ctx.drawImage(img, -ew / 2 - px, -eh / 2 - py, ew + px * 2, eh + py * 2);
      } else {
        // Letterbox to preserve aspect ratio, matching the editor's
        // `object-fit: contain` (EXP-02) instead of stretching to the box.
        const natW = img.naturalWidth ?? ew;
        const natH = img.naturalHeight ?? eh;
        const r = containRect(natW, natH, ew, eh);
        ctx.drawImage(img, -ew / 2 + r.dx, -eh / 2 + r.dy, r.dw, r.dh);
      }
    } else {
      skipped.push(elementLabel(el));
    }
  } else if (el.type === "draw") {
    const img = await loadImage(toSvgDataUrl(buildDrawSvg(el, ew, eh)));
    if (img) ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
    else skipped.push(elementLabel(el));
  } else if (el.type === "shape") {
    const img = await loadImage(toSvgDataUrl(buildShapeSvg(el, ew, eh)));
    // An outside/center stroke paints beyond the element box, so the SVG is
    // bigger than the box and has to be drawn inflated by that same margin.
    const { px, py } = shapeStrokePadPx(el, ew, eh);
    if (img) ctx.drawImage(img, -ew / 2 - px, -eh / 2 - py, ew + px * 2, eh + py * 2);
    else skipped.push(elementLabel(el));
  } else {
    const mat = elementMaterial(el);
    if (mat || el.innerShadow) {
      await renderTextLayered(ctx, el, size, ew, eh, mat, createCanvas, loadImage);
    } else {
      renderText(ctx, el, size, ew, eh);
    }
  }

  ctx.restore();
}

/**
 * Composite the pattern layer. Rasterizes the SAME layer SVG the editor injects
 * and the vector export inlines, so the three can't drift — this replaced a
 * hand-rolled createPattern + overdraw + destination-in sequence that had to be
 * kept in agreement with the other two by hand.
 */
async function renderPattern(
  ctx: CanvasRenderingContext2D,
  doc: FolderDocument,
  size: number,
  loadImage: ImageLoader,
): Promise<void> {
  const body = getPatternBody(doc.pattern.id);
  if (body) {
    const maskSvg = isFrontPattern(doc.baseShape, doc.pattern)
      ? getFrontMask(doc.baseShape)
      : getBaseShapeMask(doc.baseShape);
    const layer = await loadImage(toSvgDataUrl(buildPatternLayerSvg(doc.pattern, body, maskSvg)));
    if (layer) ctx.drawImage(layer, 0, 0, size, size);
  }

  // The material blends over base + pattern together, which is what makes the
  // pattern pick up the grain instead of floating on top of it.
  const materialSvg = buildMaterialLayerSvg(
    doc.material,
    isFrontMaterial(doc.baseShape, doc.material)
      ? getFrontMask(doc.baseShape)
      : getBaseShapeMask(doc.baseShape),
  );
  if (materialSvg) {
    const mImg = await loadImage(toSvgDataUrl(materialSvg));
    if (mImg) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.drawImage(mImg, 0, 0, size, size);
      ctx.restore();
    }
  }

  // Re-apply the folder's highlights over the surface treatment, or it buries
  // them and the folder reads flat. Highlights only (`buildFrontImageOverlaySvg`)
  // — the full overlay's darkening vignette is already baked into a colour base
  // and would compound.
  //
  // Guarded: with neither a pattern nor a material there is nothing covering the
  // base's own shine, and re-applying it would double it on every plain folder.
  if (!body && !materialSvg) return;
  const structure = buildFrontImageOverlaySvg(doc.baseShape);
  if (structure) {
    const sImg = await loadImage(toSvgDataUrl(structure));
    if (sImg) ctx.drawImage(sImg, 0, 0, size, size);
  }
}

/**
 * Render `doc` to a `size`×`size` canvas: base recolor, elements below the
 * pattern layer, pattern, elements above it, optional clip-to-folder mask, and
 * the auto-trim pass. Returns the finished canvas (a fresh trimmed one when the
 * content needed recentering) plus the labels of any layers whose image/body
 * couldn't be loaded (EXP-12/13 surfacing plumbing).
 */
export async function buildExportCanvas(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<ExportResult> {
  const loadImage = deps.loadImage ?? defaultLoadImage;
  const createCanvas = deps.createCanvas ?? defaultCreateCanvas;
  const skipped: string[] = [];

  // Ensure icon bodies and fonts are loaded before we rasterize, so a
  // gallery-loaded design doesn't export with blank icons or fallback fonts.
  if (deps.prepare) await deps.prepare(doc);

  const canvas = createCanvas(size, size);
  await recolorCanvas(canvas, doc, size, loadImage, createCanvas, skipped);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, skipped };

  const tz = Math.min(doc.patternLayerZ, doc.elements.length);
  for (let i = 0; i < tz; i++) {
    const el = doc.elements[i];
    if (el.visible === false) continue;
    await renderElement(ctx, el, size, deps, loadImage, createCanvas, skipped);
  }

  await renderPattern(ctx, doc, size, loadImage);

  for (let i = tz; i < doc.elements.length; i++) {
    const el = doc.elements[i];
    if (el.visible === false) continue;
    await renderElement(ctx, el, size, deps, loadImage, createCanvas, skipped);
  }

  if (doc.clipToFolder) {
    const maskSvg = getBaseShapeMask(doc.baseShape);
    if (maskSvg) {
      const mi = await loadImage(toSvgDataUrl(maskSvg));
      if (mi) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(mi, 0, 0, size, size);
        ctx.globalCompositeOperation = "source-over";
      }
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
      // t.tw/t.th are already clamped to the canvas by computeTrimTransform.
      fctx.drawImage(canvas, t.srcX, t.srcY, t.tw, t.th, t.dx, t.dy, t.dw, t.dh);
      return { canvas: fc, skipped };
    }
  }
  return { canvas, skipped };
}
