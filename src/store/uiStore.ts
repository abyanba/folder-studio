/**
 * Ephemeral UI state: which panel is open, in-progress editing/drag, context
 * menu. Not part of the undoable document.
 */

import { create } from "zustand";
import type { DragState } from "@/types/interaction";

export interface ContextMenuState {
  x: number;
  y: number;
  elId: string | null;
}

export interface UiStore {
  activePanel: string | null;
  editingTextId: string | null;
  editingLayerName: string | null;
  contextMenu: ContextMenuState | null;
  drag: DragState | null;

  setActivePanel: (panel: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setEditingLayerName: (id: string | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setDrag: (drag: DragState | null) => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  activePanel: "shape",
  editingTextId: null,
  editingLayerName: null,
  contextMenu: null,
  drag: null,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setEditingLayerName: (id) => set({ editingLayerName: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setDrag: (drag) => set({ drag }),
}));
