/**
 * Export dialog: pick a size + format and download, or export a batch ZIP.
 * Wires the Phase-3 `exporters` + `downloadBlob` to the toolbar. The full
 * batch/format UI is refined in Phase 5; icon bodies use the Phase-4 stub until
 * the real Iconify cache lands in Phase 6.
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentStore } from "@/store/documentStore";
import { getIconBodyStub } from "@/lib/iconBodyStub";
import type { RenderDeps } from "@/lib/export/renderCanvas";
import {
  batchExportZip,
  downloadBlob,
  exportIco,
  exportPng,
  exportSvg,
} from "@/lib/export/exporters";
import type { ExportFormat } from "@/lib/export/exporters";

const SIZES = ["64", "128", "256", "512", "1024"];
const FORMATS: ExportFormat[] = ["png", "svg", "ico"];
const BATCH_SIZES = [64, 128, 256, 512];

const deps: RenderDeps = { getIconBody: getIconBodyStub };

export function ExportDialog() {
  const [size, setSize] = useState("256");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  function exportSingle() {
    return run(async () => {
      const doc = useDocumentStore.getState().doc;
      const sz = Number(size);
      const blob =
        format === "png"
          ? await exportPng(doc, sz, deps)
          : format === "svg"
            ? await exportSvg(doc, sz, deps)
            : await exportIco(doc, sz, deps);
      downloadBlob(blob, `folder-icon-${sz}.${format}`);
    });
  }

  function exportBatch() {
    return run(async () => {
      const doc = useDocumentStore.getState().doc;
      const blob = await batchExportZip(doc, BATCH_SIZES, FORMATS, deps);
      downloadBlob(blob, "folder-icons.zip");
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Download className="size-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export icon</DialogTitle>
          <DialogDescription>
            Download a single size, or a ZIP of every size in all formats.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Size</span>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}×{s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Format</span>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={exportBatch} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Export .zip
          </Button>
          <Button onClick={exportSingle} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
