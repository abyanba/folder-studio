/**
 * Pre-export asset readiness (the `RenderDeps.prepare` hook). Combines icon-body
 * hydration (EXP-13) and font loading (EXP-07) so `buildExportCanvas` can await
 * a single call before rasterizing.
 *
 * Browser-only (`document.fonts`) — excluded from jsdom coverage like the rest
 * of the canvas pipeline; verified via the dev harness.
 */

import type { FolderDocument } from "@/types/document";
import type { TextElement } from "@/types/element";
import { hydrateDocumentIcons } from "@/lib/iconHydration";
import { loadPatternBodies } from "@/lib/patternBodies";

/** Load every font family used by visible text so `fillText` never falls back. */
async function ensureFonts(doc: FolderDocument): Promise<void> {
  const fonts = document.fonts;
  if (!fonts?.load) return;
  const texts = doc.elements.filter(
    (e): e is TextElement => e.type === "text" && e.visible !== false,
  );
  await Promise.all(
    texts.map((t) => {
      const spec = `${t.fontStyle === "italic" ? "italic " : ""}${t.fontWeight} 16px "${t.fontFamily}"`;
      return fonts.load(spec, t.text).catch(() => undefined);
    }),
  );
  try {
    await fonts.ready;
  } catch {
    // Font readiness is best-effort; never block export on it.
  }
}

export async function prepareDocumentAssets(doc: FolderDocument): Promise<void> {
  await Promise.all([
    hydrateDocumentIcons(doc),
    ensureFonts(doc),
    // The pattern bodies are a lazy chunk; without this an export started
    // before the editor had ever shown a pattern would rasterize without it.
    doc.pattern.id !== "none" ? loadPatternBodies() : Promise.resolve(),
  ]);
}
