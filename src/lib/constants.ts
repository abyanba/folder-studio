/**
 * Fixed workspace/content geometry and design defaults, ported verbatim from the
 * legacy app (public/legacy.html L336-339).
 */

/** Overall workspace/folder canvas size. */
export const FW = 380;
export const FH = 380;

/** Content rectangle inside the folder where elements live and are clipped. */
export const CDX = 38;
export const CDY = 130;
export const CDW = 305;
export const CDH = 200;

/**
 * Fonts offered in the text panel — self-hosted via @fontsource (see
 * src/fonts.ts, keep both lists in sync). The first ten match the legacy app;
 * the rest are display faces added for folder-icon design.
 */
export const FONTS = [
  "Space Grotesk",
  "Source Serif 4",
  "Playfair Display",
  "DM Sans",
  "JetBrains Mono",
  "Libre Baskerville",
  "Fira Code",
  "Merriweather",
  "IBM Plex Sans",
  "Outfit",
  "Bebas Neue",
  "Abril Fatface",
  "Lobster",
  "Pacifico",
  "Caveat",
  "Permanent Marker",
  "Orbitron",
  "Bungee",
  "Press Start 2P",
  "Righteous",
] as const;

/** Selectable font weights, shared by the text panel and the multi-select panel. */
export const FONT_WEIGHTS: { value: string; label: string }[] = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
];

/** Default color-preset swatches. */
export const DEFAULT_PRESETS = [
  "#f5c542",
  "#4ecdc4",
  "#ff6b6b",
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#8b5cf6",
  "#ef4444",
  "#22d3ee",
] as const;
