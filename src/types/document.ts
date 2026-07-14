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

/**
 * Color profile for a *gradient*-filled Windows folder — how the tab/back and
 * shine relate to the user's gradient. (Solid fills always use the finalized
 * anchored algorithm.) The front stays the user's gradient in every profile
 * except `lit`; the official gradient folders keep it verbatim, so the profiles
 * mainly differ in the back panel:
 * - current — uniform back derived from the deepest stop (Aqua style).
 * - lit     — front pushed through the anchored light→deep envelope.
 * - echo    — back echoes the whole front gradient, darkened + saturated
 *             (3D Objects style), via a fixed formula.
 * - best    — echo back via the anchored reference treatment + tuned shine.
 */
export type WindowsGradientAlgo = "current" | "lit" | "echo" | "best";
export const DEFAULT_WINDOWS_GRADIENT_ALGO: WindowsGradientAlgo = "best";

/** macOS gradient-fill treatment; same option set as {@link WindowsGradientAlgo}. */
export type MacGradientAlgo = WindowsGradientAlgo;
export const DEFAULT_MAC_GRADIENT_ALGO: MacGradientAlgo = "best";

/**
 * TEMPORARY: macOS solid-fill color treatment. Every profile shares the same
 * geometry (deeper tab, bright front face, adaptive double-emboss bottom rim);
 * they differ in how the picked color drives the palette:
 * - official — reproduces Apple's recolored folder envelope (washed/authentic):
 *              front saturation capped ~0.54, forced bright, deep saturated tab.
 * - popped   — keeps the picked color's saturation for a punchier folder.
 * - flat     — a single flat front color, structure kept (tab/rim/shadow).
 * - best     — authentic depth + emboss but retains more of the picked color.
 *
 * Each non-flat profile floors its front value so a solid fill never reaches
 * true black (matching the official black folder); pure black is reachable only
 * through the flat profile or a gradient fill.
 */
export type MacColorProfile = "official" | "popped" | "flat" | "best";
export const DEFAULT_MAC_COLOR_PROFILE: MacColorProfile = "best";

/**
 * Windows solid-fill color treatment; same option set as {@link MacColorProfile}.
 * Defaults to `official` — the reference-anchored authentic reproduction, which
 * is the current (and historically chosen) Windows solid look.
 */
export type WindowsColorProfile = MacColorProfile;
export const DEFAULT_WINDOWS_COLOR_PROFILE: WindowsColorProfile = "official";

/**
 * How an *image* fill maps onto the Windows folder (image fill mode only):
 * - full  — the image spans the whole folder icon (front + tab/back).
 * - front — the image covers only the front panel; the tab/back use an
 *           adaptive color derived from the image (`folderBgImageColor`),
 *           run through the finalized anchored back treatment.
 */
export type WindowsImageMode = "full" | "front";
export const DEFAULT_WINDOWS_IMAGE_MODE: WindowsImageMode = "full";

/**
 * Folder fullness variant:
 * - empty    — the plain folder (default).
 * - contents — a paper sheet peeks out between the tab and the front panel,
 *              matching the official "with contents" icon.
 */
export type FolderState = "empty" | "contents";
export const DEFAULT_FOLDER_STATE: FolderState = "empty";

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
  /** Default color applied to newly added icons (gradient-capable). */
  color: ColorValue;
}

export interface FolderDocument {
  /** Schema version for migrations (AR-07). Absent on legacy/pre-v2 snapshots. */
  v?: number;
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
  /** Representative (dominant) color of `folderBgImage`, for the adaptive back panel. */
  folderBgImageColor?: string;
  /**
   * A distinct secondary dominant color of `folderBgImage`, present only when the
   * image is colorful enough. When set (and no custom `folderBackColor`), the
   * front-only image tab auto-derives a gradient from both dominants instead of a
   * single averaged color.
   */
  folderBgImageColor2?: string | null;
  folderBgZoom: number;
  folderBgX: number;
  folderBgY: number;
  /** Solid color tinted over the background image (to mute/darken it). */
  folderBgOverlayColor: string;
  /** Strength of the image overlay, 0 (off) → 1. */
  folderBgOverlayOpacity: number;
  clipToFolder: boolean;
  /**
   * Custom color for the folder's TAB/back only (solid or gradient), shared by
   * the Windows and macOS shapes. `null` derives it from the front (Auto — the
   * default). On Windows the bottom rim always stays front-derived.
   */
  folderBackColor: ColorValue | null;
  /** Folder fullness variant (empty vs a paper-peek "with contents"). */
  folderState: FolderState;
  /**
   * Custom color for the "with contents" paper sheet (solid or gradient).
   * `null` keeps it white (the default) regardless of the folder color.
   */
  folderPaperColor: ColorValue | null;
  /** TEMPORARY: gradient-fill color treatment for the Windows base shape. */
  windowsGradientAlgo: WindowsGradientAlgo;
  /** TEMPORARY: solid-fill color treatment for the macOS base shape. */
  macColorProfile: MacColorProfile;
  /** TEMPORARY: gradient-fill color treatment for the macOS base shape. */
  macGradientAlgo: MacGradientAlgo;
  /** TEMPORARY: solid-fill color treatment for the Windows base shape. */
  windowsColorProfile: WindowsColorProfile;
  /** How an image fill maps onto the Windows folder (see {@link WindowsImageMode}). */
  windowsImageMode: WindowsImageMode;
  /** How an image fill maps onto the macOS folder (full vs front-only). */
  macImageMode: WindowsImageMode;
  texture: TextureSettings;
  iconDefaults: IconDefaults;
  elements: FolderElement[];
  /**
   * Z-position of the texture layer within `elements`, counted from the top.
   * Kept in sync when elements are added/removed/reordered.
   */
  textureLayerZ: number;
}

export const DOCUMENT_VERSION = 2;

export function createEmptyDocument(): FolderDocument {
  return {
    v: DOCUMENT_VERSION,
    baseShape: "windows",
    folderColor: "#f5c542",
    folderFillMode: "color",
    folderOpacity: 1,
    folderBgImage: null,
    folderBgZoom: 1,
    folderBgX: 50,
    folderBgY: 50,
    folderBgOverlayColor: "#000000",
    folderBgOverlayOpacity: 0,
    clipToFolder: true,
    folderBackColor: null,
    folderState: DEFAULT_FOLDER_STATE,
    folderPaperColor: null,
    windowsGradientAlgo: DEFAULT_WINDOWS_GRADIENT_ALGO,
    macColorProfile: DEFAULT_MAC_COLOR_PROFILE,
    macGradientAlgo: DEFAULT_MAC_GRADIENT_ALGO,
    windowsColorProfile: DEFAULT_WINDOWS_COLOR_PROFILE,
    windowsImageMode: DEFAULT_WINDOWS_IMAGE_MODE,
    macImageMode: DEFAULT_WINDOWS_IMAGE_MODE,
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

// Legacy gallery-snapshot migration lives in `src/lib/legacySnapshot.ts`
// (it needs color/id helpers that would be circular from this types module).
