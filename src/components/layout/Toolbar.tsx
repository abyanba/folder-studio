/**
 * Top toolbar: brand, undo/redo (backed by zundo via `useHistory`), a dev-only
 * "seed sample" button (to exercise the workspace before element-creation panels
 * exist), and the export dialog trigger. Shadcn redesign — functional parity
 * with the legacy toolbar, not a pixel port.
 */

import { Redo2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistory } from "@/store";
import { useDocumentStore } from "@/store/documentStore";
import { ExportDialog } from "@/components/export/ExportDialog";
import { buildSampleDocument } from "@/dev/sampleDocument";

export function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory();

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
      <ExportDialog />
    </header>
  );
}
