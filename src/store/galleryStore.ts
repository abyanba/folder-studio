/**
 * Saved-design gallery, persisted to the legacy `fs_gallery` localStorage key
 * (max 20, newest first). New saves store the typed {@link FolderDocument} as
 * the snapshot; loading runs every snapshot — legacy or new — through
 * `normalizeLegacySnapshot`, so designs saved by the old app keep opening.
 */

import { create } from "zustand";
import type { FolderDocument } from "@/types/document";

export interface GalleryItem {
  /** Legacy identity: `Date.now()` at save time. */
  id: number;
  /** 128px PNG data URL. */
  thumb: string;
  date: string;
  /** Legacy snapshot object or a FolderDocument (new saves). */
  snap: unknown;
}

const KEY = "fs_gallery";
const MAX_ITEMS = 20;

function load(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as GalleryItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist and report success; quota failures (large data-URL thumbs) return false. */
function save(items: GalleryItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export interface GalleryStore {
  items: GalleryItem[];
  /** Returns whether the item persisted to localStorage (false on quota failure). */
  addItem: (thumb: string, doc: FolderDocument) => boolean;
  removeItem: (id: number) => void;
}

export const useGalleryStore = create<GalleryStore>()((set, get) => ({
  items: load(),

  addItem: (thumb, doc) => {
    const existing = new Set(get().items.map((i) => i.id));
    let id = Date.now();
    while (existing.has(id)) id += 1;
    const items = [
      {
        id,
        thumb,
        date: new Date().toLocaleDateString(),
        snap: structuredClone(doc),
      },
      ...get().items,
    ].slice(0, MAX_ITEMS);
    set({ items });
    return save(items);
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    save(items);
  },
}));
