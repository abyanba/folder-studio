/**
 * Store barrel + convenience hooks.
 */

import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useDocumentStore } from "./documentStore";

export { useDocumentStore } from "./documentStore";
export type { DocumentStore, AlignDirection, FlipAxis } from "./documentStore";
export { useSelectionStore } from "./selectionStore";
export type { SelectionStore } from "./selectionStore";
export { useUiStore } from "./uiStore";
export type { UiStore, ContextMenuState } from "./uiStore";

export interface HistoryControls {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Subscribe to undo/redo controls backed by zundo's temporal store.
 * `canUndo`/`canRedo` update as history changes.
 */
export function useHistory(): HistoryControls {
  return useStore(
    useDocumentStore.temporal,
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      clear: s.clear,
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    })),
  );
}
