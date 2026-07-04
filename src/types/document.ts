/**
 * The full design document — everything that defines a folder icon and that
 * undo/redo must restore. This replaces the legacy `_getSnapshot()` whitelist
 * (which silently omitted several persisted fields); by making the snapshot the
 * whole {@link FolderDocument}, new design fields are undoable by construction.
 *
 * Ephemeral state (selection, active panel, in-progress drag, color-picker
 * transients) lives in separate stores and is intentionally NOT part of this type.
 */

import type { ColorValue } from "./gradient";
import type { FolderElement } from "./element";

export type BaseShapeId = string;
export type TextureId = string;

export interface TextureSettings {
  id: TextureId;
  opacity: number;
  scale: number;
  rotation: number;
  color: string;
  /** `"transparent"` or a hex string. */
  bg: string;
  /** Deterministic seed for randomized textures (dots, confetti, …). */
  seed: number;
}

export interface IconDefaults {
  stroke: number;
  color: string;
}

export interface FolderDocument {
  baseShape: BaseShapeId;
  /** Base folder fill — solid hex or gradient. */
  folderColor: ColorValue;
  /**
   * Whether the base is painted with `folderColor` or `folderBgImage`.
   * Explicit (not inferred from `folderBgImage != null`) so an uploaded image
   * survives switching back to a color fill, matching the legacy `colorMode`.
   */
  folderFillMode: "color" | "image";
  folderOpacity: number;
  /** Background image data URL, or null when unset. */
  folderBgImage: string | null;
  folderBgZoom: number;
  folderBgX: number;
  folderBgY: number;
  clipToFolder: boolean;
  texture: TextureSettings;
  iconDefaults: IconDefaults;
  elements: FolderElement[];
  /**
   * Z-position of the texture layer within `elements`, counted from the top.
   * Kept in sync when elements are added/removed/reordered.
   */
  textureLayerZ: number;
}

export function createEmptyDocument(): FolderDocument {
  return {
    baseShape: "windows",
    folderColor: "#f5c542",
    folderFillMode: "color",
    folderOpacity: 1,
    folderBgImage: null,
    folderBgZoom: 1,
    folderBgX: 50,
    folderBgY: 50,
    clipToFolder: true,
    texture: {
      id: "none",
      opacity: 0.35,
      scale: 1,
      rotation: 0,
      color: "#ffffff",
      bg: "transparent",
      seed: 0,
    },
    iconDefaults: { stroke: 1.5, color: "#ffffff" },
    elements: [],
    textureLayerZ: 0,
  };
}

/**
 * Migrate a legacy gallery snapshot (flat `gradStops`/`gradType`/`gradAngle`,
 * numeric element IDs, `gH1`/`gS1` fallbacks, …) into a {@link FolderDocument}.
 *
 * NOTE: full migration — including per-element ID normalization and the flat →
 * {@link Gradient} folder-color conversion — is wired up in a later phase
 * (gallery/persistence). For now this is a typed stub that returns defaults so
 * the rest of the model can be built and tested against a stable shape.
 */
export function normalizeLegacySnapshot(_legacy: unknown): FolderDocument {
  // TODO(phase 3/9): map baseShape, texture*, elements, and flat gradient fields.
  return createEmptyDocument();
}
