/**
 * Color-preset persistence: custom swatches, removable default swatches, saved
 * gradients, and hidden built-in gradient presets.
 *
 * Persists to the SAME localStorage keys and JSON shapes as the legacy app
 * (`fs_presets`, `fs_default_presets`, `fs_saved_gradients`,
 * `fs_hidden_grad_presets`) so existing users' saved data keeps working.
 * Not undoable — preset edits are settings, not document changes.
 */

import { create } from "zustand";
import type { GradientStop } from "@/types/gradient";
import { DEFAULT_PRESETS } from "@/lib/constants";

export interface SavedGradient {
  /** Legacy identity: `Date.now()` at save time. */
  id: number;
  stops: GradientStop[];
}

const KEYS = {
  customPresets: "fs_presets",
  defaultPresets: "fs_default_presets",
  savedGradients: "fs_saved_gradients",
  hiddenGradPresets: "fs_hidden_grad_presets",
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/privacy-mode failures are non-fatal; state still updates in-memory.
  }
}

/** Legacy saved-gradient stops may carry numeric ids; normalize to strings. */
function normalizeSavedGradients(saved: SavedGradient[]): SavedGradient[] {
  return saved.map((g) => ({
    id: g.id,
    stops: (g.stops ?? []).map((s) => ({ ...s, id: String(s.id) })),
  }));
}

export interface PresetsStore {
  /** Built-in swatches still visible (user can remove them). */
  defaultPresets: string[];
  /** User-saved solid swatches, newest first, max 12. */
  customPresets: string[];
  /** User-saved gradients (stops only, like legacy), newest first, max 12. */
  savedGradients: SavedGradient[];
  /** Indices into GRADIENT_PRESETS the user has hidden. */
  hiddenGradPresets: number[];

  /**
   * Removals return the function that puts the swatch back (order included),
   * so the caller can hand it straight to an Undo toast. Cheaper than four
   * bespoke restore actions, and each one is exact by construction: it just
   * reinstates the array it replaced.
   */
  removeDefaultPreset: (hex: string) => UndoRemoval;
  saveCustomPreset: (hex: string) => void;
  removeCustomPreset: (hex: string) => UndoRemoval;
  saveGradient: (stops: GradientStop[]) => void;
  removeSavedGradient: (id: number) => UndoRemoval;
  hideGradientPreset: (index: number) => UndoRemoval;
  /** Unhide every built-in gradient preset (the way back from an old deletion). */
  restoreGradientPresets: () => void;
}

export type UndoRemoval = () => void;

export const usePresetsStore = create<PresetsStore>()((set, get) => ({
  defaultPresets: load(KEYS.defaultPresets, [...DEFAULT_PRESETS]),
  customPresets: load(KEYS.customPresets, []),
  savedGradients: normalizeSavedGradients(load(KEYS.savedGradients, [])),
  hiddenGradPresets: load(KEYS.hiddenGradPresets, []),

  removeDefaultPreset: (hex) => {
    const before = get().defaultPresets;
    const defaultPresets = before.filter((p) => p !== hex);
    set({ defaultPresets });
    save(KEYS.defaultPresets, defaultPresets);
    return () => {
      set({ defaultPresets: before });
      save(KEYS.defaultPresets, before);
    };
  },

  saveCustomPreset: (hex) => {
    const customPresets = [
      hex,
      ...get().customPresets.filter((p) => p !== hex),
    ].slice(0, 12);
    set({ customPresets });
    save(KEYS.customPresets, customPresets);
  },

  removeCustomPreset: (hex) => {
    const before = get().customPresets;
    const customPresets = before.filter((p) => p !== hex);
    set({ customPresets });
    save(KEYS.customPresets, customPresets);
    return () => {
      set({ customPresets: before });
      save(KEYS.customPresets, before);
    };
  },

  saveGradient: (stops) => {
    // Legacy used bare Date.now(); bump past collisions so ids stay unique.
    const existing = new Set(get().savedGradients.map((g) => g.id));
    let id = Date.now();
    while (existing.has(id)) id += 1;
    const savedGradients = [
      { id, stops: stops.map((s) => ({ ...s })) },
      ...get().savedGradients,
    ].slice(0, 12);
    set({ savedGradients });
    save(KEYS.savedGradients, savedGradients);
  },

  removeSavedGradient: (id) => {
    const before = get().savedGradients;
    const savedGradients = before.filter((g) => g.id !== id);
    set({ savedGradients });
    save(KEYS.savedGradients, savedGradients);
    return () => {
      set({ savedGradients: before });
      save(KEYS.savedGradients, before);
    };
  },

  hideGradientPreset: (index) => {
    const before = get().hiddenGradPresets;
    if (before.includes(index)) return () => {};
    const hiddenGradPresets = [...before, index];
    set({ hiddenGradPresets });
    save(KEYS.hiddenGradPresets, hiddenGradPresets);
    return () => {
      set({ hiddenGradPresets: before });
      save(KEYS.hiddenGradPresets, before);
    };
  },

  restoreGradientPresets: () => {
    set({ hiddenGradPresets: [] });
    save(KEYS.hiddenGradPresets, []);
  },
}));
