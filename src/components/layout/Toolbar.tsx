/**
 * Top toolbar: brand, undo/redo (backed by zundo via `useHistory`), canvas
 * light/dark preview toggle, clip-to-folder toggle, save-to-gallery, a
 * dev-only "seed sample" button, and the export dialog trigger. Shadcn
 * redesign — functional parity with the legacy toolbar, not a pixel port.
 */

import { useRef, useState } from "react";
import { Crop, FileJson, FolderOpen, HelpCircle, Loader2, Moon, Redo2, Save, Sparkles, Sun, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistory } from "@/store";
import { useDocumentStore } from "@/store/documentStore";
import { useUiStore } from "@/store/uiStore";
import { saveCurrentToGallery } from "@/lib/saveToGallery";
import { openProjectFile, saveProjectFile } from "@/lib/projectActions";
import { notify } from "@/store/toastStore";
import { ExportDialog } from "@/components/export/ExportDialog";
import { buildSampleDocument } from "@/dev/sampleDocument";

export function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory();
  const clipToFolder = useDocumentStore((s) => s.doc.clipToFolder);
  const canvasLight = useUiStore((s) => s.canvasLight);
  const setCanvasLight = useUiStore((s) => s.setCanvasLight);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void openProjectFile(file);
    e.target.value = ""; // allow re-opening the same file
  };

  const saveToGallery = async () => {
    setSaving(true);
    try {
      const persisted = await saveCurrentToGallery();
      if (persisted) {
        notify.success("Saved to gallery");
      } else {
        notify.error(
          "Couldn't save — storage full",
          "Delete old gallery items or use smaller images",
        );
      }
    } catch (err) {
      notify.error("Couldn't save to gallery", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-4">
      <span className="font-semibold tracking-tight">Folder Studio</span>
      <Separator orientation="vertical" className="mx-2 !h-6" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => undo()} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => redo()} aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {import.meta.env.DEV && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => useDocumentStore.getState().loadDocument(buildSampleDocument())}
        >
          <Sparkles className="size-4" />
          Seed sample
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={canvasLight ? "Dark canvas" : "Light canvas"}
            aria-pressed={canvasLight}
            onClick={() => setCanvasLight(!canvasLight)}
          >
            {canvasLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{canvasLight ? "Dark canvas" : "Light canvas"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={clipToFolder ? "secondary" : "ghost"}
            size="icon"
            aria-label="Clip to folder"
            aria-pressed={clipToFolder}
            onClick={() => useDocumentStore.getState().setClipToFolder(!clipToFolder)}
          >
            <Crop className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{clipToFolder ? "Clipping: on" : "Clipping: off"}</TooltipContent>
      </Tooltip>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onOpenFile}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open project file"
            onClick={() => fileInput.current?.click()}
          >
            <FolderOpen className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open project (.json)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Save project file" onClick={saveProjectFile}>
            <FileJson className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save project (.json)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Save to gallery"
            disabled={saving}
            onClick={saveToGallery}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save to gallery</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Keyboard shortcuts"
            onClick={() => useUiStore.getState().setHelpOpen(true)}
          >
            <HelpCircle className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 !h-6" />
      <ExportDialog />
    </header>
  );
}
