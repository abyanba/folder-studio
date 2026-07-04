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

function save(items: GalleryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Quota failures (data-URL thumbs are large) are non-fatal.
  }
}

export interface GalleryStore {
  items: GalleryItem[];
  addItem: (thumb: string, doc: FolderDocument) => void;
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
    save(items);
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    save(items);
  },
}));
