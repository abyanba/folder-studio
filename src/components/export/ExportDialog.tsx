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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDocumentStore } from "@/store/documentStore";
import { notify } from "@/store/toastStore";
import { getIconBody } from "@/lib/iconify";
import type { RenderDeps } from "@/lib/export/renderCanvas";
import { prepareDocumentAssets } from "@/lib/export/exportPrep";
import {
  ICNS_EXPORT_SIZES,
  ICO_SIZES,
  batchExportZip,
  downloadBlob,
  exportIcns,
  exportIcoMulti,
  exportPng,
  exportSvg,
} from "@/lib/export/exporters";
import type { ExportBlob, ExportFormat } from "@/lib/export/exporters";

const SIZES = ["64", "128", "256", "512", "1024"];
const FORMATS: ExportFormat[] = ["png", "svg", "ico", "icns"];
const BATCH_SIZES = [64, 128, 256, 512];
/** ICO is a Windows format capped at 256px; larger sizes make invalid files (EXP-08). */
const ICO_MAX = 256;
/** ICO and ICNS are packed as one multi-resolution file (size picker n/a). */
const isMultiRes = (f: ExportFormat) => f === "ico" || f === "icns";

/** Strip path separators / illegal filename chars; fall back to the default. */
function sanitizeName(raw: string): string {
  const clean = raw.replace(/[/\\?%*:|"<>]/g, "").trim();
  return clean || "folder-icon";
}

const deps: RenderDeps = { getIconBody, prepare: prepareDocumentAssets };

export function ExportDialog() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [size, setSize] = useState("256");
  const [format, setFormat] = useState<ExportFormat>("png");
  // Batch defaults to the one size that matters for an icon (256, also the ICO
  // ceiling) in every format, since the usual reason to batch is wanting the
  // same icon for each platform.
  const [batchSizes, setBatchSizes] = useState<string[]>(["256"]);
  const [batchFormats, setBatchFormats] = useState<string[]>([...FORMATS]);
  const [name, setName] = useState("folder-icon");
  const [busy, setBusy] = useState(false);

  // ICO is capped at 256px (EXP-08): restrict single-mode sizes and, in batch,
  // drop/disable any size above 256 while ICO is one of the chosen formats.
  const sizeOptions = format === "ico" ? SIZES.filter((s) => Number(s) <= ICO_MAX) : SIZES;
  const icoInBatch = batchFormats.includes("ico");

  function selectFormat(v: ExportFormat) {
    setFormat(v);
    if (v === "ico" && Number(size) > ICO_MAX) setSize(String(ICO_MAX));
  }

  function selectBatchFormats(v: string[]) {
    if (!v.length) return; // keep at least one format
    setBatchFormats(v);
    if (v.includes("ico")) setBatchSizes((prev) => prev.filter((s) => Number(s) <= ICO_MAX));
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      notify.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  /** Download the blob and report success — or which layers were dropped (EXP-13). */
  function deliver(result: ExportBlob, filename: string) {
    downloadBlob(result.blob, filename);
    const n = result.skipped.length;
    if (n > 0) {
      notify.info(
        `Exported with ${n} missing layer${n > 1 ? "s" : ""}`,
        result.skipped.join(", "),
      );
    } else {
      notify.success(`Exported ${filename}`);
    }
  }

  function exportSingle() {
    return run(async () => {
      const doc = useDocumentStore.getState().doc;
      const base = sanitizeName(name);
      // ICO is always packed as one multi-resolution file (Windows picks the
      // sharpest size per context), so the size picker doesn't apply to it.
      if (format === "ico") {
        deliver(await exportIcoMulti(doc, ICO_SIZES, deps), `${base}.ico`);
        return;
      }
      if (format === "icns") {
        deliver(await exportIcns(doc, ICNS_EXPORT_SIZES, deps), `${base}.icns`);
        return;
      }
      const sz = Number(size);
      const result =
        format === "png" ? await exportPng(doc, sz, deps) : await exportSvg(doc, sz, deps);
      deliver(result, `${base}-${sz}.${format}`);
    });
  }

  function exportBatch() {
    return run(async () => {
      const doc = useDocumentStore.getState().doc;
      const result = await batchExportZip(
        doc,
        batchSizes.map(Number),
        batchFormats as ExportFormat[],
        deps,
      );
      deliver(result, `${sanitizeName(name)}.zip`);
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

        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">File name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="folder-icon" />
        </label>

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
              {isMultiRes(format) ? (
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                  Multi-resolution
                </div>
              ) : (
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}×{s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Format</span>
              <Select value={format} onValueChange={(v) => selectFormat(v as ExportFormat)}>
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
              {format === "ico" && (
                <span className="text-[11px] text-muted-foreground">
                  Packs {ICO_SIZES.join(", ")} px into one .ico
                </span>
              )}
              {format === "icns" && (
                <span className="text-[11px] text-muted-foreground">
                  Packs {ICNS_EXPORT_SIZES.join(", ")} px into one macOS .icns
                </span>
              )}
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
                  <ToggleGroupItem
                    key={s}
                    value={String(s)}
                    disabled={icoInBatch && s > ICO_MAX}
                    className="flex-1 text-xs"
                  >
                    {s}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {icoInBatch && (
                <span className="text-[11px] text-muted-foreground">ICO supports up to 256 px</span>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Formats</span>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="w-full"
                value={batchFormats}
                onValueChange={selectBatchFormats}
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
