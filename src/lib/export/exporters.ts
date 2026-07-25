/**
 * Blob exporters built on {@link buildExportCanvas}. Ported from
 * public/legacy.html `doExport` (L967-978) and `doBatchExport` (L947-966), with
 * JSZip now a bundled npm dependency instead of a CDN `import()`.
 *
 * Each function returns a Blob so callers (dev harness now, toolbar in Phase 5)
 * decide how to deliver it; {@link downloadBlob} is the browser save helper.
 */

import type { FolderDocument } from "@/types/document";
import type { TextElement } from "@/types/element";
import { buildExportCanvas } from "./renderCanvas";
import type { RenderDeps } from "./renderCanvas";
import { encodeIcoMulti } from "./ico";
import type { IcoImage } from "./ico";
import { encodeIcns, isIcnsSize } from "./icns";
import type { IcnsImage } from "./icns";
import { buildExportSvg } from "./svgExport";
import { getPatternBody } from "@/lib/patternBodies";
import type { MeasureText } from "./textLayout";
import { collectFontFaceCss } from "./svgFonts";

export type ExportFormat = "png" | "svg" | "ico" | "icns";

/**
 * Standard multi-resolution set packed into an .ico (all ≤256, the ICO cap).
 * Mirrors the ladder in Windows' own folder icons — 20/24/40 are the 125%,
 * 150% and 250% DPI scalings of 16 and 32, which Explorer resamples without.
 */
export const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

/** Standard multi-resolution set packed into an .icns (macOS iconset sizes). */
export const ICNS_EXPORT_SIZES = [16, 32, 128, 256, 512];

/** A finished export plus the labels of any layers that couldn't be rendered (EXP-12/13). */
export interface ExportBlob {
  blob: Blob;
  skipped: string[];
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      type,
    );
  });
}

