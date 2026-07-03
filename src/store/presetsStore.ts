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

  removeDefaultPreset: (hex: string) => void;
  saveCustomPreset: (hex: string) => void;
  removeCustomPreset: (hex: string) => void;
  saveGradient: (stops: GradientStop[]) => void;
  removeSavedGradient: (id: number) => void;
  hideGradientPreset: (index: number) => void;
}

export const usePresetsStore = create<PresetsStore>()((set, get) => ({
  defaultPresets: load(KEYS.defaultPresets, [...DEFAULT_PRESETS]),
  customPresets: load(KEYS.customPresets, []),
  savedGradients: normalizeSavedGradients(load(KEYS.savedGradients, [])),
  hiddenGradPresets: load(KEYS.hiddenGradPresets, []),

  removeDefaultPreset: (hex) => {
    const defaultPresets = get().defaultPresets.filter((p) => p !== hex);
    set({ defaultPresets });
    save(KEYS.defaultPresets, defaultPresets);
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
    const customPresets = get().customPresets.filter((p) => p !== hex);
    set({ customPresets });
    save(KEYS.customPresets, customPresets);
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
    const savedGradients = get().savedGradients.filter((g) => g.id !== id);
    set({ savedGradients });
    save(KEYS.savedGradients, savedGradients);
  },

  hideGradientPreset: (index) => {
    if (get().hiddenGradPresets.includes(index)) return;
    const hiddenGradPresets = [...get().hiddenGradPresets, index];
    set({ hiddenGradPresets });
    save(KEYS.hiddenGradPresets, hiddenGradPresets);
  },
}));
