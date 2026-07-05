/**
 * Gallery panel: load/delete saved designs (`fs_gallery`). Saving lives on
 * the toolbar's save button (`saveCurrentToGallery`). Legacy snapshots are
 * migrated through `normalizeLegacySnapshot` on load, so designs saved by
 * the old single-file app keep working.
 */

import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";
import { useSelectionStore } from "@/store/selectionStore";
import { PanelHeader } from "./PanelHeader";

export function GalleryPanel() {
  const items = useGalleryStore((s) => s.items);
  const removeItem = useGalleryStore((s) => s.removeItem);
  const loadDocument = useDocumentStore((s) => s.loadDocument);

  const loadItem = (snap: unknown) => {
    loadDocument(normalizeLegacySnapshot(snap));
    useSelectionStore.getState().clear();
  };

  return (
    <div>
      <PanelHeader title="Gallery" />
      <div className="space-y-3 p-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No saved designs yet. Use the save button in the toolbar to keep
            the current folder here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  className="w-full overflow-hidden rounded-lg border bg-muted/30 p-2 transition-colors hover:border-primary/60"
                  title={`Load design from ${item.date}`}
                  onClick={() => loadItem(item.snap)}
                >
                  <img src={item.thumb} alt="" className="aspect-square w-full object-contain" />
                  <span className="mt-1 block text-[9px] text-muted-foreground">{item.date}</span>
                </button>
                <button
                  type="button"
                  aria-label="Delete saved design"
                  className="absolute -top-1.5 -right-1.5 z-10 hidden size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white group-hover:flex"
                  onClick={() => removeItem(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
