/**
 * Ephemeral UI state: which panel is open, in-progress editing/drag, context
 * menu. Not part of the undoable document.
 */

import { create } from "zustand";
import type { DragState } from "@/types/interaction";
import type { BlendMode } from "@/types/element";
import type {
  MacColorProfile,
  MacGradientAlgo,
  WindowsColorProfile,
  WindowsGradientAlgo,
} from "@/types/document";
import type { ColorValue } from "@/types/gradient";
import type { ControlPoint, Point } from "@/lib/smoothing";
import type { CurrentDraw } from "@/lib/draw";

export interface ContextMenuState {
  x: number;
  y: number;
  elId: string | null;
}

export type DrawMode = "pen" | "eraser";
export type DrawSubmode = "freehand" | "line" | "arc";

export interface UiStore {
  activePanel: string | null;
  editingTextId: string | null;
  editingLayerName: string | null;
  contextMenu: ContextMenuState | null;
  drag: DragState | null;
  /** Blend mode being hovered in the image panel — live-previewed on the selected image. */
  blendPreview: BlendMode | null;
  /** Font family being hovered in the text panel — live-previewed on the selected text. */
  fontPreview: string | null;
  /** Material id being hovered in an element panel — live-previewed on the selected element. */
  materialPreview: string | null;
  /** Windows gradient color profile being hovered — live-previewed on the folder base. */
  windowsGradientPreview: WindowsGradientAlgo | null;
  /** macOS solid color profile being hovered — live-previewed on the folder base. */
  macColorProfilePreview: MacColorProfile | null;
  /** macOS gradient color profile being hovered — live-previewed on the folder base. */
  macGradientPreview: MacGradientAlgo | null;
  /** Windows solid color profile being hovered — live-previewed on the folder base. */
  windowsColorProfilePreview: WindowsColorProfile | null;
  /** Logos panel: mono (tinted simple-icons) vs full-color artwork. */
  logoMode: "mono" | "color";
  /** Tint for mono logos (legacy `logoColor`). */
  logoColor: string;
  /** Light workspace backdrop to preview the icon on a bright background. */
  canvasLight: boolean;
  /** Keyboard-shortcut cheat sheet visibility. */
  helpOpen: boolean;

  // Draw tool
  activeTool: "draw" | null;
  drawMode: DrawMode;
  drawSubmode: DrawSubmode;
  drawColor: ColorValue;
  drawSize: number;
  drawOpacity: number;
  /** In-progress freehand stroke (ephemeral, rendered live). */
  currentDraw: CurrentDraw | null;
  /** Committed anchors of an in-progress line/arc path. */
  shapePoints: ControlPoint[];
  /** Hover position for the line/arc preview segment. */
  shapeCursorPos: Point | null;
  /** Arc anchor being dragged out (handles follow the pointer). */
  shapeDragPoint: ControlPoint | null;

  setActivePanel: (panel: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setEditingLayerName: (id: string | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setDrag: (drag: DragState | null) => void;
  setBlendPreview: (mode: BlendMode | null) => void;
  setFontPreview: (font: string | null) => void;
  setMaterialPreview: (id: string | null) => void;
  setWindowsGradientPreview: (algo: WindowsGradientAlgo | null) => void;
  setMacColorProfilePreview: (profile: MacColorProfile | null) => void;
  setMacGradientPreview: (algo: MacGradientAlgo | null) => void;
  setWindowsColorProfilePreview: (profile: WindowsColorProfile | null) => void;
  setLogoMode: (mode: "mono" | "color") => void;
  setLogoColor: (color: string) => void;
  setCanvasLight: (light: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setActiveTool: (tool: "draw" | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  /** Switching submode discards any in-progress line/arc points (legacy). */
  setDrawSubmode: (submode: DrawSubmode) => void;
  setDrawColor: (color: ColorValue) => void;
  setDrawSize: (size: number) => void;
  setDrawOpacity: (opacity: number) => void;
  setCurrentDraw: (draw: CurrentDraw | null) => void;
  setShapePoints: (points: ControlPoint[]) => void;
  setShapeCursorPos: (pos: Point | null) => void;
  setShapeDragPoint: (point: ControlPoint | null) => void;
  /** Clear every in-progress draw artifact (Escape / tool exit). */
  resetDrawProgress: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  activePanel: "shape",
  editingTextId: null,
  editingLayerName: null,
  contextMenu: null,
  drag: null,
  blendPreview: null,
  fontPreview: null,
  materialPreview: null,
  windowsGradientPreview: null,
  macColorProfilePreview: null,
  macGradientPreview: null,
  windowsColorProfilePreview: null,
  logoMode: "mono",
  logoColor: "#ffffff",
  canvasLight: false,
  helpOpen: false,
  activeTool: null,
  drawMode: "pen",
  drawSubmode: "freehand",
  drawColor: "#ffffff",
  drawSize: 8,
  drawOpacity: 1,
  currentDraw: null,
  shapePoints: [],
  shapeCursorPos: null,
  shapeDragPoint: null,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setEditingLayerName: (id) => set({ editingLayerName: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setDrag: (drag) => set({ drag }),
  setBlendPreview: (mode) => set({ blendPreview: mode }),
  setFontPreview: (font) => set({ fontPreview: font }),
  setMaterialPreview: (id) => set({ materialPreview: id }),
  setWindowsGradientPreview: (algo) => set({ windowsGradientPreview: algo }),
  setMacColorProfilePreview: (profile) => set({ macColorProfilePreview: profile }),
  setMacGradientPreview: (algo) => set({ macGradientPreview: algo }),
  setWindowsColorProfilePreview: (profile) => set({ windowsColorProfilePreview: profile }),
  setLogoMode: (mode) => set({ logoMode: mode }),
  setLogoColor: (color) => set({ logoColor: color }),
  setCanvasLight: (light) => set({ canvasLight: light }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      currentDraw: null,
      shapePoints: [],
      shapeCursorPos: null,
      shapeDragPoint: null,
    }),
  setDrawMode: (mode) => set({ drawMode: mode }),
  setDrawSubmode: (submode) =>
    set({
      drawSubmode: submode,
      shapePoints: [],
      shapeCursorPos: null,
      shapeDragPoint: null,
    }),
  setDrawColor: (color) => set({ drawColor: color }),
  setDrawSize: (size) => set({ drawSize: size }),
  setDrawOpacity: (opacity) => set({ drawOpacity: opacity }),
  setCurrentDraw: (draw) => set({ currentDraw: draw }),
  setShapePoints: (points) => set({ shapePoints: points }),
  setShapeCursorPos: (pos) => set({ shapeCursorPos: pos }),
  setShapeDragPoint: (point) => set({ shapeDragPoint: point }),
  resetDrawProgress: () =>
    set({
      currentDraw: null,
      shapePoints: [],
      shapeCursorPos: null,
      shapeDragPoint: null,
    }),
}));