/** A canvas-backed text measurer so SVG word-wrap matches the raster export. */
function makeMeasure(): (el: TextElement) => MeasureText {
  const ctx = document.createElement("canvas").getContext("2d");
  return (el) => {
    if (!ctx) return (s) => s.length * el.fontSize * 0.5; // defensive fallback
    ctx.font = `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
    return (s) => ctx.measureText(s).width;
  };
}

/**
 * Natural pixel size of the folder background image (when the fill is an image),
 * so the vector SVG export can preserve its aspect ratio like the editor does.
 * Resolves `undefined` on non-image fills or a decode failure (the SVG then
 * treats the image as square, its prior behavior).
 */
function measureBgImage(doc: FolderDocument): Promise<{ w: number; h: number } | undefined> {
  if (doc.folderFillMode !== "image" || !doc.folderBgImage) return Promise.resolve(undefined);
  const src = doc.folderBgImage;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

/** Read a rendered canvas back as raw RGBA pixels for ICO packing. */
function icoPixels(canvas: HTMLCanvasElement, size: number): Uint8ClampedArray {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for ICO export");
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * Large entries are stored PNG-compressed (see {@link IcoImage.png}): a raw
 * 256px BMP is ~264 KB on its own, which is what made a one-size .ico four
 * times the size of a Windows stock icon carrying eight. Small sizes stay BMP
 * — they compress to almost nothing anyway, and BMP is the universally read
 * form for the 16-48px entries Explorer uses most.
 */
const ICO_PNG_MIN_SIZE = 128;

async function icoImage(canvas: HTMLCanvasElement, size: number): Promise<IcoImage> {
  const pixels = icoPixels(canvas, size);
  return size >= ICO_PNG_MIN_SIZE ? { size, pixels, png: await pngBytes(canvas) } : { size, pixels };
}

export async function exportPng(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<ExportBlob> {
  const { canvas, skipped } = await buildExportCanvas(doc, size, deps);
  return { blob: await canvasToBlob(canvas, "image/png"), skipped };
}

export async function exportSvg(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<ExportBlob> {
  // True vector SVG (EXP-14): compose the shared builders + real <text>, with
  // used fonts inlined so the file is self-contained.
  if (deps.prepare) await deps.prepare(doc);
  const fontFaceCss = await collectFontFaceCss(doc);
  const measure = makeMeasure();
  const bgImageSize = await measureBgImage(doc);
  const { svg, skipped } = buildExportSvg(doc, size, {
    getIconBody: deps.getIconBody,
    getPatternBody,
    measure,
    fontFaceCss,
    bgImageSize,
  });
  return { blob: new Blob([svg], { type: "image/svg+xml" }), skipped };
}

export async function exportIco(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<ExportBlob> {
  const { canvas, skipped } = await buildExportCanvas(doc, size, deps);
  const bytes = encodeIcoMulti([await icoImage(canvas, size)]);
  return { blob: new Blob([bytes], { type: "image/x-icon" }), skipped };
}

/**
 * Multi-resolution ICO: render each requested size once and pack them into a
 * single .ico so Windows can pick the crispest resolution per context (taskbar,
 * desktop, alt-tab). Sizes above 256 are dropped (the ICO cap, EXP-08).
 */
export async function exportIcoMulti(
  doc: FolderDocument,
  sizes: number[],
  deps: RenderDeps,
): Promise<ExportBlob> {
  const use = [...new Set(sizes.filter((s) => s <= 256))].sort((a, b) => a - b);
  const images: IcoImage[] = [];
  const skipped = new Set<string>();
  for (const size of use) {
    const { canvas, skipped: sk } = await buildExportCanvas(doc, size, deps);
    sk.forEach((s) => skipped.add(s));
    images.push(await icoImage(canvas, size));
  }
  return { blob: new Blob([encodeIcoMulti(images)], { type: "image/x-icon" }), skipped: [...skipped] };
}

/** Read a rendered canvas back as PNG bytes for .icns packing. */
async function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, "image/png");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Multi-resolution macOS .icns: render each requested size and pack one PNG per
 * size behind its OSType. Sizes without an .icns type are dropped.
 */
export async function exportIcns(
  doc: FolderDocument,
  sizes: number[],
  deps: RenderDeps,
): Promise<ExportBlob> {
  const use = [...new Set(sizes.filter(isIcnsSize))].sort((a, b) => a - b);
  const images: IcnsImage[] = [];
  const skipped = new Set<string>();
  for (const size of use) {
    const { canvas, skipped: sk } = await buildExportCanvas(doc, size, deps);
    sk.forEach((s) => skipped.add(s));
    images.push({ size, png: await pngBytes(canvas) });
  }
  return { blob: new Blob([encodeIcns(images)], { type: "image/icns" }), skipped: [...skipped] };
}

/**
 * Render every `size` once and emit each requested `format`, zipped. Mirrors the
 * legacy batch export (one canvas per size, reused across formats). `skipped`
 * layers are the same across sizes (same doc), so they're deduped.
 */
export async function batchExportZip(
  doc: FolderDocument,
  sizes: number[],
  formats: ExportFormat[],
  deps: RenderDeps,
): Promise<ExportBlob> {
  // Lazy-load JSZip so it ships as its own chunk, off the main bundle (PF-05).
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const sorted = [...sizes].sort((a, b) => a - b);
  const skipped = new Set<string>();
  // ICO / ICNS are each packed once as a single multi-resolution file.
  const icoImages: IcoImage[] = [];
  const icnsImages: IcnsImage[] = [];
  const wantIco = formats.includes("ico");
  const wantIcns = formats.includes("icns");
  // SVG is vector: measure + inlined fonts are computed once, shared across sizes.
  const wantSvg = formats.includes("svg");
  const svgDeps = wantSvg
    ? {
        getIconBody: deps.getIconBody,
        getPatternBody,
        measure: makeMeasure(),
        fontFaceCss: await collectFontFaceCss(doc),
        bgImageSize: await measureBgImage(doc),
      }
    : null;
  // ICO/ICNS are single multi-resolution containers, so they always carry their
  // own full ladder — the size checkboxes pick which PNG/SVG files land in the
  // zip, not how many resolutions a Windows/macOS icon is worth. Sizes only one
  // of the two needs still get rendered once and shared.
  const render = [
    ...new Set([
      ...sorted,
      ...(wantIco ? ICO_SIZES : []),
      ...(wantIcns ? ICNS_EXPORT_SIZES : []),
    ]),
  ].sort((a, b) => a - b);
  for (const size of render) {
    const result = await buildExportCanvas(doc, size, deps);
    result.skipped.forEach((s) => skipped.add(s));
    const canvas = result.canvas;
    if (sorted.includes(size)) {
      for (const fmt of formats) {
        if (fmt === "png") {
          zip.file(`folder-icon-${size}x${size}.png`, await canvasToBlob(canvas, "image/png"));
        } else if (fmt === "svg" && svgDeps) {
          const out = buildExportSvg(doc, size, svgDeps);
          out.skipped.forEach((s) => skipped.add(s));
          zip.file(`folder-icon-${size}x${size}.svg`, out.svg);
        }
      }
    }
    if (wantIco && ICO_SIZES.includes(size)) icoImages.push(await icoImage(canvas, size));
    if (wantIcns && ICNS_EXPORT_SIZES.includes(size) && isIcnsSize(size)) {
      icnsImages.push({ size, png: await pngBytes(canvas) });
    }
  }
  if (icoImages.length) zip.file("folder-icon.ico", encodeIcoMulti(icoImages));
  if (icnsImages.length) zip.file("folder-icon.icns", encodeIcns(icnsImages));
  return { blob: await zip.generateAsync({ type: "blob" }), skipped: [...skipped] };
}

/** Trigger a browser download of `blob` as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
