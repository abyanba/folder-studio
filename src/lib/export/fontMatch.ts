/**
 * Which `@font-face` to embed for a requested (family, weight, style).
 *
 * Split out of `svgFonts` because that module is browser-only (it walks
 * `document.styleSheets` and fetches), while the choice itself is pure string
 * and number work — and it is the part that was wrong.
 *
 * The SVG export used to demand an EXACT weight match. CSS does not: a browser
 * asked for 600 in a family that only ships 400 renders the 400 face, which is
 * why the editor and the PNG export looked right while the SVG silently
 * embedded nothing and fell back to a serif. Single-weight display faces
 * (Bungee, Lobster, Pacifico…) hit this every time they are set to anything but
 * regular.
 */

/** A font-face descriptor, as read from a CSSFontFaceRule or requested by text. */
export interface FaceDescriptor {
  family: string;
  /** A single weight ("400") or a range ("400 700"), as `@font-face` allows. */
  weight: string;
  style: string;
}

const norm = (s: string): string => s.trim().toLowerCase();

/** Numeric weights a descriptor covers: one value, or the ends of a range. */
function weightRange(weight: string): [number, number] {
  const parts = weight
    .trim()
    .split(/\s+/)
    .map((w) => Number(w))
    .filter((n) => Number.isFinite(n));
  if (!parts.length) return [400, 400];
  return [Math.min(...parts), Math.max(...parts)];
}

/**
 * How far a candidate is from the wanted weight — 0 when the candidate covers
 * it (including anywhere inside a variable font's range).
 */
export function weightDistance(candidate: string, wanted: string): number {
  const want = Number(wanted);
  const [lo, hi] = weightRange(candidate);
  if (!Number.isFinite(want)) return 0;
  if (want >= lo && want <= hi) return 0;
  return want < lo ? lo - want : want - hi;
}

/**
 * The best available face for `want`, or null when the family isn't present.
 *
 * Same family is required — substituting another family would silently change
 * the design. Weight and style are allowed to bend, nearest first, because a
 * near weight in the right family is what the browser itself renders.
 */
export function pickFace<T extends FaceDescriptor>(
  candidates: readonly T[],
  want: FaceDescriptor,
): T | null {
  const family = candidates.filter((c) => norm(c.family) === norm(want.family));
  if (!family.length) return null;

  // Matching style wins outright: an upright face is a poor stand-in for an
  // italic one however close its weight, since the browser would rather slant
  // the real italic's absence than restyle a matched weight.
  const sameStyle = family.filter((c) => norm(c.style || "normal") === norm(want.style || "normal"));
  const pool = sameStyle.length ? sameStyle : family;

  return pool.reduce((best, c) => {
    const d = weightDistance(c.weight, want.weight);
    const bd = weightDistance(best.weight, want.weight);
    if (d !== bd) return d < bd ? c : best;
    // Equidistant — 600 sits exactly between 500 and 700. CSS resolves this by
    // direction, not by "nearest": below 400 it searches lighter faces first,
    // at 400 and above it searches heavier faces first. Picking the lighter
    // face unconditionally would render a semibold request as medium.
    const [clo] = weightRange(c.weight);
    const [blo] = weightRange(best.weight);
    const preferHeavier = Number(want.weight) >= 400;
    return (preferHeavier ? clo > blo : clo < blo) ? c : best;
  });
}
