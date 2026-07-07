/**
 * Global editor keyboard shortcuts: undo/redo, delete, escape, duplicate,
 * copy/paste, and arrow-nudge. Ported from the legacy `onKey` (public/legacy.html
 * L701+). Ignores events while a text element is being edited or focus is in a
 * form field, so typing is never hijacked.
 */

import { useEffect } from "react";
import { createId } from "@/lib/id";
import type { FolderElement } from "@/types/element";
import {
  beginDocPreview,
  endDocPreview,
  isDocPreviewActive,
  useDocumentStore,
} from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { isInteractionActive } from "@/hooks/useInteraction";
import { commitShapePoints } from "@/hooks/useDrawTool";

const ARROW_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright"]);
/** A run of arrow nudges commits after this idle gap (or on key release). */
const NUDGE_IDLE_MS = 400;

/** Ephemeral copy/paste buffer (module-scoped; not persisted). */
let clipboard: FolderElement[] = [];
/** How many times the current clipboard payload has been pasted (cumulative offset, ST-09). */
let pasteCount = 0;

function isFormTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName);
}

/**
 * Interactive controls that handle arrow keys themselves (sortable drag
 * handles, sliders, tabs, menus) — arrow-nudge must not also fire on them.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest("button, a, [role='button'], [role='slider'], [role='tab'], [role='menuitem'], [role='option']");
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    // Arrow-nudge coalescing (ST-03): a held/hammered run of arrow keys is one
    // preview transaction → one undo entry, committed on idle or key release.
    let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
    let nudging = false;
    const commitNudge = () => {
      if (!nudging) return;
      nudging = false;
      if (nudgeTimer != null) {
        clearTimeout(nudgeTimer);
        nudgeTimer = null;
      }
      endDocPreview(true);
    };

    const onKey = (e: KeyboardEvent) => {
      // Escape leaves text editing by blurring the contentEditable, whose onBlur
      // commits the text (IN-03). Must run before the editing-guard early-return.
      if (e.key === "Escape" && useUiStore.getState().editingTextId) {
        e.preventDefault();
        const active = document.activeElement as HTMLElement | null;
        if (active?.blur) active.blur();
        else useUiStore.getState().setEditingTextId(null);
        return;
      }
      if (useUiStore.getState().editingTextId) return;
      if (isFormTarget(e.target)) return;
      // Another handler (Radix slider, dnd-kit keyboard drag, …) already
      // consumed this key — don't double-handle it.
      if (e.defaultPrevented) return;

      // `?` toggles the keyboard-shortcut cheat sheet.
      if (e.key === "?") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setHelpOpen(!ui.helpOpen);
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const store = useDocumentStore.getState();
      const temporal = useDocumentStore.temporal.getState();
      const sel = useSelectionStore.getState();

      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        // Never restore history mid-gesture/preview — it would corrupt the
        // "before" snapshot the transaction is holding (ST-02).
        if (isDocPreviewActive() || isInteractionActive()) return;
        temporal.undo();
        return;
      }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        if (isDocPreviewActive() || isInteractionActive()) return;
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
        // Mid-drag, Escape cancels the gesture (handled in useInteraction) — do
        // not also clear the selection here (IN-03).
        if (isInteractionActive()) return;
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
      if (mod && k === "a") {
        const ids = store.doc.elements
          .filter((el) => el.visible !== false && !el.locked)
          .map((el) => el.id);
        if (ids.length) {
          e.preventDefault();
          sel.setMany(ids);
        }
        return;
      }
      if (mod && k === "c") {
        if (sel.selectedIds.length) {
          clipboard = store.doc.elements
            .filter((el) => sel.selectedIds.includes(el.id))
            .map((el) => structuredClone(el));
          pasteCount = 0; // fresh payload → offset restarts
        }
        return;
      }
      if (mod && k === "v") {
        if (clipboard.length) {
          e.preventDefault();
          pasteCount += 1;
          const off = 12 * pasteCount; // stack successive pastes, not overlap (ST-09)
          const newIds: string[] = [];
          for (const el of clipboard) {
            const copy = { ...structuredClone(el), id: createId(), x: el.x + off, y: el.y + off };
            store.addElement(copy);
            newIds.push(copy.id);
          }
          sel.setMany(newIds);
        }
        return;
      }
      // Z-order on the primary selection: [ sends back one, ] brings forward one.
      if ((k === "[" || k === "]") && sel.selectedId) {
        e.preventDefault();
        if (k === "]") store.moveUp(sel.selectedId);
        else store.moveDown(sel.selectedId);
        return;
      }
      if (ARROW_KEYS.has(k) && sel.selectedIds.length && !isInteractiveTarget(e.target)) {
        e.preventDefault();
        if (!nudging) {
          nudging = true;
          beginDocPreview();
        }
        if (nudgeTimer != null) clearTimeout(nudgeTimer);
        nudgeTimer = setTimeout(commitNudge, NUDGE_IDLE_MS);

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

    // Releasing an arrow key ends the nudge run immediately (the idle timer is
    // the fallback for a held key that auto-repeats without interim keyups).
    const onKeyUp = (e: KeyboardEvent) => {
      if (nudging && ARROW_KEYS.has(e.key.toLowerCase())) commitNudge();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      commitNudge(); // flush any open nudge on unmount
    };
  }, []);
}
