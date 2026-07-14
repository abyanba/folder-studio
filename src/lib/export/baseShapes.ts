/**
 * Base folder shapes, ported from public/legacy.html L385-421.
 *
 * Simple shapes carry an `svg` template with `__DEFS__`/`__COLOR__` placeholders
 * plus a `mask`. The four "solid-treatment" shapes (windows/macos/glass/
 * file-folder) instead carry a `buildSvg(cs)` generator that branches on
 * solid vs gradient fill. The legacy generators read the class state's
 * `colorMode`/`hue`/`sat`/`bri`/`gradStops`/`gradType`/`gradAngle`; here we adapt
 * the Phase-2 `folderColor` (hex or Gradient) into an equivalent
 * {@link ShapeColorState} — deriving HSV from a solid hex via `hexToHsv` so the
 * tint/shade math is preserved.
 */

import { getHex, hexToHsv } from "@/lib/color";
import { isGradient } from "@/types/gradient";
import type { ColorValue, Gradient, GradientStop } from "@/types/gradient";
import type {
  FolderDocument,
  FolderState,
  MacColorProfile,
  MacGradientAlgo,
  WindowsColorProfile,
  WindowsGradientAlgo,
  WindowsImageMode,
} from "@/types/document";
import {
  DEFAULT_MAC_COLOR_PROFILE,
  DEFAULT_MAC_GRADIENT_ALGO,
  DEFAULT_WINDOWS_COLOR_PROFILE,
  DEFAULT_WINDOWS_GRADIENT_ALGO,
} from "@/types/document";
import { gradientElement } from "./gradientSvg";

export interface ShapeColorState {
  mode: "solid" | "gradient";
  hue: number;
  sat: number;
  bri: number;
  stops: GradientStop[];
  gradType: "linear" | "radial";
  gradAngle: number;
  /** TEMPORARY: Windows gradient-fill treatment (defaults to the newest). */
  gradientAlgo?: WindowsGradientAlgo;
  /** TEMPORARY: Windows solid-fill color profile (defaults to `official`). */
  windowsColorProfile?: WindowsColorProfile;
  /** TEMPORARY: macOS solid-fill color profile (defaults to the newest). */
  macColorProfile?: MacColorProfile;
  /** TEMPORARY: macOS gradient-fill treatment (defaults to the newest). */
  macGradientAlgo?: MacGradientAlgo;
  /** Windows custom TAB color (solid or gradient); `null`/absent = derive from front. */
  backColor?: ColorValue | null;
  /** Folder fullness variant; `"contents"` adds the paper peek. */
  folderState?: FolderState;
  /** Windows custom PAPER color (solid or gradient); `null`/absent = white. */
  paperColor?: ColorValue | null;
}

export function toShapeColorState(folderColor: ColorValue): ShapeColorState {
  if (isGradient(folderColor)) {
    return {
      mode: "gradient",
      hue: 0,
      sat: 0,
      bri: 0,
      stops: folderColor.stops,
      gradType: folderColor.kind,
      gradAngle: folderColor.angle,
    };
  }
  const [hue, sat, bri] = hexToHsv(folderColor);
  return { mode: "solid", hue, sat, bri, stops: [], gradType: "linear", gradAngle: 0 };
}

export interface BaseShapeDef {
  id: string;
  name: string;
  svg?: string;
  mask: string;
  buildSvg?: (cs: ShapeColorState) => string;
  /** Solid HSV applied when the shape is picked (legacy `defaultH/S/B`). */
  defaultHsv: [h: number, s: number, v: number];
  /** clipToFolder applied when the shape is picked (legacy `defaultClip`). */
  defaultClip: boolean;
}

/** Screen-% gradient `<defs>` for the simple shapes' `__DEFS__` slot (id "fg"). */
function fgDefs(cs: ShapeColorState): string {
  const g: Gradient = { kind: cs.gradType, angle: cs.gradAngle, stops: cs.stops };
  return `<defs>${gradientElement("fg", g)}</defs>`;
}

const SVG_OPEN = '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">';

/** Legacy-style linear/radial gradient element from explicit color stops (angle-90 convention). */
function gradientDef(
  id: string,
  gradType: "linear" | "radial",
  gradAngle: number,
  colorStops: Array<{ pos: number; hex: string }>,
): string {
  const ss = colorStops
    .map((s) => `<stop offset="${Math.round(s.pos * 100)}%" stop-color="${s.hex}"/>`)
    .join("");
  if (gradType === "linear") {
    const r = ((gradAngle - 90) * Math.PI) / 180;
    return `<linearGradient id="${id}" x1="${(50 - Math.cos(r) * 50).toFixed(1)}%" y1="${(50 - Math.sin(r) * 50).toFixed(1)}%" x2="${(50 + Math.cos(r) * 50).toFixed(1)}%" y2="${(50 + Math.sin(r) * 50).toFixed(1)}%">${ss}</linearGradient>`;
  }
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${ss}</radialGradient>`;
}

/** The user's gradient as an SVG gradient element (stops painted verbatim). */
function complexGradient(id: string, cs: ShapeColorState): string {
  const stops = [...cs.stops].sort((a, b) => a.pos - b.pos);
  return gradientDef(
    id,
    cs.gradType,
    cs.gradAngle,
    stops.map((s) => ({ pos: s.pos, hex: getHex(s.hue, s.sat, s.bri) })),
  );
}

/**
 * Windows folder color model: interpolates the pixel-measured palettes of six
 * official reference icons (see {@link WIN_ANCHORS}) rather than fitting
 * formulas. Structure shared by every render: a darker back panel (tab + top
 * strip + bottom rim) on its own near-vertical gradient, a diagonal front
 * gradient (light → deep), and a white shine along the front's top edge
 * fading left→right.
 */
const WIN_T = "M7.5293 46.3813V209.387C7.5293 216.354 13.1771 222.002 20.144 222.002H235.856C242.823 222.002 248.47 216.354 248.47 209.387V72.1068C248.47 65.1399 242.823 59.4921 235.856 59.4921H122.637C117.732 59.4921 113.291 56.6298 110.725 52.45C106.05 44.8336 97.6208 33.7666 88.1058 33.7666H20.1243C13.1574 33.7666 7.5293 39.4144 7.5293 46.3813Z";
const WIN_B = "M248.47 76.97V205.152C248.47 212.119 242.823 217.767 235.856 217.767H20.144C13.1771 217.767 7.5293 212.119 7.5293 205.152V89.7409C7.5293 82.774 13.1585 77.1262 20.1254 77.1262H83.8484C105.293 77.1262 102.297 64.3542 116.962 64.3548C156.973 64.3567 211.551 64.3557 235.877 64.3552C242.844 64.355 248.47 70.0029 248.47 76.97Z";
/** The front panel's top contour (left corner → tab swoop → right corner) as an open path. */
const WIN_B_TOP = "M7.5293 89.7409C7.5293 82.774 13.1585 77.1262 20.1254 77.1262H83.8484C105.293 77.1262 102.297 64.3542 116.962 64.3548C156.973 64.3567 211.551 64.3557 235.877 64.3552C242.844 64.355 248.47 70.0029 248.47 76.97";

/**
 * Back-panel gradient (`wbg`) on its measured near-vertical axis. `topStops`
 * paint the tab (positions ≤ ~0.24, where the tab is visible above the front),
 * and `rim` is the front-derived bottom edge, held flat from 0.85 down. The
 * tab→rim transition falls in the middle, which the front panel hides — so a
 * custom tab of any hue stays clean while the rim always matches the front.
 */
function windowsBackGradientEl(topStops: Array<{ pos: number; hex: string }>, rim: string): string {
  const ss = [...topStops, { pos: 0.85, hex: rim }]
    .map((s) => `<stop${s.pos > 0 ? ` offset="${+s.pos.toFixed(4)}"` : ""} stop-color="${s.hex}"/>`)
    .join("");
  return `<linearGradient id="wbg" x1="24" y1="34" x2="80" y2="209" gradientUnits="userSpaceOnUse">${ss}</linearGradient>`;
}

/** Two-stop back gradient (tab → rim). Shorthand for the derived (Auto) back. */
function windowsBackGradient(top: string, bottom: string): string {
  return windowsBackGradientEl([{ pos: 0, hex: top }], bottom);
}

/** The rendered back panel: the `wbg` (and any tab) `<defs>` plus the path(s) that paint them. */
interface WindowsBack {
  defs: string;
  paths: string;
}

/** The default back paint — the whole back silhouette filled with `wbg`. */
const WIN_BACK_PATH = `<path d="${WIN_T}" fill="url(#wbg)"/>`;

/** Wrap a lone `wbg` def into the standard single-path back. */
function backSingle(defs: string): WindowsBack {
  return { defs, paths: WIN_BACK_PATH };
}

/**
 * Bounding box of the visible back tab (top-left swoop), used as the
 * userSpaceOnUse frame for an angle-respecting custom-tab gradient.
 */
const WIN_TAB_BBOX = { x0: 7.5293, y0: 33.7666, x1: 116.962, y1: 77.1262 };

/**
 * A linear gradient (`id`) that respects the user's `angle`, laid over a
 * bounding box in user space (radial is intentionally unsupported here). Used
 * for the custom tab and the custom paper — both thin regions where an
 * objectBoundingBox gradient over the whole path would be mostly hidden.
 */
function angleGradientEl(
  id: string,
  angle: number,
  stops: GradientStop[],
  bbox: { x0: number; y0: number; x1: number; y1: number },
): string {
  const { x0, y0, x1, y1 } = bbox;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2;
  const hh = (y1 - y0) / 2;
  const r = ((angle - 90) * Math.PI) / 180;
  const ax1 = (cx - Math.cos(r) * hw).toFixed(2);
  const ay1 = (cy - Math.sin(r) * hh).toFixed(2);
  const ax2 = (cx + Math.cos(r) * hw).toFixed(2);
  const ay2 = (cy + Math.sin(r) * hh).toFixed(2);
  const ss = [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `<stop offset="${+s.pos.toFixed(4)}" stop-color="${getHex(s.hue, s.sat, s.bri)}"/>`)
    .join("");
  return `<linearGradient id="${id}" x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" gradientUnits="userSpaceOnUse">${ss}</linearGradient>`;
}

/**
 * Build the rendered back panel. The rim (bottom stop) is ALWAYS the
 * front-derived `rim`; the tab (top) is either the front-derived `autoTop`
 * (Auto) or the custom `backColor`. A solid custom tab keeps its own subtle
 * top→shine darkening on the near-vertical axis. A gradient custom tab is
 * painted on its own angle-respecting axis over the tab's bounding box, above a
 * front-derived rim base and clipped to the top strip — so the tab honors its
 * angle while the rim stays grouped with the front.
 */
function windowsBackDef(autoTop: string, rim: string, backColor?: ColorValue | null): WindowsBack {
  if (!backColor) return backSingle(windowsBackGradientEl([{ pos: 0, hex: autoTop }], rim));
  if (isGradient(backColor)) {
    // Clip to the top strip: the front panel begins ~y90 at its left corner, so
    // the whole visible tab is above there and everything below is front-covered
    // (leaving only the front-derived rim base showing at the bottom sliver).
    const defs =
      windowsBackGradientEl([{ pos: 0, hex: rim }], rim) +
      angleGradientEl("wtg", backColor.angle, backColor.stops, WIN_TAB_BBOX) +
      `<clipPath id="wtc"><rect x="0" y="0" width="256" height="92"/></clipPath>`;
    return {
      defs,
      paths: `${WIN_BACK_PATH}<path d="${WIN_T}" fill="url(#wtg)" clip-path="url(#wtc)"/>`,
    };
  }
  const [h, s, v] = hexToHsv(backColor);
  return backSingle(
    windowsBackGradientEl([{ pos: 0, hex: backColor }, { pos: 0.24, hex: getHex(h, s, v * 0.9) }], rim),
  );
}

/**
 * The "with contents" paper sheet — a sheet tucked into the folder that peeks
 * out as a thin band between the tab and the front panel (left side). Measured
 * off the official "Default with Contents.ico": a flat top edge at y≈63 spans
 * from x≈20, and the top-right edge slopes DOWN to a point (~x120,y74) so the
 * peek tapers cleanly along the front panel's rising top edge (`WIN_B_TOP`)
 * instead of ending in a stub that pokes above the slope. The rest extends down
 * behind the front panel, which clips it. Drawn between the back and front.
 */
const WIN_PAPER = "M24 66H110L122 70V150H20V70Q20 66 24 66Z";
/** The visible band of the paper, used to frame a custom paper gradient. */
const WIN_PAPER_BBOX = { x0: 20, y0: 66, x1: 122, y1: 78 };

