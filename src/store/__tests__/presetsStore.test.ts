/**
 * Presets persistence: legacy `fs_*` JSON shapes round-trip, caps, and
 * hide/remove behavior. The store module is re-imported per test so its
 * initial state re-reads the fixture we place in localStorage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESETS } from "@/lib/constants";

async function freshStore() {
  vi.resetModules();
  const mod = await import("@/store/presetsStore");
  return mod.usePresetsStore;
}

beforeEach(() => {
  localStorage.clear();
});

describe("presetsStore", () => {
  it("starts from the built-in defaults when localStorage is empty", async () => {
    const store = await freshStore();
    expect(store.getState().defaultPresets).toEqual([...DEFAULT_PRESETS]);
    expect(store.getState().customPresets).toEqual([]);
    expect(store.getState().savedGradients).toEqual([]);
    expect(store.getState().hiddenGradPresets).toEqual([]);
  });

  it("loads legacy-format values from the fs_* keys", async () => {
    localStorage.setItem("fs_presets", JSON.stringify(["#112233", "#445566"]));
    localStorage.setItem("fs_default_presets", JSON.stringify(["#f5c542"]));
    localStorage.setItem("fs_hidden_grad_presets", JSON.stringify([0, 3]));
    // Legacy saved gradients carry NUMERIC stop ids.
    localStorage.setItem(
      "fs_saved_gradients",
      JSON.stringify([
        {
          id: 1719999999999,
          stops: [
            { id: 0, pos: 0, hue: 200, sat: 0.8, bri: 0.9 },
            { id: 1, pos: 1, hue: 160, sat: 0.6, bri: 0.7 },
          ],
        },
      ]),
    );

    const store = await freshStore();
    const s = store.getState();
    expect(s.customPresets).toEqual(["#112233", "#445566"]);
    expect(s.defaultPresets).toEqual(["#f5c542"]);
    expect(s.hiddenGradPresets).toEqual([0, 3]);
    expect(s.savedGradients).toHaveLength(1);
    // Numeric stop ids are normalized to strings for the typed model.
    expect(s.savedGradients[0].stops.map((st) => st.id)).toEqual(["0", "1"]);
    expect(s.savedGradients[0].stops[0].hue).toBe(200);
  });

  it("survives corrupt JSON by falling back to defaults", async () => {
    localStorage.setItem("fs_presets", "{nope");
    const store = await freshStore();
    expect(store.getState().customPresets).toEqual([]);
  });

  it("saveCustomPreset prepends, dedupes, caps at 12, and persists", async () => {
    const store = await freshStore();
    for (let i = 0; i < 14; i++) {
      store.getState().saveCustomPreset(`#0000${String(i).padStart(2, "0")}`);
    }
    store.getState().saveCustomPreset("#000001"); // re-save → moves to front
    const s = store.getState();
    expect(s.customPresets).toHaveLength(12);
    expect(s.customPresets[0]).toBe("#000001");
    expect(new Set(s.customPresets).size).toBe(12);
    expect(JSON.parse(localStorage.getItem("fs_presets")!)).toEqual(s.customPresets);
  });

  it("removeDefaultPreset persists the shrunk list", async () => {
    const store = await freshStore();
    store.getState().removeDefaultPreset(DEFAULT_PRESETS[0]);
    expect(store.getState().defaultPresets).not.toContain(DEFAULT_PRESETS[0]);
    expect(JSON.parse(localStorage.getItem("fs_default_presets")!)).toEqual(
      store.getState().defaultPresets,
    );
  });

  it("saveGradient caps at 12 and removeSavedGradient deletes by id", async () => {
    const store = await freshStore();
    const stops = [
      { id: "a", pos: 0, hue: 10, sat: 0.5, bri: 0.5 },
      { id: "b", pos: 1, hue: 20, sat: 0.5, bri: 0.5 },
    ];
    for (let i = 0; i < 13; i++) store.getState().saveGradient(stops);
    expect(store.getState().savedGradients).toHaveLength(12);
    const first = store.getState().savedGradients[0];
    store.getState().removeSavedGradient(first.id);
    expect(store.getState().savedGradients.find((g) => g.id === first.id)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem("fs_saved_gradients")!)).toHaveLength(11);
  });

  it("hideGradientPreset appends once and persists", async () => {
    const store = await freshStore();
    store.getState().hideGradientPreset(2);
    store.getState().hideGradientPreset(2);
    expect(store.getState().hiddenGradPresets).toEqual([2]);
    expect(JSON.parse(localStorage.getItem("fs_hidden_grad_presets")!)).toEqual([2]);
  });
});
