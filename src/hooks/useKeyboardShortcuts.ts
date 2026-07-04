/**
 * Global editor keyboard shortcuts: undo/redo, delete, escape, duplicate,
 * copy/paste, and arrow-nudge. Ported from the legacy `onKey` (docs/index.html
 * L701+). Ignores events while a text element is being edited or focus is in a
 * form field, so typing is never hijacked.
 */

import { useEffect } from "react";
import { createId } from "@/lib/id";
import type { FolderElement } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { commitShapePoints } from "@/hooks/useDrawTool";

/** Ephemeral copy/paste buffer (module-scoped; not persisted). */
let clipboard: FolderElement[] = [];

function isFormTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName);
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUiStore.getState().editingTextId) return;
      if (isFormTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const store = useDocumentStore.getState();
      const temporal = useDocumentStore.temporal.getState();
      const sel = useSelectionStore.getState();

      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        temporal.undo();
        return;
      }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        temporal.redo();
        return;
      }
      if (k === "delete" || k === "backspace") {
        if (sel.selectedIds.length) {
          e.preventDefault();
          store.removeElements(sel.selectedIds);
          sel.clear();
        }
        return;
      }
      if (k === "escape") {
        const ui = useUiStore.getState();
        if (ui.activeTool === "draw") {
          // First Escape discards in-progress strokes/anchors; a second exits.
          if (ui.currentDraw || ui.shapePoints.length || ui.shapeDragPoint) {
            ui.resetDrawProgress();
          } else {
            ui.setActiveTool(null);
          }
          return;
        }
        sel.clear();
        ui.setEditingTextId(null);
        return;
      }
      if (k === "enter" && useUiStore.getState().activeTool === "draw") {
        const ui = useUiStore.getState();
        if (ui.shapePoints.length >= 2) {
          e.preventDefault();
          commitShapePoints();
        }
        return;
      }
      if (mod && k === "d") {
        if (sel.selectedId) {
          e.preventDefault();
          const newId = store.duplicateElement(sel.selectedId);
          if (newId) sel.select(newId);
        }
        return;
      }
      if (mod && k === "c") {
        if (sel.selectedIds.length) {
          clipboard = store.doc.elements
            .filter((el) => sel.selectedIds.includes(el.id))
            .map((el) => structuredClone(el));
        }
        return;
      }
      if (mod && k === "v") {
        if (clipboard.length) {
          e.preventDefault();
          const newIds: string[] = [];
          for (const el of clipboard) {
            const copy = { ...structuredClone(el), id: createId(), x: el.x + 12, y: el.y + 12 };
            store.addElement(copy);
            newIds.push(copy.id);
          }
          sel.setMany(newIds);
        }
        return;
      }
      if (
        (k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright") &&
        sel.selectedIds.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
        const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
        const patches: Record<string, Partial<FolderElement>> = {};
        for (const el of store.doc.elements) {
          if (sel.selectedIds.includes(el.id)) patches[el.id] = { x: el.x + dx, y: el.y + dy };
        }
        store.updateElements(patches);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
