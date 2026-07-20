/**
 * Pattern tile composition — the one place a {@link PatternSettings} becomes an
 * SVG string, shared by all three render paths (editor overlay, canvas export,
 * vector export) so they can't drift.
 *
 * Pure: the baked {@link PatternBody} is passed in rather than imported, both to
 * keep the 130KB generated module out of this module's graph and so the math is
 * unit-testable without it. `lib/patternBodies.ts` owns the lazy load.
 *
 * Hero Patterns © Steve Schoger, CC BY 4.0.
 */

import type { PatternBody } from "@/data/generated/patternBodies";
import type { PatternSettings } from "@/types/document";

/** Effective tile size in workspace units, after the baked + user scale. */
export function patternTileSize(
  pattern: PatternSettings,
  body: PatternBody,
): { w: number; h: number } {
  // The baked defaultScale normalises tiles that span 8px→600px upstream; the
  // user's `scale` multiplies it, so 1 means "the tuned default".
  const s = body.defaultScale * (pattern.scale || 1);
  return { w: Math.max(1, body.w * s), h: Math.max(1, body.h * s) };
}

/**
 * One tile as an SVG string, with the foreground placeholders substituted and
 * an optional background rect painted behind the motif.
 */
export function buildPatternSvg(pattern: PatternSettings, body: PatternBody): string {
  const svg = body.svg
    .split("{{FG}}").join(pattern.fgColor)
    .split("{{FGO}}").join(String(clamp01(pattern.fgOpacity)));

  const bgOpacity = clamp01(pattern.bgOpacity);
  // A fully transparent background is the default, so skip the rect entirely
  // rather than emitting a no-op one into every tile.
  if (bgOpacity <= 0) return svg;

  // Inserted immediately after the opening tag so it paints BEHIND the motif —
  // the tile's own paths follow it in document order.
  return svg.replace(
    /(<svg[^>]*>)/,
    `$1<rect width="100%" height="100%" fill="${pattern.bgColor}" fill-opacity="${bgOpacity}"/>`,
  );
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/**
 * Which folder mask the pattern layer is confined to. Only windows/macOS have a
 * front/back split, so every other base shape spans the full silhouette however
 * `span` is set — mirroring `isFrontImage`'s shape check.
 */
export function isFrontPattern(baseShape: string, pattern: PatternSettings): boolean {
  if (pattern.span !== "front") return false;
  return baseShape === "windows" || baseShape === "macos";
}
