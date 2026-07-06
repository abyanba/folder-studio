/**
 * Save the current document to the gallery: render a 128px PNG thumbnail via
 * the export pipeline and persist it with the full document snapshot
 * (`fs_gallery`). Shared by the toolbar save button and anything else that
 * wants to snapshot the current design.
 */

import { buildExportCanvas } from "@/lib/export/renderCanvas";
import { prepareDocumentAssets } from "@/lib/export/exportPrep";
import { getIconBody } from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";

/** Returns whether the snapshot persisted (false on localStorage quota failure). */
export async function saveCurrentToGallery(): Promise<boolean> {
  const doc = useDocumentStore.getState().doc;
  const { canvas } = await buildExportCanvas(doc, 128, {
    getIconBody,
    prepare: prepareDocumentAssets,
  });
  return useGalleryStore.getState().addItem(canvas.toDataURL("image/png"), doc);
}
