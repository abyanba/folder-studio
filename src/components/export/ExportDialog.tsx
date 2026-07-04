/**
 * Export dialog with legacy batch parity: a Single tab (one size + format)
 * and a Batch tab (multi-select sizes and formats → one ZIP). Wires the
 * Phase-3 exporters + downloadBlob; icon bodies come from the live Iconify
 * cache.
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDocumentStore } from "@/store/documentStore";
import { getIconBody } from "@/lib/iconify";
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

const deps: RenderDeps = { getIconBody };

export function ExportDialog() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [size, setSize] = useState("256");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [batchSizes, setBatchSizes] = useState<string[]>(BATCH_SIZES.map(String));
  const [batchFormats, setBatchFormats] = useState<string[]>(["png"]);
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
      const blob = await batchExportZip(
        doc,
        batchSizes.map(Number),
        batchFormats as ExportFormat[],
        deps,
      );
      downloadBlob(blob, "folder-icons.zip");
    });
  }

  const batchReady = batchSizes.length > 0 && batchFormats.length > 0;

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
            Download one file, or a ZIP with every selected size and format.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "batch")}>
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">
              Single
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1">
              Batch (.zip)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "single" ? (
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
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Sizes</span>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="w-full"
                value={batchSizes}
                onValueChange={setBatchSizes}
              >
                {BATCH_SIZES.map((s) => (
                  <ToggleGroupItem key={s} value={String(s)} className="flex-1 text-xs">
                    {s}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Formats</span>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="w-full"
                value={batchFormats}
                onValueChange={(v) => {
                  if (v.length) setBatchFormats(v);
                }}
              >
                {FORMATS.map((f) => (
                  <ToggleGroupItem key={f} value={f} className="flex-1 text-xs uppercase">
                    {f}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === "single" ? (
            <Button onClick={exportSingle} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Download
            </Button>
          ) : (
            <Button onClick={exportBatch} disabled={busy || !batchReady}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Export .zip
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
