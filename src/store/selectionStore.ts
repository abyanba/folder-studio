/**
 * Selection state (single + multi). Ephemeral — deliberately NOT part of the
 * undoable document, so undo/redo never changes what's selected.
 */

import { create } from "zustand";

export interface SelectionStore {
  selectedId: string | null;
  selectedIds: string[];

  /** Select a single element (or clear when passed null). */
  select: (id: string | null) => void;
  /** Ctrl/Cmd-click: add/remove `id` from the multi-selection. */
  toggle: (id: string) => void;
  /** Replace the whole selection (e.g. after a marquee); focuses the last id. */
  setMany: (ids: string[]) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionStore>()((set) => ({
  selectedId: null,
  selectedIds: [],

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  toggle: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const selectedIds = has
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id];
      return {
        selectedIds,
        selectedId: selectedIds[selectedIds.length - 1] ?? null,
      };
    }),

  setMany: (ids) =>
    set({ selectedIds: ids, selectedId: ids[ids.length - 1] ?? null }),

  clear: () => set({ selectedId: null, selectedIds: [] }),
}));
