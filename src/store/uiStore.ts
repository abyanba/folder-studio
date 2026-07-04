/**
 * Ephemeral UI state: which panel is open, in-progress editing/drag, context
 * menu. Not part of the undoable document.
 */

import { create } from "zustand";
import type { DragState } from "@/types/interaction";
import type { BlendMode } from "@/types/element";

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
  /** Blend mode being hovered in the image panel — live-previewed on the selected image. */
  blendPreview: BlendMode | null;
  /** Logos panel: mono (tinted simple-icons) vs full-color artwork. */
  logoMode: "mono" | "color";
  /** Tint for mono logos (legacy `logoColor`). */
  logoColor: string;

  setActivePanel: (panel: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setEditingLayerName: (id: string | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setDrag: (drag: DragState | null) => void;
  setBlendPreview: (mode: BlendMode | null) => void;
  setLogoMode: (mode: "mono" | "color") => void;
  setLogoColor: (color: string) => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  activePanel: "shape",
  editingTextId: null,
  editingLayerName: null,
  contextMenu: null,
  drag: null,
  blendPreview: null,
  logoMode: "mono",
  logoColor: "#ffffff",

  setActivePanel: (panel) => set({ activePanel: panel }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setEditingLayerName: (id) => set({ editingLayerName: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setDrag: (drag) => set({ drag }),
  setBlendPreview: (mode) => set({ blendPreview: mode }),
  setLogoMode: (mode) => set({ logoMode: mode }),
  setLogoColor: (color) => set({ logoColor: color }),
}));
