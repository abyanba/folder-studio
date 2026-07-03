/**
 * The document store: the single source of truth for the design (folder + all
 * elements), with undo/redo provided by zundo's `temporal` middleware.
 *
 * Only the `doc` slice is tracked for history (via `partialize`), so undo/redo
 * never touches ephemeral UI state (selection, active panel, in-progress drag),
 * matching the legacy behavior where `_undo` cleared the selection rather than
 * restoring it. Consecutive identical documents are de-duped via deep equality,
 * mirroring the legacy `_pushHistory` skip-if-identical guard.
 */

import { create } from "zustand";
import { temporal } from "zundo";
import isEqual from "fast-deep-equal";
import { CDW, CDH } from "@/lib/constants";
import { createId } from "@/lib/id";
import type { ColorValue } from "@/types/gradient";
import type { FolderElement } from "@/types/element";
import type {
  FolderDocument,
  IconDefaults,
  TextureSettings,
} from "@/types/document";
import { createEmptyDocument } from "@/types/document";

export type AlignDirection =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distH"
  | "distV";

export type FlipAxis = "h" | "v";

export interface DocumentStore {
  doc: FolderDocument;

  // Element CRUD
  addElement: (element: FolderElement) => void;
  updateElement: (id: string, patch: Partial<FolderElement>) => void;
  /**
   * Apply several element patches in a single set → a single undo entry.
   * Used to commit a multi-select drag as one gesture.
   */
  updateElements: (patches: Record<string, Partial<FolderElement>>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElement: (id: string) => string | null;

  // Ordering
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reorder: (fromId: string, toId: string) => void;

  // Multi-element ops (ids supplied by the selection store / caller)
  align: (ids: string[], dir: AlignDirection) => void;
  flip: (ids: string[], axis: FlipAxis) => void;

  // Per-element toggles
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;

  // Folder / texture setters
  setFolderColor: (color: ColorValue) => void;
  setBaseShape: (baseShape: string) => void;
  setFolderOpacity: (opacity: number) => void;
  setFolderBgImage: (src: string | null) => void;
  setFolderBg: (patch: Partial<Pick<FolderDocument, "folderBgZoom" | "folderBgX" | "folderBgY">>) => void;
  setClipToFolder: (clip: boolean) => void;
  setTexture: (patch: Partial<TextureSettings>) => void;
  setIconDefaults: (patch: Partial<IconDefaults>) => void;

  // Whole-document
  loadDocument: (doc: FolderDocument) => void;
  reset: () => void;
}

/** Merge a patch into the element with `id`, preserving array order. */
function patchElement(
  elements: FolderElement[],
  id: string,
  patch: object,
): FolderElement[] {
  return elements.map((e) =>
    e.id === id ? ({ ...e, ...patch } as FolderElement) : e,
  );
}

/** Move an item within an array from index `from` to index `to`. */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The slice of the store tracked for undo/redo. */
type TrackedState = Pick<DocumentStore, "doc">;

export const useDocumentStore = create<DocumentStore>()(
  temporal<DocumentStore, [], [], TrackedState>(
    (set) => ({
      doc: createEmptyDocument(),

      addElement: (element) =>
        set((s) => ({ doc: { ...s.doc, elements: [...s.doc.elements, element] } })),

      updateElement: (id, patch) =>
        set((s) => ({
          doc: { ...s.doc, elements: patchElement(s.doc.elements, id, patch) },
        })),

      updateElements: (patches) =>
        set((s) => ({
          doc: {
            ...s.doc,
            elements: s.doc.elements.map((e) =>
              patches[e.id] ? ({ ...e, ...patches[e.id] } as FolderElement) : e,
            ),
          },
        })),

      removeElements: (ids) =>
        set((s) => {
          const removing = new Set(ids);
          let tz = s.doc.textureLayerZ;
          s.doc.elements.forEach((e, idx) => {
            if (removing.has(e.id) && idx < tz) tz -= 1;
          });
          const elements = s.doc.elements.filter((e) => !removing.has(e.id));
          tz = Math.max(0, Math.min(elements.length, tz));
          return { doc: { ...s.doc, elements, textureLayerZ: tz } };
        }),

      duplicateElement: (id) => {
        let newId: string | null = null;
        set((s) => {
          const el = s.doc.elements.find((e) => e.id === id);
          if (!el) return s;
          newId = createId();
          const copy = {
            ...structuredClone(el),
            id: newId,
            x: el.x + 10,
            y: el.y + 10,
          } as FolderElement;
          return { doc: { ...s.doc, elements: [...s.doc.elements, copy] } };
        });
        return newId;
      },

      moveUp: (id) =>
        set((s) => {
          const i = s.doc.elements.findIndex((e) => e.id === id);
          if (i < 0 || i >= s.doc.elements.length - 1) return s;
          return { doc: { ...s.doc, elements: moveItem(s.doc.elements, i, i + 1) } };
        }),

      moveDown: (id) =>
        set((s) => {
          const i = s.doc.elements.findIndex((e) => e.id === id);
          if (i <= 0) return s;
          return { doc: { ...s.doc, elements: moveItem(s.doc.elements, i, i - 1) } };
        }),

      bringToFront: (id) =>
        set((s) => {
          const i = s.doc.elements.findIndex((e) => e.id === id);
          if (i < 0) return s;
          return {
            doc: { ...s.doc, elements: moveItem(s.doc.elements, i, s.doc.elements.length - 1) },
          };
        }),

      sendToBack: (id) =>
        set((s) => {
          const i = s.doc.elements.findIndex((e) => e.id === id);
          if (i < 0) return s;
          return { doc: { ...s.doc, elements: moveItem(s.doc.elements, i, 0) } };
        }),

      reorder: (fromId, toId) =>
        set((s) => {
          if (fromId === toId) return s;
          const from = s.doc.elements.findIndex((e) => e.id === fromId);
          const to = s.doc.elements.findIndex((e) => e.id === toId);
          if (from < 0 || to < 0) return s;
          return { doc: { ...s.doc, elements: moveItem(s.doc.elements, from, to) } };
        }),

      align: (ids, dir) =>
        set((s) => {
          const sel = ids
            .map((id) => s.doc.elements.find((e) => e.id === id))
            .filter((e): e is FolderElement => Boolean(e));
          if (sel.length < 1) return s;
          const upd = new Map<string, Partial<FolderElement>>();
          if (dir === "left") sel.forEach((e) => upd.set(e.id, { x: 0 }));
          else if (dir === "center") sel.forEach((e) => upd.set(e.id, { x: CDW / 2 - e.width / 2 }));
          else if (dir === "right") sel.forEach((e) => upd.set(e.id, { x: CDW - e.width }));
          else if (dir === "top") sel.forEach((e) => upd.set(e.id, { y: 0 }));
          else if (dir === "middle") sel.forEach((e) => upd.set(e.id, { y: CDH / 2 - e.height / 2 }));
          else if (dir === "bottom") sel.forEach((e) => upd.set(e.id, { y: CDH - e.height }));
          else if (dir === "distH") {
            const sorted = [...sel].sort((a, b) => a.x - b.x);
            if (sorted.length > 2) {
              const first = sorted[0];
              const last = sorted[sorted.length - 1];
              const totalW = last.x + last.width - first.x;
              const innerW = sorted.reduce((sum, e) => sum + e.width, 0);
              const gap = (totalW - innerW) / (sorted.length - 1);
              let cx = first.x + first.width;
              for (let i = 1; i < sorted.length - 1; i++) {
                upd.set(sorted[i].id, { x: cx + gap });
                cx = cx + gap + sorted[i].width;
              }
            }
          } else if (dir === "distV") {
            const sorted = [...sel].sort((a, b) => a.y - b.y);
            if (sorted.length > 2) {
              const first = sorted[0];
              const last = sorted[sorted.length - 1];
              const totalH = last.y + last.height - first.y;
              const innerH = sorted.reduce((sum, e) => sum + e.height, 0);
              const gap = (totalH - innerH) / (sorted.length - 1);
              let cy = first.y + first.height;
              for (let i = 1; i < sorted.length - 1; i++) {
                upd.set(sorted[i].id, { y: cy + gap });
                cy = cy + gap + sorted[i].height;
              }
            }
          }
          return {
            doc: {
              ...s.doc,
              elements: s.doc.elements.map((e) =>
                upd.has(e.id) ? ({ ...e, ...upd.get(e.id) } as FolderElement) : e,
              ),
            },
          };
        }),

      flip: (ids, axis) =>
        set((s) => {
          const sel = new Set(ids);
          return {
            doc: {
              ...s.doc,
              elements: s.doc.elements.map((e) => {
                if (!sel.has(e.id)) return e;
                return axis === "h"
                  ? { ...e, scaleX: -e.scaleX }
                  : { ...e, scaleY: -e.scaleY };
              }),
            },
          };
        }),

      toggleLock: (id) =>
        set((s) => ({
          doc: {
            ...s.doc,
            elements: s.doc.elements.map((e) =>
              e.id === id ? { ...e, locked: !e.locked } : e,
            ),
          },
        })),

      toggleVisible: (id) =>
        set((s) => ({
          doc: {
            ...s.doc,
            elements: s.doc.elements.map((e) =>
              e.id === id ? { ...e, visible: !e.visible } : e,
            ),
          },
        })),

      setFolderColor: (color) => set((s) => ({ doc: { ...s.doc, folderColor: color } })),
      setBaseShape: (baseShape) => set((s) => ({ doc: { ...s.doc, baseShape } })),
      setFolderOpacity: (opacity) => set((s) => ({ doc: { ...s.doc, folderOpacity: opacity } })),
      setFolderBgImage: (src) => set((s) => ({ doc: { ...s.doc, folderBgImage: src } })),
      setFolderBg: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
      setClipToFolder: (clip) => set((s) => ({ doc: { ...s.doc, clipToFolder: clip } })),
      setTexture: (patch) => set((s) => ({ doc: { ...s.doc, texture: { ...s.doc.texture, ...patch } } })),
      setIconDefaults: (patch) =>
        set((s) => ({ doc: { ...s.doc, iconDefaults: { ...s.doc.iconDefaults, ...patch } } })),

      loadDocument: (doc) => set({ doc }),
      reset: () => set({ doc: createEmptyDocument() }),
    }),
    {
      limit: 50,
      equality: (past, current) => isEqual(past, current),
      partialize: (state) => ({ doc: state.doc }),
    },
  ),
);
