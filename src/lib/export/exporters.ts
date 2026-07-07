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
import { encodeIco, encodeIcoMulti } from "./ico";
import type { IcoImage } from "./ico";
import { buildExportSvg } from "./svgExport";
import type { MeasureText } from "./textLayout";
import { collectFontFaceCss } from "./svgFonts";

export type ExportFormat = "png" | "svg" | "ico";

/** Standard multi-resolution set packed into an .ico (all ≤256, the ICO cap). */
export const ICO_SIZES = [16, 32, 48, 64, 128, 256];

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

/** Read a rendered canvas back as raw RGBA pixels for ICO packing. */
function icoPixels(canvas: HTMLCanvasElement, size: number): Uint8ClampedArray {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for ICO export");
  return ctx.getImageData(0, 0, size, size).data;
}

function icoBytes(canvas: HTMLCanvasElement, size: number): ArrayBuffer {
  return encodeIco(icoPixels(canvas, size), size);
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
  const { svg, skipped } = buildExportSvg(doc, size, {
    getIconBody: deps.getIconBody,
    measure,
    fontFaceCss,
  });
  return { blob: new Blob([svg], { type: "image/svg+xml" }), skipped };
}

export async function exportIco(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<ExportBlob> {
  const { canvas, skipped } = await buildExportCanvas(doc, size, deps);
  return { blob: new Blob([icoBytes(canvas, size)], { type: "image/x-icon" }), skipped };
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
    images.push({ size, pixels: icoPixels(canvas, size) });
  }
  return { blob: new Blob([encodeIcoMulti(images)], { type: "image/x-icon" }), skipped: [...skipped] };
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
  // ICO is packed once as a single multi-resolution file (not one per size).
  const icoImages: IcoImage[] = [];
  const wantIco = formats.includes("ico");
  // SVG is vector: measure + inlined fonts are computed once, shared across sizes.
  const wantSvg = formats.includes("svg");
  const svgDeps = wantSvg
    ? { getIconBody: deps.getIconBody, measure: makeMeasure(), fontFaceCss: await collectFontFaceCss(doc) }
    : null;
  for (const size of sorted) {
    const result = await buildExportCanvas(doc, size, deps);
    result.skipped.forEach((s) => skipped.add(s));
    const canvas = result.canvas;
    for (const fmt of formats) {
      if (fmt === "png") {
        zip.file(`folder-icon-${size}x${size}.png`, await canvasToBlob(canvas, "image/png"));
      } else if (fmt === "svg" && svgDeps) {
        const out = buildExportSvg(doc, size, svgDeps);
        out.skipped.forEach((s) => skipped.add(s));
        zip.file(`folder-icon-${size}x${size}.svg`, out.svg);
      }
    }
    if (wantIco && size <= 256) icoImages.push({ size, pixels: icoPixels(canvas, size) });
  }
  if (icoImages.length) zip.file("folder-icon.ico", encodeIcoMulti(icoImages));
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
