/**
 * Gallery panel: save the current design (128px thumbnail + full document
 * snapshot → `fs_gallery`), and load/delete saved designs. Legacy snapshots
 * are migrated through `normalizeLegacySnapshot` on load, so designs saved by
 * the old single-file app keep working.
 */

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildExportCanvas } from "@/lib/export/renderCanvas";
import { getIconBody } from "@/lib/iconify";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";
import { useSelectionStore } from "@/store/selectionStore";
import { PanelHeader } from "./PanelHeader";

export function GalleryPanel() {
  const items = useGalleryStore((s) => s.items);
  const addItem = useGalleryStore((s) => s.addItem);
  const removeItem = useGalleryStore((s) => s.removeItem);
  const loadDocument = useDocumentStore((s) => s.loadDocument);
  const [saving, setSaving] = useState(false);

  const saveCurrent = async () => {
    setSaving(true);
    try {
      const doc = useDocumentStore.getState().doc;
      const canvas = await buildExportCanvas(doc, 128, { getIconBody });
      addItem(canvas.toDataURL("image/png"), doc);
    } finally {
      setSaving(false);
    }
  };

  const loadItem = (snap: unknown) => {
    loadDocument(normalizeLegacySnapshot(snap));
    useSelectionStore.getState().clear();
  };

  return (
    <div>
      <PanelHeader title="Gallery" />
      <div className="space-y-3 p-3">
        <Button
          size="sm"
          className="h-8 w-full text-xs"
          disabled={saving}
          onClick={saveCurrent}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save current design
        </Button>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No saved designs yet. Save the current folder to revisit it later.
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
