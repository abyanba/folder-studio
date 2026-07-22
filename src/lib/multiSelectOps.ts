/**
 * Group-aware element actions shared by the layers panel rows and the canvas
 * right-click menu. When the clicked element is part of a multi-selection, the
 * action applies to the whole selection (Figma-style); otherwise just to it.
 * Toggles set every affected element to one shared new state so the group can't
 * desync (all locked/hidden together, driven off the clicked element).
 */

import type { FolderElement } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

/** The whole multi-selection if `id` belongs to it, else just `[id]`. */
export function affectedIds(id: string): string[] {
  const { selectedIds } = useSelectionStore.getState();
  return selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id];
}

function applyToAll(id: string, patch: Partial<FolderElement>): void {
  const patches: Record<string, Partial<FolderElement>> = {};
  for (const aid of affectedIds(id)) patches[aid] = patch;
  useDocumentStore.getState().updateElements(patches);
}

export function toggleLockFor(id: string): void {
  const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id);
  if (el) applyToAll(id, { locked: !el.locked });
}

export function toggleVisibleFor(id: string): void {
  const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id);
  if (el) applyToAll(id, { visible: el.visible === false });
}

export function deleteFor(id: string): void {
  useDocumentStore.getState().removeElements(affectedIds(id));
  useSelectionStore.getState().clear();
}

export function duplicateFor(id: string): void {
  const newIds = useDocumentStore.getState().duplicateElements(affectedIds(id));
  if (newIds.length) useSelectionStore.getState().setMany(newIds);
}

export function moveGroupFor(
  id: string,
  dir: "up" | "down" | "front" | "back",
): void {
  useDocumentStore.getState().moveGroup(affectedIds(id), dir);
}
