/**
 * Color model shared by folder fill and every element's fill/stroke/text color.
 *
 * A color is either a plain hex string (solid) or a {@link Gradient} object.
 * Gradient stops are stored in HSV (matching the legacy color pickers) so the
 * picker UI can edit hue/sat/bri directly without round-tripping through hex.
 */

export interface GradientStop {
  id: string;
  /** Position along the gradient, 0..1. */
  pos: number;
  /** Hue in degrees, 0..360. */
  hue: number;
  /** Saturation, 0..1. */
  sat: number;
  /** Brightness/value, 0..1. */
  bri: number;
}

export interface Gradient {
  kind: "linear" | "radial";
  /** Angle in degrees (linear only; ignored for radial). */
  angle: number;
  stops: GradientStop[];
}

/** A solid hex string (e.g. `#8cf0a8`) or a gradient. */
export type ColorValue = string | Gradient;

export function isGradient(color: ColorValue): color is Gradient {
  return typeof color !== "string";
}
