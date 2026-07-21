/**
 * User-added library assets (the "+ Add" flow in the Icons/Logos panels).
 *
 * Persisted to localStorage (`fs_custom_assets`), NOT undoable — a library
 * addition is a setting, not a document edit. Two shapes converge here:
 *
 *   - TINTABLE (icon, or mono logo): a `currentColor` body seeded into the icon
 *     cache so it renders exactly like a baked icon/mono-logo, in editor and
 *     export alike. Icons use the `"custom"` variant, mono logos `"logo"`.
 *   - COLOR (logo): a self-contained `image/svg+xml` data URL, placed as an
 *     image element like today's color logos — no cache needed.
 *
 * Reference-only: bodies live here, elements reference them by id. Project-file
 * JSON is dev-only, so custom assets never need to travel outside the browser.
 */

import { create } from "zustand";
import type { IconVariant } from "@/types/element";
import { evictCustomBody, seedCustomBody } from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

export type CustomTarget = "icon" | "logo";

export interface CustomAsset {
  id: string; // "custom_<n>"
  target: CustomTarget;
  kind: "tintable" | "color";
  name: string;
  category: string;
  width: number;
  height: number;
  /** tintable: inner SVG (currentColor). */
  body?: string;
  /** color: `data:image/svg+xml,…`. */
  src?: string;
  createdAt: number;
}

const KEY = "fs_custom_assets";

function load(): CustomAsset[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CustomAsset[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(assets: CustomAsset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(assets));
  } catch {
    // Quota/privacy failures are non-fatal; in-memory state still updates.
  }
}

/** The cache variant a tintable asset resolves under (color assets aren't cached). */
export function assetVariant(a: Pick<CustomAsset, "target">): IconVariant {
  return a.target === "icon" ? "custom" : "logo";
}

function seed(a: CustomAsset): void {
  if (a.kind === "tintable" && a.body) {
    seedCustomBody(a.id, assetVariant(a), { body: a.body, width: a.width, height: a.height });
  }
}

export interface CustomAssetsStore {
  assets: CustomAsset[];
  add: (input: Omit<CustomAsset, "id" | "createdAt">) => CustomAsset;
  remove: (id: string) => void;
}

let nextId = 0;

export const useCustomAssetsStore = create<CustomAssetsStore>()((set, get) => {
  const assets = load();
  // Continue ids past whatever's persisted, and seed tintable bodies on boot.
  for (const a of assets) {
    const n = Number.parseInt(a.id.replace(/^custom_/, ""), 10);
    if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
    seed(a);
  }

  return {
    assets,
    add: (input) => {
      const asset: CustomAsset = { ...input, id: `custom_${nextId++}`, createdAt: Date.now() };
      seed(asset);
      const next = [asset, ...get().assets];
      set({ assets: next });
      persist(next);
      return asset;
    },
    remove: (id) => {
      const asset = get().assets.find((a) => a.id === id);
      if (asset && asset.kind === "tintable") {
        evictCustomBody(asset.id, assetVariant(asset));
        // Placed copies are reference-only (the body lived here), so deleting the
        // library entry would leave empty bounding boxes — remove those elements
        // too. Color logos are self-contained (src on the element) and stay put.
        const doc = useDocumentStore.getState();
        const orphans = doc.doc.elements
          .filter((e) => e.type === "icon" && e.iconName === asset.id)
          .map((e) => e.id);
        if (orphans.length) {
          doc.removeElements(orphans);
          const sel = useSelectionStore.getState();
          if (sel.selectedIds.some((sid) => orphans.includes(sid))) sel.clear();
        }
      }
      const next = get().assets.filter((a) => a.id !== id);
      set({ assets: next });
      persist(next);
    },
  };
});
