/**
 * Blob exporters built on {@link buildExportCanvas}. Ported from
 * public/legacy.html `doExport` (L967-978) and `doBatchExport` (L947-966), with
 * JSZip now a bundled npm dependency instead of a CDN `import()`.
 *
 * Each function returns a Blob so callers (dev harness now, toolbar in Phase 5)
 * decide how to deliver it; {@link downloadBlob} is the browser save helper.
 */

import JSZip from "jszip";
import type { FolderDocument } from "@/types/document";
import { buildExportCanvas } from "./renderCanvas";
import type { RenderDeps } from "./renderCanvas";
import { encodeIco } from "./ico";

export type ExportFormat = "png" | "svg" | "ico";

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      type,
    );
  });
}

/** SVG that embeds the rendered PNG as an `<image>` (matches the legacy export). */
function svgWrapper(pngDataUrl: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image href="${pngDataUrl}" width="${size}" height="${size}"/></svg>`;
}

function icoBytes(canvas: HTMLCanvasElement, size: number): ArrayBuffer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for ICO export");
  const px = ctx.getImageData(0, 0, size, size).data;
  return encodeIco(px, size);
}

export async function exportPng(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<Blob> {
  const canvas = await buildExportCanvas(doc, size, deps);
  return canvasToBlob(canvas, "image/png");
}

export async function exportSvg(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<Blob> {
  const canvas = await buildExportCanvas(doc, size, deps);
  const svg = svgWrapper(canvas.toDataURL("image/png"), size);
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function exportIco(
  doc: FolderDocument,
  size: number,
  deps: RenderDeps,
): Promise<Blob> {
  const canvas = await buildExportCanvas(doc, size, deps);
  return new Blob([icoBytes(canvas, size)], { type: "image/x-icon" });
}

/**
 * Render every `size` once and emit each requested `format`, zipped. Mirrors the
 * legacy batch export (one canvas per size, reused across formats).
 */
export async function batchExportZip(
  doc: FolderDocument,
  sizes: number[],
  formats: ExportFormat[],
  deps: RenderDeps,
): Promise<Blob> {
  const zip = new JSZip();
  const sorted = [...sizes].sort((a, b) => a - b);
  for (const size of sorted) {
    const canvas = await buildExportCanvas(doc, size, deps);
    for (const fmt of formats) {
      const name = `folder-icon-${size}x${size}.${fmt}`;
      if (fmt === "png") {
        zip.file(name, await canvasToBlob(canvas, "image/png"));
      } else if (fmt === "svg") {
        zip.file(name, svgWrapper(canvas.toDataURL("image/png"), size));
      } else {
        zip.file(name, icoBytes(canvas, size));
      }
    }
  }
  return zip.generateAsync({ type: "blob" });
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