/** Paper `<defs>` + path for the contents variant (`null` color = white sheet). */
function windowsPaperDef(paperColor?: ColorValue | null): { defs: string; path: string } {
  const path = (fill: string): string => `<path d="${WIN_PAPER}" fill="${fill}"/>`;
  if (paperColor == null) {
    // Default: a near-white sheet with a faint cool top→bottom shading, so the
    // peek reads as paper without depending on the folder color.
    return {
      defs: `<linearGradient id="wpp" x1="0" y1="66" x2="0" y2="86" gradientUnits="userSpaceOnUse"><stop stop-color="#f7f8fa"/><stop offset="1" stop-color="#e7e9ec"/></linearGradient>`,
      path: path("url(#wpp)"),
    };
  }
  if (isGradient(paperColor)) {
    return {
      defs: angleGradientEl("wpp", paperColor.angle, paperColor.stops, WIN_PAPER_BBOX),
      path: path("url(#wpp)"),
    };
  }
  return { defs: "", path: path(paperColor) };
}

/** The paper markup for a document's fill state (empty ⇒ none). */
function windowsPaper(cs: ShapeColorState): { defs: string; path: string } {
  if (cs.folderState !== "contents") return { defs: "", path: "" };
  return windowsPaperDef(cs.paperColor);
}

/**
 * Shine defs (white L→R fade + clip to the front panel) and the stroked edge.
 * `alpha` is the left-edge strength; it fades to 12% of itself at the right,
 * matching the official ~0.30→0.03 falloff. Width 7 ≈ the official 4px band
 * (half the stroke clips away inside the front panel).
 */
function winShineDefs(alpha: number, width: number): { defs: string; shine: string } {
  const a1 = alpha.toFixed(3);
  const a2 = (alpha * 0.12).toFixed(3);
  return {
    defs: `<linearGradient id="wsh" x1="7.5293" y1="0" x2="248.47" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff" stop-opacity="${a1}"/><stop offset="1" stop-color="#ffffff" stop-opacity="${a2}"/></linearGradient><clipPath id="wfc"><path d="${WIN_B}"/></clipPath>`,
    shine: `<path d="${WIN_B_TOP}" fill="none" stroke="url(#wsh)" stroke-width="${width}" clip-path="url(#wfc)"/>`,
  };
}

/* ------------------------------------------------------------------------ *
 * Reference-anchored interpolation.
 *
 * Instead of formulas, the algorithm carries the *measured palettes* of the
 * official reference icons and interpolates between them (inverse-distance
 * weighting in HSV-cone space, blending each entry's Δhue/Δsat/Δvalue
 * relative to the anchor's input color). Picking a reference color reproduces
 * its official icon exactly; everything else lands between its nearest
 * references.
 * ------------------------------------------------------------------------ */

type Hsv3 = readonly [h: number, s: number, v: number];

interface WinAnchor {
  /** The folder color a user would pick to mean this reference. */
  input: Hsv3;
  /** Front gradient's light stop. */
  light: Hsv3;
  /** Front gradient's deep stop (defaults to `input`). */
  deep?: Hsv3;
  /** Back-panel gradient top (tab). Absent → anchor doesn't vote on the back. */
  backTop?: Hsv3;
  /** Back-panel gradient bottom (rim). */
  backRim?: Hsv3;
  /** Shine strength at the left edge. Absent → doesn't vote on shine. */
  shine?: number;
}

/**
 * The six official reference icons (user-designated): Default → #ffc430,
 * Default Black → black, Gray, Custom Google Drive → white, Green, and
 * Custom Mega Folder → red. Values pixel-sampled from the 256px images.
 */
const WIN_ANCHORS: WinAnchor[] = [
  // Default.ico @ #ffc430
  { input: [42.9, 0.812, 1], light: [45, 0.38, 1], deep: [44, 0.784, 1], backTop: [43, 0.906, 1], backRim: [41, 0.826, 0.902], shine: 0.30 },
  // Default Black.ico @ #000000
  { input: [0, 0, 0], light: [0, 0, 0.349], deep: [0, 0, 0.263], backTop: [0, 0, 0.235], backRim: [0, 0, 0.227], shine: 0.05 },
  // Gray.ico
  { input: [208, 0.098, 0.6], light: [208, 0.071, 0.831], backTop: [208, 0.102, 0.498], backRim: [210, 0.093, 0.337], shine: 0.29 },
  // Custom Google Drive.ico @ #ffffff
  { input: [0, 0, 1], light: [0, 0, 0.914], deep: [0, 0, 0.816], backTop: [0, 0, 0.769], backRim: [0, 0, 0.698], shine: 0.23 },
  // Green.ico
  { input: [185, 1, 0.647], light: [157, 0.746, 0.788], backTop: [162, 0.962, 0.51], backRim: [185, 0.874, 0.373], shine: 0.29 },
  // Custom Mega Folder.ico @ #eb0400
  { input: [1, 1, 0.922], light: [2, 0.633, 0.898], backTop: [0, 1, 0.831], backRim: [357, 1, 0.8], shine: 0.18 },
];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Signed shortest angular distance `from → to` in degrees. */
function circDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** HSV → a 3D point where euclidean distance behaves (chroma disc × value). */
function coneXYZ([h, s, v]: Hsv3): [number, number, number] {
  const r = (h * Math.PI) / 180;
  return [s * v * Math.cos(r), s * v * Math.sin(r), v];
}

/** Inverse-square-distance weights of `q` against each anchor's input. */
function anchorWeights(q: Hsv3, anchors: WinAnchor[]): number[] {
  const [x, y, z] = coneXYZ(q);
  return anchors.map((a) => {
    const [ax, ay, az] = coneXYZ(a.input);
    const d2 = (x - ax) ** 2 + (y - ay) ** 2 + (z - az) ** 2;
    return 1 / (d2 + 1e-6);
  });
}

/**
 * Blend one palette entry: the weighted mean of each voting anchor's
 * Δh/Δs/Δv (its entry relative to its input) applied to the query color.
 * Anchors missing the entry abstain and the weights renormalize.
 */
function blendEntry(
  q: Hsv3,
  anchors: WinAnchor[],
  weights: number[],
  pick: (a: WinAnchor) => Hsv3 | undefined,
): Hsv3 {
  let wSum = 0;
  let dh = 0;
  let ds = 0;
  let dv = 0;
  anchors.forEach((a, i) => {
    const e = pick(a);
    if (!e) return;
    const w = weights[i];
    wSum += w;
    // Hue deltas only mean something when both ends are chromatic.
    if (a.input[1] > 0.05 && e[1] > 0.05) dh += w * circDelta(a.input[0], e[0]);
    ds += w * (e[1] - a.input[1]);
    dv += w * (e[2] - a.input[2]);
  });
  if (wSum === 0) return q;
  return [
    (q[0] + dh / wSum + 360) % 360,
    clamp01(q[1] + ds / wSum),
    clamp01(q[2] + dv / wSum),
  ];
}

/** Blend the scalar shine strength over the anchors that define one. */
function blendShine(anchors: WinAnchor[], weights: number[]): number {
  let wSum = 0;
  let sum = 0;
  anchors.forEach((a, i) => {
    if (a.shine == null) return;
    wSum += weights[i];
    sum += weights[i] * a.shine;
  });
  return wSum === 0 ? 0.25 : sum / wSum;
}

const hsvHex = (c: Hsv3): string => getHex(c[0], c[1], c[2]);

