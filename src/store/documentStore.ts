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
import {
  createDrawElement,
  createIconElement,
  createImageElement,
  createShapeElement,
  createTextElement,
  type CreateDrawInput,
  type CreateIconInput,
} from "@/lib/elementFactories";
import type { ShapeType } from "@/types/element";
import type { ColorValue } from "@/types/gradient";
import type { FolderElement } from "@/types/element";
import type {
  FolderDocument,
  FolderState,
  IconDefaults,
  MacColorProfile,
  MacGradientAlgo,
  PatternSettings,
  WindowsColorProfile,
  WindowsGradientAlgo,
  WindowsImageMode,
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
  /**
   * Typed element creators (one undo entry each; return the new id so the
   * caller can select it). Numbering/naming mirrors the legacy `addImage`:
   * SVG data-URLs count as "Icon N", other sources as "Image N".
   */
  addImage: (
    src: string,
    srcWidth: number,
    srcHeight: number,
    name?: string,
    logoName?: string,
  ) => string;
  addText: () => string;
  addShape: (shapeType: ShapeType) => string;
  addIcon: (input: CreateIconInput) => string;
  /** `label` is "Drawing" | "Line" | "Arc"; numbering counts existing draws. */
  addDrawElement: (input: CreateDrawInput, label?: string) => string;
  /** Remove every draw element and clamp patternLayerZ (legacy Clear All). */
  clearDrawings: () => void;
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
  /**
   * Apply a full layer order from the layers panel, given TOP-FIRST keys
   * (element ids plus the `"__pattern__"` pseudo-row). Derives both the new
   * element order and `patternLayerZ` in one undo entry.
   */
  applyLayerOrder: (keysTopFirst: string[]) => void;

  // Multi-element ops (ids supplied by the selection store / caller)
  align: (ids: string[], dir: AlignDirection) => void;
  flip: (ids: string[], axis: FlipAxis) => void;

  // Per-element toggles
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;

  // Folder / pattern setters
  setFolderColor: (color: ColorValue) => void;
  setBaseShape: (baseShape: string) => void;
  /**
   * Pick a base shape and apply its per-shape defaults (solid color, clip) as
   * ONE set → one undo entry (legacy wrapped this in a history push pair).
   */
  applyBaseShape: (
    baseShape: string,
    defaults?: { folderColor?: ColorValue; clipToFolder?: boolean },
  ) => void;
  /** Patch the folder fill (color and/or fill mode) in one undo entry. */
  setFolderFill: (
    patch: Partial<
      Pick<
        FolderDocument,
        | "folderColor"
        | "folderFillMode"
        | "folderBgImage"
        | "folderBgImageColor"
        | "folderBgImageColor2"
      >
    >,
  ) => void;
  setFolderOpacity: (opacity: number) => void;
  setFolderBgImage: (src: string | null) => void;
  setFolderBg: (patch: Partial<Pick<FolderDocument, "folderBgZoom" | "folderBgX" | "folderBgY">>) => void;
  /** Patch the image color-overlay (tint color and/or strength). */
  setFolderBgOverlay: (
    patch: Partial<Pick<FolderDocument, "folderBgOverlayColor" | "folderBgOverlayOpacity">>,
  ) => void;
  setClipToFolder: (clip: boolean) => void;
  /** Set the Windows custom tab color, solid or gradient (`null` = Auto). */
  setFolderBackColor: (color: ColorValue | null) => void;
  /** Switch the folder fullness variant (empty vs paper-peek contents). */
  setFolderState: (state: FolderState) => void;
  /** Set the "with contents" paper color, solid or gradient (`null` = white). */
  setFolderPaperColor: (color: ColorValue | null) => void;
  /** TEMPORARY tweak: pick the Windows gradient-fill color treatment. */
  setWindowsGradientAlgo: (algo: WindowsGradientAlgo) => void;
  /** TEMPORARY tweak: pick the macOS solid-fill color profile. */
  setMacColorProfile: (profile: MacColorProfile) => void;
  /** TEMPORARY tweak: pick the macOS gradient-fill color treatment. */
  setMacGradientAlgo: (algo: MacGradientAlgo) => void;
  /** TEMPORARY tweak: pick the Windows solid-fill color profile. */
  setWindowsColorProfile: (profile: WindowsColorProfile) => void;
  /** Pick how an image fill maps onto the macOS folder (full vs front-only). */
  setMacImageMode: (mode: WindowsImageMode) => void;
  /** Pick how an image fill maps onto the Windows folder (full vs front-only). */
  setWindowsImageMode: (mode: WindowsImageMode) => void;
  setPattern: (patch: Partial<PatternSettings>) => void;
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

      addImage: (src, srcWidth, srcHeight, name, logoName) => {
        let id = "";
        set((s) => {
          const isSvg = src.startsWith("data:image/svg+xml");
          const label = isSvg ? "Icon" : "Image";
          const count = s.doc.elements.filter(
            (e) => e.type === "image" && e.src.startsWith("data:image/svg+xml") === isSvg,
          ).length;
          const el = createImageElement(
            src,
            srcWidth,
            srcHeight,
            name ?? `${label} ${count + 1}`,
            logoName,
          );
          id = el.id;
          return { doc: { ...s.doc, elements: [...s.doc.elements, el] } };
        });
        return id;
      },

      addText: () => {
        const el = createTextElement();
        set((s) => ({ doc: { ...s.doc, elements: [...s.doc.elements, el] } }));
        return el.id;
      },

      addShape: (shapeType) => {
        let id = "";
        set((s) => {
          const count = s.doc.elements.filter((e) => e.type === "shape").length;
          const el = createShapeElement(shapeType, `Shape ${count + 1}`);
          id = el.id;
          return { doc: { ...s.doc, elements: [...s.doc.elements, el] } };
        });
        return id;
      },

      addIcon: (input) => {
        const el = createIconElement(input);
        set((s) => ({ doc: { ...s.doc, elements: [...s.doc.elements, el] } }));
        return el.id;
      },

      addDrawElement: (input, label = "Drawing") => {
        let id = "";
        set((s) => {
          const count = s.doc.elements.filter((e) => e.type === "draw").length;
          const el = createDrawElement({ ...input, name: input.name ?? `${label} ${count + 1}` });
          id = el.id;
          return { doc: { ...s.doc, elements: [...s.doc.elements, el] } };
        });
        return id;
      },

      clearDrawings: () =>
        set((s) => {
          let tz = s.doc.patternLayerZ;
          s.doc.elements.forEach((e, idx) => {
            if (e.type === "draw" && idx < tz) tz -= 1;
          });
          const elements = s.doc.elements.filter((e) => e.type !== "draw");
          return {
            doc: {
              ...s.doc,
              elements,
              patternLayerZ: Math.max(0, Math.min(elements.length, tz)),
            },
          };
        }),

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
          let tz = s.doc.patternLayerZ;
          s.doc.elements.forEach((e, idx) => {
            if (removing.has(e.id) && idx < tz) tz -= 1;
          });
          const elements = s.doc.elements.filter((e) => !removing.has(e.id));
          tz = Math.max(0, Math.min(elements.length, tz));
          return { doc: { ...s.doc, elements, patternLayerZ: tz } };
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

      applyLayerOrder: (keysTopFirst) =>
        set((s) => {
          const texIdx = keysTopFirst.indexOf("__pattern__");
          const elKeys = keysTopFirst.filter((k) => k !== "__pattern__");
          const byId = new Map(s.doc.elements.map((e) => [e.id, e]));
          const bottomFirst = [...elKeys]
            .reverse()
            .map((k) => byId.get(k))
            .filter((e): e is FolderElement => Boolean(e));
          if (bottomFirst.length !== s.doc.elements.length) return s;
          // texIdx keys sit above the pattern → tz = N - texIdx elements below.
          const tz =
            texIdx === -1
              ? Math.min(s.doc.patternLayerZ, bottomFirst.length)
              : bottomFirst.length - texIdx;
          return { doc: { ...s.doc, elements: bottomFirst, patternLayerZ: tz } };
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
      applyBaseShape: (baseShape, defaults) =>
        set((s) => ({
          doc: {
            ...s.doc,
            baseShape,
            ...(defaults?.folderColor !== undefined
              ? { folderColor: defaults.folderColor, folderFillMode: "color" as const }
              : {}),
            ...(defaults?.clipToFolder !== undefined
              ? { clipToFolder: defaults.clipToFolder }
              : {}),
          },
        })),
      setFolderFill: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
      setFolderOpacity: (opacity) => set((s) => ({ doc: { ...s.doc, folderOpacity: opacity } })),
      setFolderBgImage: (src) => set((s) => ({ doc: { ...s.doc, folderBgImage: src } })),
      setFolderBg: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
      setClipToFolder: (clip) => set((s) => ({ doc: { ...s.doc, clipToFolder: clip } })),
      setFolderBgOverlay: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
      setFolderBackColor: (color) => set((s) => ({ doc: { ...s.doc, folderBackColor: color } })),
      setFolderState: (state) => set((s) => ({ doc: { ...s.doc, folderState: state } })),
      setFolderPaperColor: (color) => set((s) => ({ doc: { ...s.doc, folderPaperColor: color } })),
      setWindowsGradientAlgo: (algo) => set((s) => ({ doc: { ...s.doc, windowsGradientAlgo: algo } })),
      setMacColorProfile: (profile) => set((s) => ({ doc: { ...s.doc, macColorProfile: profile } })),
      setMacGradientAlgo: (algo) => set((s) => ({ doc: { ...s.doc, macGradientAlgo: algo } })),
      setWindowsColorProfile: (profile) =>
        set((s) => ({ doc: { ...s.doc, windowsColorProfile: profile } })),
      setMacImageMode: (mode) => set((s) => ({ doc: { ...s.doc, macImageMode: mode } })),
      setWindowsImageMode: (mode) => set((s) => ({ doc: { ...s.doc, windowsImageMode: mode } })),
      setPattern: (patch) => set((s) => ({ doc: { ...s.doc, pattern: { ...s.doc.pattern, ...patch } } })),
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

/**
 * Preview transaction for continuous controls (sliders, nudge pads, gradient
 * stop drags): the store updates live on every input so the workspace tracks,
 * but the gesture lands as a single undo entry whose "before" state is the
 * document at gesture start.
 *
 * zundo's pause()/resume() alone records the wrong "before" (the last preview
 * value), so on commit we silently restore the pre-gesture doc while paused,
 * resume, then re-apply the final doc — recording exactly one entry.
 */
let previewStartDoc: FolderDocument | null = null;
let previewDepth = 0;

/**
 * Open (or nest into) a preview transaction. Reentrant (ST-01): overlapping
 * gestures share one transaction whose "before" is the outermost gesture's
 * start, so only the outermost `endDocPreview` commits. Callers must balance
 * begin/end.
 */
export function beginDocPreview(): void {
  if (previewDepth++ === 0) {
    previewStartDoc = useDocumentStore.getState().doc;
    useDocumentStore.temporal.getState().pause();
  }
}

export function endDocPreview(commit = true): void {
  if (previewDepth === 0) return; // unbalanced extra end → no-op
  previewDepth -= 1;
  if (previewDepth > 0) return; // an inner gesture ended; keep the transaction open
  if (!previewStartDoc) return; // defensive
  const finalDoc = useDocumentStore.getState().doc;
  useDocumentStore.setState({ doc: previewStartDoc });
  previewStartDoc = null;
  useDocumentStore.temporal.getState().resume();
  if (commit) useDocumentStore.setState({ doc: finalDoc });
}

export function isDocPreviewActive(): boolean {
  return previewDepth > 0;
}
