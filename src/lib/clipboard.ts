/**
 * Shared editor clipboard + bulk-selection actions, used by both the keyboard
 * shortcuts (Ctrl+C/V/A) and the canvas-background context menu (AR-10). The
 * buffer is module-scoped and ephemeral — never persisted. Successive pastes
 * stack with a cumulative offset so copies don't pile up on one spot (ST-09).
 */

import { createId } from "@/lib/id";
import type { FolderElement } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

let clipboard: FolderElement[] = [];
/** How many times the current payload has been pasted (drives the offset). */
let pasteCount = 0;

export function hasClipboard(): boolean {
  return clipboard.length > 0;
}

/** Copy the current selection into the buffer; a fresh payload restarts the offset. */
export function copySelection(): void {
  const sel = useSelectionStore.getState();
  if (!sel.selectedIds.length) return;
  clipboard = useDocumentStore
    .getState()
    .doc.elements.filter((el) => sel.selectedIds.includes(el.id))
    .map((el) => structuredClone(el));
  pasteCount = 0;
}

/** Paste the buffer with a cumulative +12 offset, selecting the new copies. */
export function pasteClipboard(): void {
  if (!clipboard.length) return;
  pasteCount += 1;
  const off = 12 * pasteCount;
  const store = useDocumentStore.getState();
  const newIds: string[] = [];
  for (const el of clipboard) {
    const copy = { ...structuredClone(el), id: createId(), x: el.x + off, y: el.y + off };
    store.addElement(copy);
    newIds.push(copy.id);
  }
  useSelectionStore.getState().setMany(newIds);
}

/** Select every visible, unlocked element. */
export function selectAll(): void {
  const ids = useDocumentStore
    .getState()
    .doc.elements.filter((el) => el.visible !== false && !el.locked)
    .map((el) => el.id);
  if (ids.length) useSelectionStore.getState().setMany(ids);
}

/** Test-only: reset the module buffer between cases. */
export function __resetClipboardForTests(): void {
  clipboard = [];
  pasteCount = 0;
}