/** Interpolate two HSV colors, hue along the shortest arc. */
function mixHsv(a: Hsv3, b: Hsv3, t: number): Hsv3 {
  const h = (a[0] + circDelta(a[0], b[0]) * t + 360) % 360;
  return [h, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Weighted mean of HSV colors in chroma-vector space (handles circular hue). */
function weightedMeanHsv(items: Array<{ hsv: Hsv3; w: number }>): Hsv3 {
  let x = 0;
  let y = 0;
  let v = 0;
  let wSum = 0;
  for (const it of items) {
    const r = (it.hsv[0] * Math.PI) / 180;
    x += it.w * it.hsv[1] * Math.cos(r);
    y += it.w * it.hsv[1] * Math.sin(r);
    v += it.w * it.hsv[2];
    wSum += it.w;
  }
  if (wSum === 0) return [0, 0, 0];
  x /= wSum;
  y /= wSum;
  let h = (Math.atan2(y, x) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [h, Math.min(1, Math.hypot(x, y)), v / wSum];
}

/** Anchored front light/deep stops (HSV) for a base color. */
function anchoredFront(hsv: Hsv3): { light: Hsv3; deep: Hsv3 } {
  const w = anchorWeights(hsv, WIN_ANCHORS);
  return {
    light: blendEntry(hsv, WIN_ANCHORS, w, (a) => a.light),
    deep: blendEntry(hsv, WIN_ANCHORS, w, (a) => a.deep ?? a.input),
  };
}

/** Anchored back tab/rim stops (HSV) for a base color. */
function anchoredBack(hsv: Hsv3): { top: Hsv3; rim: Hsv3 } {
  const w = anchorWeights(hsv, WIN_ANCHORS);
  return {
    top: blendEntry(hsv, WIN_ANCHORS, w, (a) => a.backTop),
    rim: blendEntry(hsv, WIN_ANCHORS, w, (a) => a.backRim),
  };
}

/** Full anchored palette (HSV) for a solid base color. */
function windowsAnchoredPaletteHsv(
  h: number,
  s: number,
  v: number,
  anchors: WinAnchor[],
): { light: Hsv3; deep: Hsv3; backTop: Hsv3; backRim: Hsv3; shine: number } {
  const q: Hsv3 = [h, s, v];
  const w = anchorWeights(q, anchors);
  return {
    light: blendEntry(q, anchors, w, (a) => a.light),
    deep: blendEntry(q, anchors, w, (a) => a.deep ?? a.input),
    backTop: blendEntry(q, anchors, w, (a) => a.backTop),
    backRim: blendEntry(q, anchors, w, (a) => a.backRim),
    shine: blendShine(anchors, w),
  };
}

/** Full anchored palette (hex) for a solid base color. */
function windowsAnchoredPalette(
  h: number,
  s: number,
  v: number,
  anchors: WinAnchor[],
): { light: string; deep: string; backTop: string; backRim: string; shine: number } {
  const p = windowsAnchoredPaletteHsv(h, s, v, anchors);
  return {
    light: hsvHex(p.light),
    deep: hsvHex(p.deep),
    backTop: hsvHex(p.backTop),
    backRim: hsvHex(p.backRim),
    shine: p.shine,
  };
}

/**
 * Windows solid color profiles. `official` reproduces the anchored reference
 * front verbatim (the historically chosen look); the others re-blend the front
 * toward the picked color the same way the macOS profiles do — punchier
 * saturation for `popped`, a middle for `best`, and a single flat front for
 * `flat`. The tab and rim always stay the anchored structure, so the folder
 * reads correctly in every profile; only the front changes.
 */
function windowsProfiledFront(
  profile: WindowsColorProfile,
  h: number,
  s: number,
  v: number,
  light: Hsv3,
  deep: Hsv3,
): { light: Hsv3; deep: Hsv3 } {
  const user: Hsv3 = [h, s, v];
  if (profile === "flat") return { light: user, deep: user };
  // How much of the picked saturation to restore over the washed anchored front.
  const t = profile === "popped" ? 0.8 : profile === "best" ? 0.45 : 0;
  if (t === 0) return { light, deep }; // official — verbatim
  const restore = (c: Hsv3, k: number): Hsv3 => [c[0], lerp(c[1], Math.min(1, s), k), c[2]];
  return { light: restore(light, t), deep: restore(deep, t * 0.85) };
}

/** Assemble the windows SVG from a front light/deep, a back def (`wbg`) and shine. */
function windowsAssemble(
  light: string,
  deep: string,
  back: WindowsBack,
  shineAlpha: number,
  shineWidth: number,
  paper: { defs: string; path: string } = { defs: "", path: "" },
): string {
  const front = `<linearGradient id="wg" x1="7.5293" y1="33.7666" x2="271.437" y2="180.773" gradientUnits="userSpaceOnUse"><stop offset="0.234375" stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></linearGradient>`;
  const sh = winShineDefs(shineAlpha, shineWidth);
  return `${SVG_OPEN}<defs>${back.defs}${paper.defs}${front}${sh.defs}</defs>${back.paths}${paper.path}<path d="${WIN_B}" fill="url(#wg)"/>${sh.shine}</svg>`;
}

/** Compose the windows SVG from a front `<gradient>` def (`wg`), a back panel and shine. */
function windowsGradientSvg(
  frontDef: string,
  back: WindowsBack,
  shineAlpha: number,
  paper: { defs: string; path: string } = { defs: "", path: "" },
): string {
  const sh = winShineDefs(shineAlpha, 6);
  return `${SVG_OPEN}<defs>${back.defs}${paper.defs}${frontDef}${sh.defs}</defs>${back.paths}${paper.path}<path d="${WIN_B}" fill="url(#wg)"/>${sh.shine}</svg>`;
}

/**
 * Gradient-fill windows render. The front is ALWAYS the user's gradient (the
 * official gradient folders keep it verbatim); the profiles differ in the back
 * panel and shine (see {@link WindowsGradientAlgo}).
 */
function buildWindowsGradient(cs: ShapeColorState): string {
  const algo = cs.gradientAlgo ?? DEFAULT_WINDOWS_GRADIENT_ALGO;
  const stops = [...cs.stops].sort((a, b) => a.pos - b.pos);
  const stopHsv = stops.map((s) => ({ pos: s.pos, hsv: [s.hue, s.sat, s.bri] as Hsv3 }));
  const first = stopHsv[0].hsv;
  const last = stopHsv[stopHsv.length - 1].hsv;
  const frontRaw = complexGradient("wg", cs);
  const paper = windowsPaper(cs);

  if (cs.backColor) {
    // Custom tab overrides the profile-derived tab (front stays the user's
    // gradient); the rim stays front-derived (deepest stop's anchored rim).
    const p = windowsAnchoredPalette(last[0], last[1], last[2], WIN_ANCHORS);
    const back = windowsBackDef(p.backTop, p.backRim, cs.backColor);
    const shine = blendShine(WIN_ANCHORS, anchorWeights(last, WIN_ANCHORS));
    return windowsGradientSvg(frontRaw, back, shine * 0.8, paper);
  }

  if (algo === "current") {
    // Uniform back from the deepest stop's anchored palette (matches Aqua).
    const p = windowsAnchoredPalette(last[0], last[1], last[2], WIN_ANCHORS);
    return windowsGradientSvg(frontRaw, backSingle(windowsBackGradient(p.backTop, p.backRim)), p.shine * 0.8, paper);
  }

  if (algo === "lit") {
    // Front pushed through the anchored light→deep envelope, per stop.
    const litStops = stopHsv.map((s) => {
      const { light, deep } = anchoredFront(s.hsv);
      return { pos: s.pos, hex: hsvHex(mixHsv(light, deep, s.pos)) };
    });
    const front = gradientDef("wg", cs.gradType, cs.gradAngle, litStops);
    const p = windowsAnchoredPalette(last[0], last[1], last[2], WIN_ANCHORS);
    return windowsGradientSvg(front, backSingle(windowsBackGradient(p.backTop, p.backRim)), p.shine * 0.8, paper);
  }

  if (algo === "echo") {
    // Back echoes the whole front gradient, darkened + more saturated by a
    // fixed formula (matches 3D Objects; sat ×1.3, value ×0.66).
    const backStops = stopHsv.map((s) => ({
      pos: s.pos,
      hex: hsvHex([s.hsv[0], Math.min(1, s.hsv[1] * 1.3), s.hsv[2] * 0.66]),
    }));
    const back = gradientDef("wbg", cs.gradType, cs.gradAngle, backStops);
    const shine = blendShine(WIN_ANCHORS, anchorWeights(first, WIN_ANCHORS));
    return windowsGradientSvg(frontRaw, backSingle(back), shine * 0.8, paper);
  }

  // best — the back echoes the front gradient via the anchored *reference*
  // back treatment (each stop → its tab/rim colors, ramped top→bottom), with a
  // shine tuned from the whole gradient weighted toward its deep end.
  const backStops = stopHsv.map((s) => {
    const { top, rim } = anchoredBack(s.hsv);
    return { pos: s.pos, hex: hsvHex(mixHsv(top, rim, s.pos)) };
  });
  const back = gradientDef("wbg", cs.gradType, cs.gradAngle, backStops);
  const rep = weightedMeanHsv(stopHsv.map((s) => ({ hsv: s.hsv, w: s.pos * s.pos + 0.15 })));
  const shine = blendShine(WIN_ANCHORS, anchorWeights(rep, WIN_ANCHORS));
  return windowsGradientSvg(frontRaw, backSingle(back), shine * 0.8, paper);
}

/**
 * The windows render. Solid fills interpolate the full anchored palette;
 * gradient fills dispatch on the temporary gradient tweak.
 */
function buildWindowsSvg(cs: ShapeColorState): string {
  if (cs.mode === "solid") {
    const p = windowsAnchoredPaletteHsv(cs.hue, cs.sat, cs.bri, WIN_ANCHORS);
    const profile = cs.windowsColorProfile ?? DEFAULT_WINDOWS_COLOR_PROFILE;
    const front = windowsProfiledFront(profile, cs.hue, cs.sat, cs.bri, p.light, p.deep);
    // A custom tab overrides only the tab; the rim stays front-derived. Shine
    // softer than the measured left-edge strength.
    const backDef = windowsBackDef(hsvHex(p.backTop), hsvHex(p.backRim), cs.backColor);
    return windowsAssemble(
      hsvHex(front.light),
      hsvHex(front.deep),
      backDef,
      p.shine * 0.8,
      6,
      windowsPaper(cs),
    );
  }
  return buildWindowsGradient(cs);
}

/** Windows gradient color profiles, surfaced as a dropdown in the folder Gradient section. */
export const WINDOWS_GRADIENT_ALGOS: Array<{ id: WindowsGradientAlgo; name: string }> = [
  { id: "best", name: "Refined" },
  { id: "echo", name: "Echo" },
  { id: "current", name: "Deep tab" },
  { id: "lit", name: "Lit front" },
];

/** Human-readable name of a Windows gradient color profile. */
export function windowsGradientAlgoName(id: WindowsGradientAlgo): string {
  return WINDOWS_GRADIENT_ALGOS.find((a) => a.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------------ *
 * macOS folder geometry (shared by its `buildSvg` and the paper-peek layer).
 * `MAC_F` is the outer/back panel (with the tab), `MAC_B` the lighter front
 * face drawn on top; `MAC_S1`/`MAC_S2` the two bottom highlight lines.
 * ------------------------------------------------------------------------ */
const MAC_F = "M39.3 228.5H216.7C226.781 228.5 231.821 228.5 235.672 226.538C239.059 224.812 241.812 222.059 243.538 218.672C245.5 214.821 245.5 209.781 245.5 199.7V78.3C245.5 68.2191 245.5 63.1786 243.538 59.3282C241.812 55.9413 239.059 53.1876 235.672 51.4619C231.821 49.5 226.781 49.5 216.7 49.5H119.375C114 49.5 107.125 49 100.375 43.875C93.625 38.75 99.375 43.125 92.25 37.625C85.125 32.125 81.4915 31 75.25 31H39.3C29.2191 31 24.1786 31 20.3282 32.9619C16.9413 34.6876 14.1876 37.4413 12.4619 40.8282C10.5 44.6786 10.5 49.7191 10.5 59.8V199.7C10.5 209.781 10.5 214.821 12.4619 218.672C14.1876 222.059 16.9413 224.812 20.3282 226.538C24.1786 228.5 29.2191 228.5 39.3 228.5Z";
const MAC_B = "M10.5 93.3C10.5 83.2191 10.5 78.1786 12.4619 74.3282C14.1876 70.9413 16.9413 68.1876 20.3282 66.4619C24.1786 64.5 29.2191 64.5 39.3 64.5H216.7C226.781 64.5 231.821 64.5 235.672 66.4619C239.059 68.1876 241.812 70.9413 243.538 74.3282C245.5 78.1786 245.5 83.2191 245.5 93.3V199.7C245.5 209.781 245.5 214.821 243.538 218.672C241.812 222.059 239.059 224.812 235.672 226.538C231.821 228.5 226.781 228.5 216.7 228.5H39.3C29.2191 228.5 24.1786 228.5 20.3282 226.538C16.9413 224.812 14.1876 222.059 12.4619 218.672C10.5 214.821 10.5 209.781 10.5 199.7V93.3Z";
const MAC_S1 = "M10.5 204H245.5V208.5H10.5V204Z";
const MAC_S2 = "M10.5 213.25H245.5V217.75H10.5V213.25Z";

/**
 * macOS paper sheet — a near-full-width sheet peeking as a thin strip between
 * the tab and the front face (`MAC_B`). Measured off `folder-w-file.icns`
 * (top edge y≈58, spanning x≈18→238); it extends down behind the front face.
 */
const MAC_PAPER = "M22 57H234Q240 57 240 63V120H16V63Q16 57 22 57Z";
const MAC_PAPER_BBOX = { x0: 16, y0: 57, x1: 240, y1: 78 };

/** Paper `<defs>` + path for the macOS contents variant (`null` = white sheet). */
function macPaperDef(paperColor?: ColorValue | null): { defs: string; path: string } {
  const path = (fill: string): string => `<path d="${MAC_PAPER}" fill="${fill}"/>`;
  if (paperColor == null) {
    return {
      defs: `<linearGradient id="mpp" x1="0" y1="57" x2="0" y2="82" gradientUnits="userSpaceOnUse"><stop stop-color="#f7f8fa"/><stop offset="1" stop-color="#e7e9ec"/></linearGradient>`,
      path: path("url(#mpp)"),
    };
  }
  if (isGradient(paperColor)) {
    return { defs: angleGradientEl("mpp", paperColor.angle, paperColor.stops, MAC_PAPER_BBOX), path: path("url(#mpp)") };
  }
  return { defs: "", path: path(paperColor) };
}

/**
 * Inline macOS paper markup (defs + a self-clipped group) for the color/gradient
 * `buildSvg`. Self-clips to the tab strip (`MAC_F` minus `MAC_B`) and is drawn
 * last, so it peeks above the front face regardless of the fill. `""` when empty.
 */
function macPaperMarkup(cs: ShapeColorState): string {
  if (cs.folderState !== "contents") return "";
  const paper = macPaperDef(cs.paperColor);
  return `${paper.defs}<mask id="mpm"><path d="${MAC_F}" fill="white"/><path d="${MAC_B}" fill="black"/></mask><g mask="url(#mpm)">${paper.path}</g>`;
}

/* ------------------------------------------------------------------------ *
 * macOS color model.
 *
 * Derived by pixel-sampling Apple's recolored folder `.icns` set. Every folder
 * shares one structure: a deep, saturated back panel (the tab), a bright, mostly
 * flat front face, a slightly deeper band at the face bottom, and a subtle
 * double emboss (two brighter ridges + two darker grooves) just above the
 * bottom edge — tinted to the base color, never pure white. The chromatic
 * recolors follow a fixed envelope (face S≈0.54 V≈0.98, tab S≈0.89 V≈0.82,
 * bottom S≈0.66 V≈0.91); neutrals hold S=0 and scale by value. The profiles
 * below re-expose that envelope with different amounts of the picked color.
 * ------------------------------------------------------------------------ */

/** The visible front-face top edge (the fold line under the tab). */
const MAC_SEAM = "M42 65.2H214";

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** How chromatic a pick reads (0 at neutral, 1 by S≈0.35). Gates hue-only shifts. */
const macChromaMix = (s: number): number => clamp01(s / 0.35);
/**
 * Hue-dependent chroma trim on the official envelope. Apple desaturates
 * yellow-green folders (measured face S≈0.47 vs ≈0.54 elsewhere); a gentle dip
 * centred near 52° reproduces that without touching other hues.
 */
function macHueChroma(h: number): number {
  const d = Math.abs(circDelta(h, 52)) / 34;
  return 1 - 0.15 * Math.exp(-d * d);
}

interface MacPalette {
  /** Flat front-face body color. */
  face: Hsv3;
  /** Back panel / tab color (deeper + more saturated). */
  tab: Hsv3;
  /** Deeper band at the face's bottom edge. */
  bottom: Hsv3;
  /** Double-rim emboss strength (0 = none). */
  emboss: number;
}

/**
 * Per-profile front-value floor: a solid fill never darkens the front face
 * below this, so it can't reach true black (the official black folder itself
 * bottoms out at V≈0.14). Pure black stays reachable via the flat profile and
 * gradient fills, which don't pass through here.
 */
const MAC_BLACK_FLOOR: Record<Exclude<MacColorProfile, "flat">, number> = {
  official: 0.14, // matches the sampled official black folder
  best: 0.12,
  popped: 0.1, // punchiest → allowed the darkest
};

/**
 * Absolute value floor for any painted solid stop (tab, emboss groove, bottom).
 * The per-profile face floor keeps the body off true black; this keeps the
 * darker structure (which sits below the body) off it too. Not applied to the
 * flat profile or gradient front, where pure black stays reachable.
 */
const MAC_MIN_V = 0.07;

/** Apple's authentic recolor envelope: saturation capped, forced bright, deep tab. */
function macOfficialPalette(h: number, s: number, v: number): MacPalette {
  const cm = macChromaMix(s);
  const kc = cm * macHueChroma(h); // chroma envelope, hue-trimmed near yellow
  const faceV = Math.max(lerp(v, 0.98, cm), MAC_BLACK_FLOOR.official); // never true black
  return {
    face: [h, 0.54 * kc, faceV], // the washed official cap
    tab: [h, Math.min(1, 0.89 * kc), faceV * 0.82],
    bottom: [h, Math.min(1, 0.66 * kc), faceV * 0.93],
    emboss: 1,
  };
}

/** Keeps the picked color's saturation for a punchier, less washed folder. */
function macPoppedPalette(h: number, s: number, v: number): MacPalette {
  const cm = macChromaMix(s);
  const faceS = Math.min(1, s * 1.08);
  const faceV = Math.max(lerp(v, 0.97, cm * 0.9), MAC_BLACK_FLOOR.popped);
  return {
    face: [h, faceS, faceV],
    tab: [h, Math.min(1, faceS + 0.28 * cm), faceV * 0.78],
    bottom: [h, Math.min(1, faceS + 0.12 * cm), faceV * 0.9],
    emboss: 1.2,
  };
}

/** Authentic depth + emboss, but retains more of the picked color than official. */
function macBestPalette(h: number, s: number, v: number): MacPalette {
  const cm = macChromaMix(s);
  const faceS = Math.min(1, lerp(0.54 * cm, Math.min(1, s), 0.55));
  const faceV = Math.max(lerp(v, 0.97, cm * 0.85), MAC_BLACK_FLOOR.best);
  return {
    face: [h, faceS, faceV],
    tab: [h, Math.min(1, faceS + 0.33 * cm), faceV * 0.81],
    bottom: [h, Math.min(1, faceS + 0.13 * cm), faceV * 0.92],
    emboss: 1.1,
  };
}

/**
 * The tab color for a *front-only image* macOS folder — derived from a photo's
 * dominant color, not a picked one. The solid-fill palettes ({@link macBestPalette}
 * et al.) deliberately keep/boost the picked color's saturation so a blue folder
 * reads as a vivid Apple blue; against a photo that boost turns the tab electric.
 * This mutes the dominant toward the same restrained register the Windows image
 * tab uses (reference-anchored, `S≈0.45`, mid value), so the two shapes match.
 * Neutrals (`S≈0`) stay neutral and just track the image's value.
 */
function macImageTab(h: number, s: number, v: number): Hsv3 {
  const cm = macChromaMix(s); // 0 at neutral → no chroma; 1 by S≈0.35
  const S = Math.min(1, 0.46 * cm * macHueChroma(h));
  const V = Math.max(MAC_BLACK_FLOOR.best, lerp(v, 0.66, cm * 0.7));
  return [h, S, V];
}

function macPalette(profile: MacColorProfile, h: number, s: number, v: number): MacPalette {
  switch (profile) {
    case "official":
      return macOfficialPalette(h, s, v);
    case "popped":
      return macPoppedPalette(h, s, v);
    default:
      return macBestPalette(h, s, v);
  }
}

/**
 * The front face as one vertical gradient: a thin shadow under the tab lip, a
 * flat bright body, then the double emboss (ridge/groove/ridge/groove) resolving
 * into the deeper bottom band. Emboss saturation shifts scale with the body's
 * own saturation so neutrals stay neutral (only value moves); value shifts apply
 * always, which is what makes the emboss read on a white folder.
 */
function macFaceGradient(pal: MacPalette): string {
  const [h, Sb, Vb] = pal.face;
  const [, Sbot, Vbot] = pal.bottom;
  const ss = Math.min(1.2, Sb / 0.5); // scale emboss ΔS by body saturation
  const e = pal.emboss;
  const c = (s: number, vv: number): string =>
    getHex(h, clamp01(s), Math.max(MAC_MIN_V, clamp01(vv))); // never true black
  const body = c(Sb, Vb);
  const stops: Array<[number, string]> = [
    [0, c(Sb + 0.05 * ss, Vb - 0.04)], // shadow under the tab lip
    [0.05, body],
    [0.79, body],
    [0.826, c(Sb - 0.045 * ss * e, Vb - 0.012 * e)], // ridge 1
    [0.854, c(Sb + 0.05 * ss * e, Vb - 0.05 * e)], // groove 1
    [0.884, c(Sb + 0.0, Vb - 0.032 * e)], // ridge 2
    [0.907, c(Sb + 0.09 * ss * e, Vb - 0.082 * e)], // groove 2
    [0.945, c(lerp(Sb, Sbot, 0.6), lerp(Vb, Vbot, 0.6))],
    [1, c(Sbot, Vbot)],
  ];
  const ss2 = stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join("");
  return `<linearGradient id="mgf" x1="128" y1="64.5" x2="128" y2="228.5" gradientUnits="userSpaceOnUse">${ss2}</linearGradient>`;
}

/** The tab as a near-flat vertical gradient (barely lighter at its top). */
function macTabGradient(tab: Hsv3): string {
  const [h, St, Vt] = tab;
  const light = getHex(h, clamp01(St * 0.96), Math.max(MAC_MIN_V, clamp01(Vt + 0.03)));
  const base = getHex(h, clamp01(St), Math.max(MAC_MIN_V, clamp01(Vt)));
  return `<linearGradient id="mgt" x1="128" y1="31" x2="128" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient>`;
}

/** The tab strip's bounding box, framing an angle-respecting custom-tab gradient. */
const MAC_TAB_BBOX = { x0: 10.5, y0: 31, x1: 245.5, y1: 66 };

/**
 * The tab `<defs>` (id `mgt`). Auto derives from `tab`; a custom solid back
 * paints a near-flat gradient from it, a custom gradient back is laid over the
 * tab strip on its own angle-respecting axis.
 */
function macTabDef(tab: Hsv3, backColor?: ColorValue | null): string {
  if (backColor && isGradient(backColor)) {
    return angleGradientEl("mgt", backColor.angle, backColor.stops, MAC_TAB_BBOX);
  }
  return macTabGradient(backColor ? hexToHsv(backColor) : tab);
}

/** Assemble a solid-fill macOS folder from a resolved palette. */
function macAssemble(pal: MacPalette, paper: string, backColor?: ColorValue | null): string {
  return `${SVG_OPEN}<defs>${macTabDef(pal.tab, backColor)}${macFaceGradient(pal)}</defs><path d="${MAC_F}" fill="url(#mgt)"/><path d="${MAC_B}" fill="url(#mgf)"/>${paper}</svg>`;
}

/**
 * Flat profile: the FRONT face is a single flat color (no gradient, no emboss),
 * but the folder's structure stays legible — a flat, deeper tab, a subtle fold
 * shadow under it, and the two bottom rim lines, all tinted to the base color.
 * The rim flips to a darker groove on already-light faces so it stays visible.
 */
function buildMacFlatSolid(cs: ShapeColorState, paper: string): string {
  const h = cs.hue;
  const s = cs.sat;
  const v = cs.bri;
  const front = getHex(h, s, v);
  const tab = macFlatTabPaint([h, clamp01(s * 1.1 + 0.04), clamp01(v * 0.8)], cs.backColor);
  const rim =
    v > 0.8
      ? getHex(h, clamp01(s + 0.05), clamp01(v * 0.88)) // groove reads on light faces
      : getHex(h, clamp01(s * 0.72), clamp01(v + 0.12)); // ridge on darker faces
  return `${SVG_OPEN}${tab.defs}<path d="${MAC_F}" fill="${tab.fill}"/><path d="${MAC_B}" fill="${front}"/><path d="${MAC_SEAM}" stroke="#000" stroke-opacity="0.1" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="${MAC_S1}" fill="${rim}"/><path d="${MAC_S2}" fill="${rim}"/>${paper}</svg>`;
}

/** Flat-tab paint: the derived flat tab, or a custom solid/gradient back. */
function macFlatTabPaint(tab: Hsv3, backColor?: ColorValue | null): { defs: string; fill: string } {
  if (backColor && isGradient(backColor)) {
    return { defs: `<defs>${angleGradientEl("mgt", backColor.angle, backColor.stops, MAC_TAB_BBOX)}</defs>`, fill: "url(#mgt)" };
  }
  if (backColor) return { defs: "", fill: backColor };
  return { defs: "", fill: getHex(tab[0], clamp01(tab[1]), clamp01(tab[2])) };
}

/**
 * Gradient-fill macOS folder. The double rim stays adaptive to the bottom stop;
 * the profile ({@link MacGradientAlgo}) controls the front and tab treatment:
 * - best    — front verbatim, tab derived from the top stop.
 * - current — front verbatim, uniform tab from the deepest stop (deeper).
 * - echo    — front verbatim, tab echoes the gradient darkened + more saturated.
 * - lit     — front pushed through the authentic macOS face envelope, per stop.
 * A custom back color overrides the tab in every profile.
 */
function buildMacGradient(cs: ShapeColorState, algo: MacGradientAlgo, paper: string): string {
  const stops = [...cs.stops].sort((a, b) => a.pos - b.pos);
  const first = stops[0];
  const last = stops[stops.length - 1];

  const frontDef =
    algo === "lit"
      ? gradientDef(
          "mgf",
          cs.gradType,
          cs.gradAngle,
          stops.map((st) => {
            const f = macOfficialPalette(st.hue, st.sat, st.bri).face;
            return { pos: st.pos, hex: getHex(f[0], clamp01(f[1]), clamp01(f[2])) };
          }),
        )
      : complexGradient("mgf", cs);

  let tabDef: string;
  if (cs.backColor) {
    tabDef = macTabDef([0, 0, 0], cs.backColor); // custom back overrides
  } else if (algo === "echo") {
    const dk = (st: GradientStop): string =>
      getHex(st.hue, Math.min(1, st.sat * 1.25 + 0.08), Math.max(MAC_MIN_V, st.bri * 0.7));
    tabDef = `<linearGradient id="mgt" x1="128" y1="31" x2="128" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="${dk(first)}"/><stop offset="1" stop-color="${dk(last)}"/></linearGradient>`;
  } else {
    // best derives the tab from the top stop; current (deep tab) from the deepest.
    const anchor = algo === "current" ? last : first;
    tabDef = macTabDef(macBestPalette(anchor.hue, anchor.sat, anchor.bri).tab);
  }

  // Adaptive rim: a brighter, slightly desaturated tint of the deepest stop.
  const rim = getHex(last.hue, clamp01(last.sat * 0.85), clamp01(last.bri + 0.03));
  return `${SVG_OPEN}<defs>${tabDef}${frontDef}</defs><path d="${MAC_F}" fill="url(#mgt)"/><path d="${MAC_B}" fill="url(#mgf)"/><path d="${MAC_S1}" fill="${rim}"/><path d="${MAC_S2}" fill="${rim}"/>${paper}</svg>`;
}

/** The macOS render: profile-dispatched solid fill, or the gradient variant. */
function buildMacSvg(cs: ShapeColorState): string {
  const paper = macPaperMarkup(cs);
  if (cs.mode === "gradient") {
    return buildMacGradient(cs, cs.macGradientAlgo ?? DEFAULT_MAC_GRADIENT_ALGO, paper);
  }
  const profile = cs.macColorProfile ?? DEFAULT_MAC_COLOR_PROFILE;
  if (profile === "flat") return buildMacFlatSolid(cs, paper);
  return macAssemble(macPalette(profile, cs.hue, cs.sat, cs.bri), paper, cs.backColor);
}

/** macOS solid color profiles, surfaced as a dropdown in the folder Color section. */
export const MAC_COLOR_PROFILES: Array<{ id: MacColorProfile; name: string }> = [
  { id: "best", name: "Refined" },
  { id: "official", name: "Authentic" },
  { id: "popped", name: "Popped" },
  { id: "flat", name: "Flat" },
];

/** Human-readable name of a macOS color profile. */
export function macColorProfileName(id: MacColorProfile): string {
  return MAC_COLOR_PROFILES.find((p) => p.id === id)?.name ?? id;
}

export const BASE_SHAPES_DEF: BaseShapeDef[] = [
  {
    id: "classic",
    name: "Classic",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M234.667 202.667C234.667 208.325 232.419 213.751 228.418 217.752C224.418 221.752 218.991 224 213.334 224H42.6668C37.0089 224 31.5827 221.752 27.5819 217.752C23.5811 213.751 21.3335 208.325 21.3335 202.667V53.3333C21.3335 47.6754 23.5811 42.2492 27.5819 38.2484C31.5827 34.2476 37.0089 32 42.6668 32H96.0002L117.333 64H213.334C218.991 64 224.418 66.2476 228.418 70.2484C232.419 74.2492 234.667 79.6754 234.667 85.3333V202.667Z" stroke="__COLOR__" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M234.667 202.667C234.667 208.325 232.419 213.751 228.418 217.752C224.418 221.752 218.991 224 213.334 224H42.6668C37.0089 224 31.5827 221.752 27.5819 217.752C23.5811 213.751 21.3335 208.325 21.3335 202.667V53.3333C21.3335 47.6754 23.5811 42.2492 27.5819 38.2484C31.5827 34.2476 37.0089 32 42.6668 32H96.0002L117.333 64H213.334C218.991 64 224.418 66.2476 228.418 70.2484C232.419 74.2492 234.667 79.6754 234.667 85.3333V202.667Z" fill="white" stroke="white" stroke-width="16"/></svg>',
  },
  {
    id: "layered",
    name: "Layered",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M24 184V72M24 184C24 201.673 38.3269 216 56 216M24 184C24 192.487 27.3714 200.626 33.3726 206.627C39.3737 212.629 47.5131 216 56 216M24 72C24 54.3269 38.3269 40 56 40M24 72C24 63.5131 27.3714 55.3737 33.3726 49.3726C39.3737 43.3714 47.5131 40 56 40M56 40H200C217.673 40 232 54.3269 232 72V184M56 40H80C85.5844 40.0337 91.0628 41.5283 95.8907 44.3352C100.719 47.1421 104.728 51.1636 107.52 56C110.376 60.8508 114.444 64.876 119.325 67.681C124.205 70.4859 129.731 71.9742 135.36 72H200C208.487 72 216.626 75.3714 222.627 81.3726C228.629 87.3737 232 95.5131 232 104V184M232 184C232 201.673 217.673 216 200 216M232 184C232 192.487 228.629 200.626 222.627 206.627C216.626 212.629 208.487 216 200 216M200 216H56" stroke="__COLOR__" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"><path d="M24 184V72M24 184C24 201.673 38.3269 216 56 216M24 184C24 192.487 27.3714 200.626 33.3726 206.627C39.3737 212.629 47.5131 216 56 216M24 72C24 54.3269 38.3269 40 56 40M24 72C24 63.5131 27.3714 55.3737 33.3726 49.3726C39.3737 43.3714 47.5131 40 56 40M56 40H200C217.673 40 232 54.3269 232 72V184M56 40H80C85.5844 40.0337 91.0628 41.5283 95.8907 44.3352C100.719 47.1421 104.728 51.1636 107.52 56C110.376 60.8508 114.444 64.876 119.325 67.681C124.205 70.4859 129.731 71.9742 135.36 72H200C208.487 72 216.626 75.3714 222.627 81.3726C228.629 87.3737 232 95.5131 232 104V184M232 184C232 201.673 217.673 216 200 216M232 184C232 192.487 228.629 200.626 222.627 206.627C216.626 212.629 208.487 216 200 216M200 216H56" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: "front",
    name: "Front",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M24 192V64C24 50.7452 34.7452 40 48 40H105.373C109.616 40 113.686 41.6857 116.686 44.6863L139.314 67.3137C142.314 70.3143 146.384 72 150.627 72H208C221.255 72 232 82.7452 232 96V192M24 192C24 205.255 34.7452 216 48 216H208C221.255 216 232 205.255 232 192M24 192V136V128C24 114.745 34.7452 104 48 104H208C221.255 104 232 114.745 232 128V136V192" stroke="__COLOR__" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="16" y="32" width="224" height="192" rx="16" fill="white"/></svg>',
  },
  {
    id: "rounded",
    name: "Rounded",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M192 114.667C196.418 114.667 200 111.085 200 106.667C200 102.248 196.418 98.6666 192 98.6666V106.667V114.667ZM138.667 98.6666C134.248 98.6666 130.667 102.248 130.667 106.667C130.667 111.085 134.248 114.667 138.667 114.667V106.667V98.6666ZM185.51 32.2737L184.466 40.2053V40.2053L185.51 32.2737ZM213.059 59.8231L205.128 60.8674V60.8674L213.059 59.8231ZM117.333 42.6667L122.99 37.0098V37.0098L117.333 42.6667ZM135.596 58.6179L139.485 51.627L135.596 58.6179ZM144.644 62.3656L146.837 54.672L144.644 62.3656ZM82.2993 21.5186L81.5545 29.4839L82.2993 21.5186ZM111.464 36.7973L105.807 42.4541V42.4541L111.464 36.7973ZM105.557 31.1521L110.662 24.9932V24.9932L105.557 31.1521ZM226.459 74.6008L232.407 69.2511V69.2511L226.459 74.6008ZM224.066 72.2076L229.415 66.2595V66.2595L224.066 72.2076ZM22.073 56.0894L29.9343 57.5727L22.073 56.0894ZM56.0894 22.073L57.5726 29.9343L56.0894 22.073ZM192 106.667V98.6666H138.667V106.667V114.667H192V106.667ZM106.667 32V40H176V32V24H106.667V32ZM176 32V40C181.208 40 183.037 40.0172 184.466 40.2053L185.51 32.2737L186.554 24.3422C183.824 23.9827 180.699 24 176 24V32ZM213.333 69.3333H221.333C221.333 64.6338 221.351 61.5093 220.991 58.7789L213.059 59.8231L205.128 60.8674C205.316 62.2959 205.333 64.1252 205.333 69.3333H213.333ZM185.51 32.2737L184.466 40.2053C195.236 41.6231 203.71 50.0977 205.128 60.8674L213.059 59.8231L220.991 58.7789C218.628 40.8296 204.504 26.7053 186.554 24.3422L185.51 32.2737ZM234.667 125.844H226.667V149.333H234.667H242.667V125.844H234.667ZM149.333 234.667V226.667H106.667V234.667V242.667H149.333V234.667ZM21.3333 149.333H29.3333V74.1306H21.3333H13.3333V149.333H21.3333ZM111.464 36.7973L105.807 42.4541L111.676 48.3235L117.333 42.6667L122.99 37.0098L117.121 31.1404L111.464 36.7973ZM168.836 64V72H172.822V64V56H168.836V64ZM117.333 42.6667L111.676 48.3235C120.059 56.7059 125.292 62.04 131.706 65.6087L135.596 58.6179L139.485 51.627C135.479 49.3982 132.011 46.0307 122.99 37.0098L117.333 42.6667ZM168.836 64V56C156.079 56 151.245 55.9287 146.837 54.672L144.644 62.3656L142.451 70.0591C149.51 72.0713 156.982 72 168.836 72V64ZM135.596 58.6179L131.706 65.6087C135.105 67.4996 138.71 68.993 142.451 70.0591L144.644 62.3656L146.837 54.672C144.277 53.9426 141.811 52.9208 139.485 51.627L135.596 58.6179ZM74.1306 21.3333V29.3333C78.4038 29.3333 80.0306 29.3414 81.5545 29.4839L82.2993 21.5186L83.0442 13.5534C80.6042 13.3252 78.1064 13.3333 74.1306 13.3333V21.3333ZM111.464 36.7973L117.121 31.1404C114.309 28.3291 112.549 26.5572 110.662 24.9932L105.557 31.1521L100.451 37.3111C101.629 38.2879 102.785 39.4325 105.807 42.4541L111.464 36.7973ZM82.2993 21.5186L81.5545 29.4839C88.4972 30.1331 95.0827 32.861 100.451 37.3111L105.557 31.1521L110.662 24.9932C102.816 18.4891 93.1912 14.5023 83.0442 13.5534L82.2993 21.5186ZM106.667 234.667V226.667C86.3272 226.667 71.8774 226.65 60.9156 225.176C50.184 223.733 44.0011 221.027 39.4869 216.513L33.83 222.17L28.1732 227.827C36.1557 235.809 46.2778 239.352 58.7837 241.033C71.0594 242.684 86.7795 242.667 106.667 242.667V234.667ZM21.3333 149.333H13.3333C13.3333 169.22 13.3163 184.941 14.9667 197.216C16.6481 209.722 20.1906 219.844 28.1732 227.827L33.83 222.17L39.4869 216.513C34.9726 211.999 32.2668 205.816 30.824 195.084C29.3502 184.123 29.3333 169.673 29.3333 149.333H21.3333ZM234.667 149.333H226.667C226.667 169.673 226.65 184.123 225.176 195.084C223.733 205.816 221.027 211.999 216.513 216.513L222.17 222.17L227.827 227.827C235.809 219.844 239.352 209.722 241.033 197.216C242.684 184.941 242.667 169.22 242.667 149.333H234.667ZM149.333 234.667V242.667C169.22 242.667 184.94 242.684 197.216 241.033C209.722 239.352 219.844 235.809 227.827 227.827L222.17 222.17L216.513 216.513C211.999 221.027 205.816 223.733 195.084 225.176C184.122 226.65 169.673 226.667 149.333 226.667V234.667ZM234.667 125.844H242.667C242.667 112.015 242.681 100.893 241.578 92.1172C240.45 83.1421 238.042 75.5161 232.407 69.2511L226.459 74.6008L220.511 79.9506C223.084 82.8111 224.78 86.7676 225.703 94.1131C226.652 101.658 226.667 111.595 226.667 125.844H234.667ZM172.822 64V72C187.071 72 197.008 72.0148 204.553 72.9634C211.899 73.887 215.855 75.5829 218.716 78.1557L224.066 72.2076L229.415 66.2595C223.15 60.6247 215.524 58.2168 206.549 57.0884C197.774 55.9851 186.652 56 172.822 56V64ZM226.459 74.6008L232.407 69.2511C231.463 68.2018 230.465 67.2032 229.415 66.2595L224.066 72.2076L218.716 78.1557C219.346 78.722 219.945 79.3211 220.511 79.9506L226.459 74.6008ZM21.3333 74.1306H29.3333C29.3333 64.3531 29.3682 60.5729 29.9343 57.5727L22.073 56.0894L14.2117 54.6062C13.2983 59.4473 13.3333 65.0808 13.3333 74.1306H21.3333ZM74.1306 21.3333V13.3333C65.0807 13.3333 59.4473 13.2984 54.6061 14.2117L56.0894 22.073L57.5726 29.9343C60.5728 29.3683 64.3531 29.3333 74.1306 29.3333V21.3333ZM22.073 56.0894L29.9343 57.5727C32.5801 43.5493 43.5493 32.5802 57.5726 29.9343L56.0894 22.073L54.6061 14.2117C34.1105 18.0788 18.0787 34.1106 14.2117 54.6062L22.073 56.0894Z" fill="__COLOR__"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"><path d="M192 114.667C196.418 114.667 200 111.085 200 106.667C200 102.248 196.418 98.6666 192 98.6666V106.667V114.667ZM138.667 98.6666C134.248 98.6666 130.667 102.248 130.667 106.667C130.667 111.085 134.248 114.667 138.667 114.667V106.667V98.6666ZM185.51 32.2737L184.466 40.2053V40.2053L185.51 32.2737ZM213.059 59.8231L205.128 60.8674V60.8674L213.059 59.8231ZM117.333 42.6667L122.99 37.0098V37.0098L117.333 42.6667ZM135.596 58.6179L139.485 51.627L135.596 58.6179ZM144.644 62.3656L146.837 54.672L144.644 62.3656ZM82.2993 21.5186L81.5545 29.4839L82.2993 21.5186ZM111.464 36.7973L105.807 42.4541V42.4541L111.464 36.7973ZM105.557 31.1521L110.662 24.9932V24.9932L105.557 31.1521ZM226.459 74.6008L232.407 69.2511V69.2511L226.459 74.6008ZM224.066 72.2076L229.415 66.2595V66.2595L224.066 72.2076ZM22.073 56.0894L29.9343 57.5727L22.073 56.0894ZM56.0894 22.073L57.5726 29.9343L56.0894 22.073ZM192 106.667V98.6666H138.667V106.667V114.667H192V106.667ZM106.667 32V40H176V32V24H106.667V32ZM176 32V40C181.208 40 183.037 40.0172 184.466 40.2053L185.51 32.2737L186.554 24.3422C183.824 23.9827 180.699 24 176 24V32ZM213.333 69.3333H221.333C221.333 64.6338 221.351 61.5093 220.991 58.7789L213.059 59.8231L205.128 60.8674C205.316 62.2959 205.333 64.1252 205.333 69.3333H213.333ZM185.51 32.2737L184.466 40.2053C195.236 41.6231 203.71 50.0977 205.128 60.8674L213.059 59.8231L220.991 58.7789C218.628 40.8296 204.504 26.7053 186.554 24.3422L185.51 32.2737ZM234.667 125.844H226.667V149.333H234.667H242.667V125.844H234.667ZM149.333 234.667V226.667H106.667V234.667V242.667H149.333V234.667ZM21.3333 149.333H29.3333V74.1306H21.3333H13.3333V149.333H21.3333ZM111.464 36.7973L105.807 42.4541L111.676 48.3235L117.333 42.6667L122.99 37.0098L117.121 31.1404L111.464 36.7973ZM168.836 64V72H172.822V64V56H168.836V64ZM117.333 42.6667L111.676 48.3235C120.059 56.7059 125.292 62.04 131.706 65.6087L135.596 58.6179L139.485 51.627C135.479 49.3982 132.011 46.0307 122.99 37.0098L117.333 42.6667ZM168.836 64V56C156.079 56 151.245 55.9287 146.837 54.672L144.644 62.3656L142.451 70.0591C149.51 72.0713 156.982 72 168.836 72V64ZM135.596 58.6179L131.706 65.6087C135.105 67.4996 138.71 68.993 142.451 70.0591L144.644 62.3656L146.837 54.672C144.277 53.9426 141.811 52.9208 139.485 51.627L135.596 58.6179ZM74.1306 21.3333V29.3333C78.4038 29.3333 80.0306 29.3414 81.5545 29.4839L82.2993 21.5186L83.0442 13.5534C80.6042 13.3252 78.1064 13.3333 74.1306 13.3333V21.3333ZM111.464 36.7973L117.121 31.1404C114.309 28.3291 112.549 26.5572 110.662 24.9932L105.557 31.1521L100.451 37.3111C101.629 38.2879 102.785 39.4325 105.807 42.4541L111.464 36.7973ZM82.2993 21.5186L81.5545 29.4839C88.4972 30.1331 95.0827 32.861 100.451 37.3111L105.557 31.1521L110.662 24.9932C102.816 18.4891 93.1912 14.5023 83.0442 13.5534L82.2993 21.5186ZM106.667 234.667V226.667C86.3272 226.667 71.8774 226.65 60.9156 225.176C50.184 223.733 44.0011 221.027 39.4869 216.513L33.83 222.17L28.1732 227.827C36.1557 235.809 46.2778 239.352 58.7837 241.033C71.0594 242.684 86.7795 242.667 106.667 242.667V234.667ZM21.3333 149.333H13.3333C13.3333 169.22 13.3163 184.941 14.9667 197.216C16.6481 209.722 20.1906 219.844 28.1732 227.827L33.83 222.17L39.4869 216.513C34.9726 211.999 32.2668 205.816 30.824 195.084C29.3502 184.123 29.3333 169.673 29.3333 149.333H21.3333ZM234.667 149.333H226.667C226.667 169.673 226.65 184.123 225.176 195.084C223.733 205.816 221.027 211.999 216.513 216.513L222.17 222.17L227.827 227.827C235.809 219.844 239.352 209.722 241.033 197.216C242.684 184.941 242.667 169.22 242.667 149.333H234.667ZM149.333 234.667V242.667C169.22 242.667 184.94 242.684 197.216 241.033C209.722 239.352 219.844 235.809 227.827 227.827L222.17 222.17L216.513 216.513C211.999 221.027 205.816 223.733 195.084 225.176C184.122 226.65 169.673 226.667 149.333 226.667V234.667ZM234.667 125.844H242.667C242.667 112.015 242.681 100.893 241.578 92.1172C240.45 83.1421 238.042 75.5161 232.407 69.2511L226.459 74.6008L220.511 79.9506C223.084 82.8111 224.78 86.7676 225.703 94.1131C226.652 101.658 226.667 111.595 226.667 125.844H234.667ZM172.822 64V72C187.071 72 197.008 72.0148 204.553 72.9634C211.899 73.887 215.855 75.5829 218.716 78.1557L224.066 72.2076L229.415 66.2595C223.15 60.6247 215.524 58.2168 206.549 57.0884C197.774 55.9851 186.652 56 172.822 56V64ZM226.459 74.6008L232.407 69.2511C231.463 68.2018 230.465 67.2032 229.415 66.2595L224.066 72.2076L218.716 78.1557C219.346 78.722 219.945 79.3211 220.511 79.9506L226.459 74.6008ZM21.3333 74.1306H29.3333C29.3333 64.3531 29.3682 60.5729 29.9343 57.5727L22.073 56.0894L14.2117 54.6062C13.2983 59.4473 13.3333 65.0808 13.3333 74.1306H21.3333ZM74.1306 21.3333V13.3333C65.0807 13.3333 59.4473 13.2984 54.6061 14.2117L56.0894 22.073L57.5726 29.9343C60.5728 29.3683 64.3531 29.3333 74.1306 29.3333V21.3333ZM22.073 56.0894L29.9343 57.5727C32.5801 43.5493 43.5493 32.5802 57.5726 29.9343L56.0894 22.073L54.6061 14.2117C34.1105 18.0788 18.0787 34.1106 14.2117 54.6062L22.073 56.0894Z" fill="white"/></svg>',
  },
  {
    id: "open",
    name: "Open",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M53.3333 202.667C41.5513 202.667 32 193.115 32 181.333V74.6666C32 62.8846 41.5513 53.3333 53.3333 53.3333H96L117.333 74.6666H160C171.782 74.6666 181.333 84.2179 181.333 96V106.667M53.3333 202.667H202.667C214.449 202.667 224 193.115 224 181.333V128C224 116.218 214.449 106.667 202.667 106.667H96C84.2179 106.667 74.6667 116.218 74.6667 128V181.333C74.6667 193.115 65.1154 202.667 53.3333 202.667Z" stroke="__COLOR__" stroke-width="16" stroke-linecap="round"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M32 74.6666C32 62.8846 41.5513 53.3333 53.3333 53.3333H96L117.333 74.6666H160C171.782 74.6666 181.333 84.2179 181.333 96V106.667H202.667C214.449 106.667 224 116.218 224 128V181.333C224 193.115 214.449 202.667 202.667 202.667H53.3333C41.5513 202.667 32 193.115 32 181.333V74.6666Z" fill="white" stroke="white" stroke-width="16"/></svg>',
  },
  {
    id: "detailed",
    name: "Detailed",
    defaultHsv: [0, 0, 1],
    defaultClip: false,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">__DEFS__<path d="M219.428 46.9335V83.0385C228.195 85.2932 234.667 93.2225 234.667 102.667V198.933C234.667 215.723 221.022 229.333 204.19 229.333H51.8094C34.9779 229.333 21.3333 215.723 21.3333 198.933V77.3334C21.3333 68.0938 27.5987 60.021 36.5687 57.7058V46.9333C36.5687 35.7404 45.6652 26.6667 56.8862 26.6667H199.108C210.332 26.6667 219.428 35.7405 219.428 46.9335ZM36.5716 77.3334V198.933C36.5716 206.983 42.8616 213.636 50.9166 214.108L51.8097 214.133H204.191C212.259 214.133 218.93 207.86 219.403 199.825L219.429 198.933V102.667C219.429 100.099 217.502 97.9366 214.944 97.6357L214.349 97.6002H158.04L128.976 73.4424C128.249 72.8384 127.367 72.4489 126.431 72.3176L125.72 72.2669H41.6512C39.0761 72.2669 36.9087 74.1898 36.6074 76.7408L36.5716 77.3334ZM163.992 82.4002H204.191V46.9336C204.191 44.3656 202.264 42.2033 199.706 41.9025L199.111 41.8669H56.8891C54.3139 41.8669 52.1465 43.7898 51.8453 46.3408L51.8097 46.9336V57.0669H133.516L163.992 82.4002Z" fill="__COLOR__"/></svg>',
    mask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M219.428 46.9335V83.0385C228.195 85.2932 234.667 93.2225 234.667 102.667V198.933C234.667 215.723 221.022 229.333 204.19 229.333H51.8094C34.9779 229.333 21.3333 215.723 21.3333 198.933V77.3334C21.3333 68.0938 27.5987 60.021 36.5687 57.7058V46.9333C36.5687 35.7404 45.6652 26.6667 56.8862 26.6667H199.108C210.332 26.6667 219.428 35.7405 219.428 46.9335ZM36.5716 77.3334V198.933C36.5716 206.983 42.8616 213.636 50.9166 214.108L51.8097 214.133H204.191C212.259 214.133 218.93 207.86 219.403 199.825L219.429 198.933V102.667C219.429 100.099 217.502 97.9366 214.944 97.6357L214.349 97.6002H158.04L128.976 73.4424C128.249 72.8384 127.367 72.4489 126.431 72.3176L125.72 72.2669H41.6512C39.0761 72.2669 36.9087 74.1898 36.6074 76.7408L36.5716 77.3334ZM163.992 82.4002H204.191V46.9336C204.191 44.3656 202.264 42.2033 199.706 41.9025L199.111 41.8669H56.8891C54.3139 41.8669 52.1465 43.7898 51.8453 46.3408L51.8097 46.9336V57.0669H133.516L163.992 82.4002Z" fill="white"/></svg>',
  },
  {
    id: "windows",
    name: "Windows",
    defaultHsv: [43, 0.81, 1],
    defaultClip: true,
    buildSvg: buildWindowsSvg,
    mask: `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${WIN_T}" fill="white"/><path d="${WIN_B}" fill="white"/></svg>`,
  },
  {
    id: "macos",
    name: "macOS",
    defaultHsv: [203, 0.6, 0.86],
    defaultClip: true,
    buildSvg: buildMacSvg,
    mask: '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M39.3 228.5H216.7C226.781 228.5 231.821 228.5 235.672 226.538C239.059 224.812 241.812 222.059 243.538 218.672C245.5 214.821 245.5 209.781 245.5 199.7V78.3C245.5 68.2191 245.5 63.1786 243.538 59.3282C241.812 55.9413 239.059 53.1876 235.672 51.4619C231.821 49.5 226.781 49.5 216.7 49.5H119.375C114 49.5 107.125 49 100.375 43.875C93.625 38.75 99.375 43.125 92.25 37.625C85.125 32.125 81.4915 31 75.25 31H39.3C29.2191 31 24.1786 31 20.3282 32.9619C16.9413 34.6876 14.1876 37.4413 12.4619 40.8282C10.5 44.6786 10.5 49.7191 10.5 59.8V199.7C10.5 209.781 10.5 214.821 12.4619 218.672C14.1876 222.059 16.9413 224.812 20.3282 226.538C24.1786 228.5 29.2191 228.5 39.3 228.5Z" fill="white"/></svg>',
  },
  {
    id: "glass",
    name: "Glass",
    defaultHsv: [0, 0, 0],
    defaultClip: true,
    buildSvg: (cs) => {
      const F = "M101.567 23C120.903 23 139.48 44.957 158.815 44.957H184.038C205.011 44.957 215.498 44.9574 223.509 49.0391C230.555 52.6294 236.285 58.3579 239.875 65.4043C243.957 73.415 243.956 83.9018 243.956 104.875V173.081C243.956 194.054 243.957 204.541 239.875 212.552C236.285 219.598 230.555 225.328 223.509 228.918C215.498 233 205.011 232.999 184.038 232.999H71.918C50.9449 232.999 40.458 233 32.4473 228.918C25.4009 225.328 19.6724 219.598 16.0821 212.552C12.0004 204.541 12 194.054 12 173.081V60.4492C12 39.7667 28.7667 23 49.4492 23H101.567Z";
      const BD = "M12 135.841C12 114.867 12 104.381 16.0817 96.3698C19.6721 89.3233 25.401 83.5943 32.4475 80.004C40.4583 75.9223 50.945 75.9223 71.9184 75.9223H184.038C205.011 75.9223 215.498 75.9223 223.509 80.004C230.555 83.5943 236.284 89.3233 239.875 96.3698C243.956 104.381 243.956 114.867 243.956 135.841L243.956 173.081C243.956 194.054 243.957 204.541 239.875 212.552C236.285 219.598 230.555 225.328 223.509 228.918C215.498 233 205.011 232.999 184.038 232.999H71.918C50.9449 232.999 40.458 233 32.4473 228.918C25.4009 225.328 19.6724 219.598 16.0821 212.552C12.0004 204.541 12 194.054 12 173.081L12 135.841Z";
      const OL = "M184.038 76.6719C194.537 76.6719 202.366 76.6726 208.573 77.1797C214.771 77.6861 219.286 78.694 223.168 80.6719C230.073 84.1903 235.688 89.8048 239.206 96.71C241.184 100.592 242.192 105.107 242.698 111.306C243.205 117.513 243.206 125.342 243.206 135.841V173.081L243.198 180.471C243.174 187.393 243.078 192.961 242.698 197.616C242.192 203.814 241.185 208.329 239.207 212.211C235.689 219.116 230.073 224.732 223.168 228.25C219.286 230.228 214.771 231.235 208.573 231.741C202.366 232.248 194.537 232.249 184.038 232.249H71.918C61.419 232.249 53.5899 232.248 47.3828 231.741C41.1847 231.235 36.67 230.228 32.7881 228.25C25.8828 224.732 20.2685 219.116 16.75 212.211C14.7721 208.329 13.7643 203.814 13.2578 197.616C12.7693 191.638 12.7517 184.156 12.751 174.232V134.688C12.7517 124.766 12.7694 117.283 13.2578 111.306C13.7642 105.107 14.772 100.592 16.75 96.71C20.2685 89.8047 25.8828 84.1903 32.7881 80.6719C36.67 78.694 41.1847 77.6861 47.3828 77.1797C53.5898 76.6726 61.4191 76.6719 71.918 76.6719H184.038ZM49.4492 23.75H101.567C110.994 23.75 120.286 29.1092 129.815 34.6279C139.243 40.0877 148.906 45.707 158.815 45.707H184.038C194.537 45.707 202.366 45.7076 208.573 46.2148C214.771 46.7213 219.286 47.7292 223.168 49.707C230.073 53.2255 235.689 58.8398 239.207 65.7451C241.185 69.627 242.192 74.1417 242.698 80.3398C243.177 86.2056 243.203 93.5199 243.204 103.167C242.622 100.456 241.814 98.0658 240.685 95.8496C237.026 88.6717 231.21 82.8529 224.029 79.1953C219.902 77.093 215.176 76.0954 208.897 75.6162C204.196 75.2574 198.583 75.1876 191.657 75.1748L184.279 75.1719H71.6787C61.2175 75.1719 53.3295 75.1378 47.0605 75.6162C40.7823 76.0954 36.0552 77.093 31.9277 79.1953C24.7472 82.8529 18.932 88.6719 15.2734 95.8496C14.1415 98.0703 13.3328 100.466 12.75 103.184V60.4492C12.75 40.1809 29.1809 23.75 49.4492 23.75Z";
      const H = cs.hue;
      const S = cs.sat;
      const V = cs.bri;
      const gV = Math.max(V, 0.85);
      if (cs.mode === "solid") {
        const op = (0.15 + S * V * 0.3).toFixed(2);
        const opL = Math.min(1, 0.15 + S * V * 0.3 + 0.08).toFixed(2);
        const fC = getHex(H, S, gV);
        const fCL = getHex(H, S * 0.7, Math.min(1, gV + 0.06));
        const sA = getHex(H, S * 0.4, Math.min(1, gV + 0.15));
        const sB = getHex(H, S, Math.max(V, 0.3));
        const rg = `<radialGradient id="gr" cx="0" cy="0" r="1" gradientTransform="matrix(-231.957 -157.078 231.957 -262.07 243.957 233)" gradientUnits="userSpaceOnUse"><stop stop-color="${fC}" stop-opacity="${op}"/><stop offset="1" stop-color="${fCL}" stop-opacity="${opL}"/></radialGradient>`;
        const lg = `<linearGradient id="gl" x1="12" y1="75.9217" x2="218.935" y2="266.698" gradientUnits="userSpaceOnUse"><stop offset="0.228" stop-color="${sA}"/><stop offset="0.947" stop-color="${sB}"/></linearGradient>`;
        return `${SVG_OPEN}<defs>${rg}${lg}</defs><path d="${F}" fill="url(#gr)"/><path d="${BD}" fill="black" fill-opacity="0.46"/><path d="${BD}" fill="url(#gr)"/><path d="${OL}" fill="none" stroke="url(#gl)" stroke-width="1.5"/></svg>`;
      }
      const gs = [...cs.stops].sort((a, b) => a.pos - b.pos);
      const avgSV = gs.reduce((a, s) => a + s.sat * s.bri, 0) / gs.length;
      const op = (0.15 + avgSV * 0.3).toFixed(2);
      const ss = gs
        .map((s) => `<stop offset="${Math.round(s.pos * 100)}%" stop-color="${getHex(s.hue, s.sat, s.bri)}" stop-opacity="${op}"/>`)
        .join("");
      let fd: string;
      if (cs.gradType === "linear") {
        const r = ((cs.gradAngle - 90) * Math.PI) / 180;
        fd = `<linearGradient id="gf" x1="${(50 - Math.cos(r) * 50).toFixed(1)}%" y1="${(50 - Math.sin(r) * 50).toFixed(1)}%" x2="${(50 + Math.cos(r) * 50).toFixed(1)}%" y2="${(50 + Math.sin(r) * 50).toFixed(1)}%">${ss}</linearGradient>`;
      } else {
        fd = `<radialGradient id="gf" cx="50%" cy="50%" r="50%">${ss}</radialGradient>`;
      }
      const s0 = gs[0];
      const sN = gs[gs.length - 1];
      const gVs0 = Math.max(s0.bri, 0.85);
      const sA = getHex(s0.hue, s0.sat * 0.4, Math.min(1, gVs0 + 0.15));
      const sB = getHex(sN.hue, sN.sat, Math.max(sN.bri, 0.3));
      const lg = `<linearGradient id="gl" x1="12" y1="75.9217" x2="218.935" y2="266.698" gradientUnits="userSpaceOnUse"><stop offset="0.228" stop-color="${sA}"/><stop offset="0.947" stop-color="${sB}"/></linearGradient>`;
      return `${SVG_OPEN}<defs>${fd}${lg}</defs><path d="${F}" fill="url(#gf)"/><path d="${BD}" fill="black" fill-opacity="0.46"/><path d="${BD}" fill="url(#gf)"/><path d="${OL}" fill="none" stroke="url(#gl)" stroke-width="1.5"/></svg>`;
    },
    mask: '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M101.567 23C120.903 23 139.48 44.957 158.815 44.957H184.038C205.011 44.957 215.498 44.9574 223.509 49.0391C230.555 52.6294 236.285 58.3579 239.875 65.4043C243.957 73.415 243.956 83.9018 243.956 104.875V173.081C243.956 194.054 243.957 204.541 239.875 212.552C236.285 219.598 230.555 225.328 223.509 228.918C215.498 233 205.011 232.999 184.038 232.999H71.918C50.9449 232.999 40.458 233 32.4473 228.918C25.4009 225.328 19.6724 219.598 16.0821 212.552C12.0004 204.541 12 194.054 12 173.081V60.4492C12 39.7667 28.7667 23 49.4492 23H101.567Z" fill="white"/></svg>',
  },
  {
    id: "minimal",
    name: "Minimal",
    defaultHsv: [30, 0.7, 1],
    defaultClip: true,
    svg: '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">__DEFS__<path d="M13 50.0875V205.691C13 212.342 18.3913 217.733 25.0419 217.733H230.958C237.609 217.733 243 212.342 243 205.691V74.6448C243 67.9943 237.609 62.6029 230.958 62.6029H122.88C118.199 62.6029 113.959 59.8706 111.51 55.8807C107.047 48.6101 99.0004 38.0457 89.9175 38.0457H25.0231C18.3725 38.0457 13 43.437 13 50.0875Z" fill="__COLOR__"/></svg>',
    mask: '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 50.0875V205.691C13 212.342 18.3913 217.733 25.0419 217.733H230.958C237.609 217.733 243 212.342 243 205.691V74.6448C243 67.9943 237.609 62.6029 230.958 62.6029H122.88C118.199 62.6029 113.959 59.8706 111.51 55.8807C107.047 48.6101 99.0004 38.0457 89.9175 38.0457H25.0231C18.3725 38.0457 13 43.437 13 50.0875Z" fill="white"/></svg>',
  },
  {
    id: "file-folder",
    name: "File",
    defaultHsv: [36, 0.831, 1],
    defaultClip: true,
    buildSvg: (cs) => {
      const P1 = "M23.201 212.511H232.799C235.671 212.511 238 210.182 238 207.31V61.306C238 58.4336 235.671 56.1051 232.799 56.1051H125.59C123.706 56.1051 121.969 55.0866 121.05 53.4426L117.259 46.6625C116.339 45.0185 114.603 44 112.719 44H23.201C20.3286 44 18 46.3285 18 49.2009V207.31C18 210.182 20.3286 212.511 23.201 212.511Z";
      const P2 = "M27.3617 67.4043C27.3617 64.5319 29.6902 62.2033 32.5626 62.2033H218.757C221.629 62.2033 223.957 64.5319 223.957 67.4043V198.988C223.957 201.861 221.629 204.189 218.757 204.189H32.5627C29.6902 204.189 27.3617 201.861 27.3617 198.988V67.4043Z";
      const P3 = "M29.4421 70.0047C29.4421 67.1323 31.7706 64.8038 34.643 64.8038H220.837C223.709 64.8038 226.038 67.1323 226.038 70.0047V201.589C226.038 204.461 223.709 206.79 220.837 206.79H34.643C31.7706 206.79 29.4421 204.461 29.4421 201.589V70.0047Z";
      const P4 = "M232.799 210.95H23.2009C20.3285 210.95 18 208.622 18 205.749V92.6002C18 89.7278 20.3285 87.3992 23.2009 87.3992H130.471C132.53 87.3992 134.395 86.1843 135.227 84.301L139.258 75.1834C140.09 73.3 141.955 72.0851 144.015 72.0851H232.799C235.671 72.0851 238 74.4137 238 77.2861V205.749C238 208.622 235.671 210.95 232.799 210.95Z";
      const P5 = "M232.799 212.511H23.201C20.3286 212.511 18 210.182 18 207.31L18 94.1604C18 91.288 20.3285 88.9595 23.2009 88.9595H130.471C132.53 88.9595 134.395 87.7446 135.227 85.8612L139.258 76.7436C140.09 74.8603 141.955 73.6454 144.015 73.6454H232.799C235.671 73.6454 238 75.9739 238 78.8463L238 207.31C238 210.182 235.671 212.511 232.799 212.511Z";
      const P6 = "M106.592 212.771H232.539C235.411 212.771 237.74 210.442 237.74 207.57V138.86C200.726 178.023 150.03 200.754 106.592 212.771Z";
      const H = cs.hue;
      const S = cs.sat;
      const V = cs.bri;
      if (cs.mode === "solid") {
        const tab = getHex(H, S * 0.67, Math.min(1, V + 0.05));
        const body = getHex(H, S, V);
        const accent = getHex(H, Math.min(1, S * 1.11), V);
        return `${SVG_OPEN}<path d="${P1}" fill="${tab}"/><path d="${P2}" fill="black" fill-opacity="0.05"/><path d="${P3}" fill="white"/><path d="${P4}" fill="black" fill-opacity="0.06"/><path d="${P5}" fill="${body}"/><path d="${P6}" fill="${accent}"/></svg>`;
      }
      const gs = [...cs.stops].sort((a, b) => a.pos - b.pos);
      const s0 = gs[0];
      const sN = gs[gs.length - 1];
      const tab = getHex(s0.hue, s0.sat * 0.67, Math.min(1, s0.bri + 0.05));
      const ss = gs.map((s) => `<stop offset="${Math.round(s.pos * 100)}%" stop-color="${getHex(s.hue, s.sat, s.bri)}"/>`).join("");
      let fd: string;
      if (cs.gradType === "linear") {
        const r = ((cs.gradAngle - 90) * Math.PI) / 180;
        fd = `<linearGradient id="ff" x1="${(50 - Math.cos(r) * 50).toFixed(1)}%" y1="${(50 - Math.sin(r) * 50).toFixed(1)}%" x2="${(50 + Math.cos(r) * 50).toFixed(1)}%" y2="${(50 + Math.sin(r) * 50).toFixed(1)}%">${ss}</linearGradient>`;
      } else {
        fd = `<radialGradient id="ff" cx="50%" cy="50%" r="50%">${ss}</radialGradient>`;
      }
      const accent = getHex(sN.hue, Math.min(1, sN.sat * 1.11), sN.bri);
      return `${SVG_OPEN}<defs>${fd}</defs><path d="${P1}" fill="${tab}"/><path d="${P2}" fill="black" fill-opacity="0.05"/><path d="${P3}" fill="white"/><path d="${P4}" fill="black" fill-opacity="0.06"/><path d="${P5}" fill="url(#ff)"/><path d="${P6}" fill="${accent}"/></svg>`;
    },
    mask: '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.201 212.511H232.799C235.671 212.511 238 210.182 238 207.31V61.306C238 58.4336 235.671 56.1051 232.799 56.1051H125.59C123.706 56.1051 121.969 55.0866 121.05 53.4426L117.259 46.6625C116.339 45.0185 114.603 44 112.719 44H23.201C20.3286 44 18 46.3285 18 49.2009V207.31C18 210.182 20.3286 212.511 23.201 212.511Z" fill="white"/></svg>',
  },
];

const _SOLID_ORDER = ["windows", "macos", "file-folder", "glass", "minimal"];

/**
 * TEMPORARY: the picker is focused on the two highest-demand bases. Every shape
 * still RENDERS (findShape reads BASE_SHAPES_DEF), so saved designs on hidden
 * shapes keep working — they're just not offered in the panel. Widen this list
 * to bring the others back.
 */
const _ENABLED_SHAPES = ["windows", "macos"];

/** Display order: the solid-treatment shapes first, then the rest. */
export const BASE_SHAPES: BaseShapeDef[] = [
  ..._SOLID_ORDER.map((id) => BASE_SHAPES_DEF.find((s) => s.id === id)).filter(
    (s): s is BaseShapeDef => Boolean(s),
  ),
  ...BASE_SHAPES_DEF.filter((s) => !_SOLID_ORDER.includes(s.id)),
].filter((s) => _ENABLED_SHAPES.includes(s.id));

function findShape(id: string): BaseShapeDef {
  return BASE_SHAPES_DEF.find((s) => s.id === id) ?? BASE_SHAPES_DEF[0];
}

/** Build the colored base-folder SVG for a document (solid or gradient fill). */
export function buildBaseShapeSvg(doc: FolderDocument): string {
  const def = findShape(doc.baseShape);
  const cs = toShapeColorState(doc.folderColor);
  cs.gradientAlgo = doc.windowsGradientAlgo;
  cs.windowsColorProfile = doc.windowsColorProfile;
  cs.macColorProfile = doc.macColorProfile;
  cs.macGradientAlgo = doc.macGradientAlgo;
  cs.backColor = doc.folderBackColor;
  cs.folderState = doc.folderState;
  cs.paperColor = doc.folderPaperColor;
  if (def.buildSvg) return def.buildSvg(cs);
  if (cs.mode === "solid") {
    const color = getHex(cs.hue, cs.sat, cs.bri);
    return (def.svg ?? "").replace(/__DEFS__/g, "").replace(/__COLOR__/g, color);
  }
  return (def.svg ?? "").replace(/__DEFS__/g, fgDefs(cs)).replace(/__COLOR__/g, "url(#fg)");
}

/** The white silhouette mask SVG for a base shape (used for clip-to-folder). */
export function getBaseShapeMask(baseShapeId: string): string {
  return findShape(baseShapeId).mask;
}

/**
 * Shading overlay drawn on top of an image folder fill so the folder's
 * structure survives the image: the back panel / tab / bottom rim darken (the
 * region of the back not covered by the front) and the front keeps its
 * top-edge shine — the same cues the color algorithm paints. `null` for shapes
 * without an overlay treatment. Consumed by the editor (`FolderBase`), the
 * raster export (`renderCanvas`) and the vector export (`svgExport`) alike.
 */
export function buildBaseShapeOverlaySvg(baseShapeId: string): string | null {
  const id = findShape(baseShapeId).id;
  if (id === "windows") {
    const sh = winShineDefs(0.26, 6);
    const defs =
      `<linearGradient id="wvg" x1="24" y1="34" x2="80" y2="209" gradientUnits="userSpaceOnUse"><stop stop-color="#000000" stop-opacity="0.18"/><stop offset="0.85" stop-color="#000000" stop-opacity="0.4"/></linearGradient>` +
      `<mask id="wvm"><path d="${WIN_T}" fill="white"/><path d="${WIN_B}" fill="black"/></mask>` +
      sh.defs;
    return `${SVG_OPEN}<defs>${defs}</defs><rect width="256" height="256" fill="url(#wvg)" mask="url(#wvm)"/>${sh.shine}</svg>`;
  }
  if (id === "macos") {
    // Darken the tab strip (back minus front) + the emboss/fold structure, all
    // opacity-based so they adapt to whatever image sits underneath.
    const darken = `<linearGradient id="mvg" x1="128" y1="31" x2="128" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="#000000" stop-opacity="0.28"/><stop offset="1" stop-color="#000000" stop-opacity="0.1"/></linearGradient>`;
    const mask = `<mask id="mvm"><path d="${MAC_F}" fill="white"/><path d="${MAC_B}" fill="black"/></mask>`;
    return `${SVG_OPEN}<defs>${darken}${mask}</defs><rect width="256" height="256" fill="url(#mvg)" mask="url(#mvm)"/>${macStructureOverlay()}</svg>`;
  }
  return null;
}

/**
 * The macOS emboss cues as opacity overlays (image-fill paths): a fold shadow
 * under the tab and the two bottom rim lines (a white ridge + a dark groove),
 * so the structure reads over any image regardless of its color.
 */
function macStructureOverlay(): string {
  return (
    `<path d="${MAC_SEAM}" stroke="#000000" stroke-opacity="0.14" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    `<path d="${MAC_S1}" fill="#ffffff" fill-opacity="0.16"/>` +
    `<path d="${MAC_S2}" fill="#ffffff" fill-opacity="0.16"/>`
  );
}

/* ------------------------------------------------------------------------ *
 * Windows front-only image mode.
 *
 * When an image covers only the front panel, the tab/back is painted with an
 * adaptive color derived from the image, run through the finalized anchored
 * back treatment. These builders are the shared pieces the editor and both
 * exports compose (image masked to the front + this back + the shine).
 * ------------------------------------------------------------------------ */

/** Does this shape + fill combination render as a front-only image folder? */
export function isWindowsFrontImage(
  baseShapeId: string,
  fillMode: string,
  mode: WindowsImageMode | undefined,
): boolean {
  return findShape(baseShapeId).id === "windows" && fillMode === "image" && mode === "front";
}

/**
 * Paint the whole folder silhouette (`WIN_T`) with the back gradient for an
 * image folder. `frontAdaptive` is the image's average color, from which the
 * rim (and the Auto tab) derive; `backColor` optionally overrides just the tab.
 */
export function buildWindowsImageBackSvg(
  frontAdaptive: string,
  backColor?: ColorValue | null,
  frontAdaptive2?: string | null,
): string {
  const [h, s, v] = hexToHsv(frontAdaptive);
  const p = windowsAnchoredPalette(h, s, v, WIN_ANCHORS);
  // Auto gradient tab from two distinct dominants (only when no custom back).
  const auto =
    !backColor && frontAdaptive2
      ? autoTabGradientValue(frontAdaptive, frontAdaptive2, (hsv) =>
          windowsAnchoredPaletteHsv(hsv[0], hsv[1], hsv[2], WIN_ANCHORS).backTop,
        )
      : null;
  const back = windowsBackDef(p.backTop, p.backRim, backColor ?? auto);
  return `${SVG_OPEN}<defs>${back.defs}</defs>${back.paths}</svg>`;
}

/**
 * An adaptive gradient tab ColorValue from two dominant image colors, each run
 * through `shade` (the shape's tab derivation) so the tab keeps its usual deeper
 * register. Laid horizontally across the tab strip (angle 90).
 */
function autoTabGradientValue(c1: string, c2: string, shade: (hsv: Hsv3) => Hsv3): Gradient {
  const s1 = shade(hexToHsv(c1));
  const s2 = shade(hexToHsv(c2));
  return {
    kind: "linear",
    angle: 90,
    stops: [
      { id: "a", pos: 0, hue: s1[0], sat: s1[1], bri: s1[2] },
      { id: "b", pos: 1, hue: s2[0], sat: s2[1], bri: s2[2] },
    ],
  };
}

/**
 * The Auto (derived) tab color for the current document — used to seed the
 * custom-back color field so it starts matching before the user adjusts.
 */
export function windowsDerivedTabColor(doc: FolderDocument): string {
  const backTopOf = (hsv: Hsv3): string =>
    windowsAnchoredPalette(hsv[0], hsv[1], hsv[2], WIN_ANCHORS).backTop;
  if (doc.folderFillMode === "image") {
    return backTopOf(hexToHsv(doc.folderBgImageColor ?? "#888888"));
  }
  const cs = toShapeColorState(doc.folderColor);
  if (cs.mode === "gradient") {
    const last = [...cs.stops].sort((a, b) => a.pos - b.pos).at(-1);
    return last ? backTopOf([last.hue, last.sat, last.bri]) : backTopOf([0, 0, 0.6]);
  }
  return backTopOf([cs.hue, cs.sat, cs.bri]);
}

/**
 * The Auto (derived) tab color for the macOS folder — seeds the custom-back
 * field so it starts matching. Mirrors {@link windowsDerivedTabColor}.
 */
export function macDerivedTabColor(doc: FolderDocument): string {
  const tabOf = (hsv: Hsv3): string => {
    const t = macBestPalette(hsv[0], hsv[1], hsv[2]).tab;
    return getHex(t[0], clamp01(t[1]), clamp01(t[2]));
  };
  if (doc.folderFillMode === "image") {
    // The image tab is muted (see macImageTab), so the Auto seed must match it.
    const t = macImageTab(...hexToHsv(doc.folderBgImageColor ?? "#888888"));
    return getHex(t[0], clamp01(t[1]), clamp01(t[2]));
  }
  const cs = toShapeColorState(doc.folderColor);
  if (cs.mode === "gradient") {
    const first = [...cs.stops].sort((a, b) => a.pos - b.pos)[0];
    return first ? tabOf([first.hue, first.sat, first.bri]) : tabOf([0, 0, 0.6]);
  }
  return tabOf([cs.hue, cs.sat, cs.bri]);
}

/** White silhouette of ONLY the front panel (`WIN_B`) — masks the image to the front. */
export function getWindowsFrontMask(): string {
  return `${SVG_OPEN}<path d="${WIN_B}" fill="white"/></svg>`;
}

/** Just the front top-edge shine (the adaptive back supplies its own color). */
export function buildWindowsShineSvg(): string {
  const sh = winShineDefs(0.26, 6);
  return `${SVG_OPEN}<defs>${sh.defs}</defs>${sh.shine}</svg>`;
}

/* ------------------------------------------------------------------------ *
 * Shape-aware front-only image mode (windows + macOS).
 * ------------------------------------------------------------------------ */

/** Does this document render as a front-only image folder (windows or macOS)? */
export function isFrontImage(doc: FolderDocument): boolean {
  if (doc.folderFillMode !== "image") return false;
  const id = findShape(doc.baseShape).id;
  if (id === "windows") return doc.windowsImageMode === "front";
  if (id === "macos") return doc.macImageMode === "front";
  return false;
}

/** White silhouette of ONLY the front panel for the shape (masks the image). */
export function getFrontMask(baseShapeId: string): string {
  const path = findShape(baseShapeId).id === "macos" ? MAC_B : WIN_B;
  return `${SVG_OPEN}<path d="${path}" fill="white"/></svg>`;
}

/**
 * The adaptive back layer painted behind a front-only image, per shape. When a
 * distinct `frontAdaptive2` is present and there's no custom back, the tab
 * auto-derives a gradient from both dominant colors instead of a single tone.
 */
export function buildFrontImageBackSvg(
  baseShapeId: string,
  frontAdaptive: string,
  backColor?: ColorValue | null,
  frontAdaptive2?: string | null,
): string {
  if (findShape(baseShapeId).id === "macos") {
    const [h, s, v] = hexToHsv(frontAdaptive);
    const tab = macImageTab(h, s, v);
    const auto =
      !backColor && frontAdaptive2
        ? autoTabGradientValue(frontAdaptive, frontAdaptive2, (hsv) =>
            macImageTab(hsv[0], hsv[1], hsv[2]),
          )
        : null;
    return `${SVG_OPEN}<defs>${macTabDef(tab, backColor ?? auto)}</defs><path d="${MAC_F}" fill="url(#mgt)"/></svg>`;
  }
  return buildWindowsImageBackSvg(frontAdaptive, backColor, frontAdaptive2);
}

/** The structure overlay drawn on TOP of a front-only image, per shape. */
export function buildFrontImageOverlaySvg(baseShapeId: string): string {
  if (findShape(baseShapeId).id === "macos") return `${SVG_OPEN}${macStructureOverlay()}</svg>`;
  return buildWindowsShineSvg();
}

/**
 * The "with contents" paper sheet as a standalone layer, self-clipped to the
 * peek gap (inside the back panel `WIN_T`, outside the front panel `WIN_B`). For
 * the image-fill composition paths, where the paper is a separate layer drawn
 * ABOVE the image and tint (the image never affects the paper). Returns `null`
 * when the shape isn't windows or the folder isn't in the contents state.
 */
export function buildWindowsPaperSvg(
  baseShapeId: string,
  folderState: FolderState | undefined,
  paperColor?: ColorValue | null,
): string | null {
  if (findShape(baseShapeId).id !== "windows" || folderState !== "contents") return null;
  const paper = windowsPaperDef(paperColor);
  const mask = `<mask id="wpm"><path d="${WIN_T}" fill="white"/><path d="${WIN_B}" fill="black"/></mask>`;
  return `${SVG_OPEN}<defs>${paper.defs}${mask}</defs><g mask="url(#wpm)">${paper.path}</g></svg>`;
}

/**
 * The contents paper sheet as a standalone layer for the image-fill paths, for
 * any base shape that has a paper variant (windows, macOS). Self-clips to the
 * peek region (back silhouette minus front face) so it's drawn ABOVE the image
 * and tint without the image ever affecting it. `null` when N/A.
 */
export function buildBaseShapePaperSvg(
  baseShapeId: string,
  folderState: FolderState | undefined,
  paperColor?: ColorValue | null,
): string | null {
  if (folderState !== "contents") return null;
  const id = findShape(baseShapeId).id;
  if (id === "windows") return buildWindowsPaperSvg(baseShapeId, folderState, paperColor);
  if (id === "macos") {
    const paper = macPaperDef(paperColor);
    const mask = `<mask id="mpm"><path d="${MAC_F}" fill="white"/><path d="${MAC_B}" fill="black"/></mask>`;
    return `${SVG_OPEN}<defs>${paper.defs}${mask}</defs><g mask="url(#mpm)">${paper.path}</g></svg>`;
  }
  return null;
}

/**
 * A solid color tinted over an image fill, masked to the folder silhouette
 * (any base shape). Drawn above the image (and adaptive back) but below the
 * structural shine, so a muting overlay tones down the photo without hiding
 * the folder's shape. `null` when the overlay is off (opacity ≤ 0).
 */
export function buildImageColorOverlaySvg(
  baseShapeId: string,
  color: string,
  opacity: number,
): string | null {
  if (!(opacity > 0)) return null;
  const maskInner = getBaseShapeMask(baseShapeId);
  const op = Math.min(1, opacity).toFixed(3);
  return `${SVG_OPEN}<defs><mask id="ovm"><svg width="256" height="256" viewBox="0 0 256 256">${maskInner}</svg></mask></defs><rect width="256" height="256" fill="${color}" fill-opacity="${op}" mask="url(#ovm)"/></svg>`;
}

/** Image-span options surfaced as a dropdown in the folder Image section. */
export const WINDOWS_IMAGE_MODES: Array<{ id: WindowsImageMode; name: string }> = [
  { id: "full", name: "Full folder" },
  { id: "front", name: "Front only" },
];

/** Human-readable name of a Windows image-span mode. */
export function windowsImageModeName(id: WindowsImageMode): string {
  return WINDOWS_IMAGE_MODES.find((m) => m.id === id)?.name ?? id;
}
