/**
 * Built-in gradient presets, ported from the legacy `GRADIENT_PRESETS`
 * (public/legacy.html L423-436). Stop ids are strings to match the typed
 * {@link GradientStop} model; preset identity for hide/show persistence is the
 * array index (legacy `fs_hidden_grad_presets` stores indices).
 */

import type { Gradient, GradientStop } from "@/types/gradient";

export interface GradientPreset {
  name: string;
  stops: GradientStop[];
}

const stop = (
  id: string,
  pos: number,
  hue: number,
  sat: number,
  bri: number,
): GradientStop => ({ id, pos, hue, sat, bri });

/**
 * Ubuntu "Suru" gradient — the aubergine → orange brand gradient. Doubles as
 * the default tab color for the Yaru base folder (its stops are reused below as
 * a preset). Aubergine #5E2750, Ubuntu orange #E95420.
 */
export const SURU_GRADIENT: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    stop("0", 0, 315, 0.59, 0.37),
    stop("1", 1, 16, 0.86, 0.91),
  ],
};

/**
 * Beautydream's reference lavender (#2E4AFA → #8E9EFF). Angle 60 is the guide's
 * -120 in this app's convention — see the angle note in `baseShapes.ts`.
 * Applied as the folder fill when the Beautydream base shape is picked.
 */
export const BEAUTYDREAM_LAVENDER: Gradient = {
  kind: "linear",
  angle: 60,
  stops: [
    stop("0", 0, 231.76, 0.816, 0.9804),
    stop("1", 1, 231.5, 0.4431, 1),
  ],
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  { name: "Sunset", stops: [stop("0", 0, 20, 0.9, 0.98), stop("1", 1, 44, 1, 1)] },
  { name: "Ocean", stops: [stop("0", 0, 199, 0.82, 0.69), stop("1", 1, 197, 0.45, 0.93)] },
  { name: "Aurora", stops: [stop("0", 0, 175, 0.9, 0.85), stop("1", 1, 260, 0.85, 0.72)] },
  {
    name: "Cotton Candy",
    stops: [
      stop("0", 0, 340, 0.45, 1),
      stop("1", 0.5, 290, 0.3, 1),
      stop("2", 1, 215, 0.6, 0.95),
    ],
  },
  { name: "Forest", stops: [stop("0", 0, 193, 0.72, 0.37), stop("1", 1, 136, 0.42, 0.68)] },
  { name: "Nebula", stops: [stop("0", 0, 262, 0.75, 0.5), stop("1", 1, 318, 0.7, 0.87)] },
  { name: "Peach", stops: [stop("0", 0, 12, 0.7, 0.98), stop("1", 1, 38, 0.65, 1)] },
  { name: "Midnight", stops: [stop("0", 0, 228, 0.3, 0.18), stop("1", 1, 240, 0.1, 0.28)] },
  { name: "Rose Gold", stops: [stop("0", 0, 35, 0.45, 0.98), stop("1", 1, 350, 0.4, 0.85)] },
  { name: "Mango", stops: [stop("0", 0, 48, 0.95, 1), stop("1", 1, 24, 0.92, 0.93)] },
  { name: "Mint", stops: [stop("0", 0, 155, 0.65, 0.92), stop("1", 1, 180, 0.55, 0.75)] },
  { name: "Candy", stops: [stop("0", 0, 338, 0.75, 0.98), stop("1", 1, 207, 0.55, 0.98)] },
  { name: "Ubuntu Suru", stops: SURU_GRADIENT.stops },
  // The two Beautydream reference gradients (docs/beautydream-folder-color.md).
  {
    name: "Beautydream Sunset",
    stops: [
      stop("0", 0, 301.75, 0.7464, 0.5412),
      stop("1", 0.5, 359.32, 0.6941, 1),
      stop("2", 1, 49.63, 0.8594, 0.9765),
    ],
  },
  {
    name: "Beautydream Custom",
    stops: [
      stop("0", 0, 322.27, 0.533, 0.7137),
      stop("1", 0.5, 359.14, 0.5578, 0.9843),
      stop("2", 1, 43.47, 0.6707, 0.9765),
    ],
  },
];
