/**
 * Pattern layer composition — the one place a {@link PatternSettings} becomes
 * SVG. All three render paths consume {@link buildPatternLayerSvg}: the editor
 * injects it, the vector export inlines it, and the canvas export rasterizes
 * it. That makes them identical by construction rather than by three
 * implementations agreeing.
 *
 * Pure: the baked {@link PatternBody} and the folder mask are passed in rather
 * than imported, both to keep the ~130KB generated chunk out of this module's
 * graph and so the math is unit-testable without it.
 *
 * Hero Patterns © Steve Schoger, CC BY 4.0.
 */

import { FH, FW } from "@/lib/constants";
import type { PatternBody } from "@/data/generated/patternBodies";
import type { PatternSettings } from "@/types/document";
import { isGradient } from "@/types/gradient";
import { gradientElementUserSpace } from "./gradientSvg";

const num = (n: number): string => (Number.isFinite(n) ? +n.toFixed(3) : 0).toString();

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

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
 * One tile as an SVG string. The motif only — the background is a folder-wide
 * layer, not a per-tile rect, so it can sit under a gradient-masked foreground
 * and so a rotated tiling can't leave gaps at the corners.
 *
 * A gradient foreground paints the motif WHITE: the tile then serves as the
 * alpha mask for a folder-wide gradient, because a gradient baked into the tile
 * would restart every repeat instead of spanning the folder.
 */
export function buildPatternSvg(pattern: PatternSettings, body: PatternBody): string {
  const solid = isGradient(pattern.fgColor) ? "#ffffff" : pattern.fgColor;
  return body.svg
    .split("{{FG}}").join(solid)
    .split("{{FGO}}").join(String(clamp01(pattern.fgOpacity)));
}

/** Stretch a 256-viewBox base-shape SVG to the workspace frame. */
function fillFrame(svg: string): string {
  return svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg width="${FW}" height="${FH}" preserveAspectRatio="none"`);
}

/**
 * The complete pattern layer as one self-contained `FW`×`FH` SVG: optional
 * background wash, then the motif, both confined to `maskSvg` (the folder
 * silhouette, or just its front panel).
 *
 * `idPrefix` namespaces the internal ids so the markup can be inlined next to
 * other defs in the vector export without colliding.
 */
export function buildPatternLayerSvg(
  pattern: PatternSettings,
  body: PatternBody,
  maskSvg: string,
  idPrefix = "p",
): string {
  const t = patternTileSize(pattern, body);
  const tile = buildPatternSvg(pattern, body);
  const rot = pattern.rotation || 0;
  const bgOpacity = clamp01(pattern.bgOpacity);

  const ids = {
    tile: `${idPrefix}tile`,
    ink: `${idPrefix}ink`,
    folder: `${idPrefix}folder`,
    grad: `${idPrefix}grad`,
  };

  // patternTransform rotates the tiling itself, so a gradient foreground stays
  // fixed to the folder while the motif spins — no overdraw layer needed.
  const transform = rot
    ? ` patternTransform="rotate(${num(rot)} ${num(FW / 2)} ${num(FH / 2)})"`
    : "";

  const defs: string[] = [
    `<pattern id="${ids.tile}" patternUnits="userSpaceOnUse" x="${num(pattern.offsetX || 0)}" y="${num(pattern.offsetY || 0)}" width="${num(t.w)}" height="${num(t.h)}"${transform}>` +
      // The viewBox is load-bearing: the tile carries its own natural size, so
      // without it the motif paints at that size in the corner of a scaled cell.
      `<svg x="0" y="0" width="${num(t.w)}" height="${num(t.h)}" viewBox="0 0 ${num(body.w)} ${num(body.h)}" preserveAspectRatio="none">${tile}</svg>` +
      `</pattern>`,
    `<mask id="${ids.folder}"><svg x="0" y="0" width="${FW}" height="${FH}">${fillFrame(maskSvg)}</svg></mask>`,
  ];

  const layers: string[] = [];
  if (bgOpacity > 0) {
    layers.push(
      `<rect width="${FW}" height="${FH}" fill="${pattern.bgColor}" fill-opacity="${num(bgOpacity)}"/>`,
    );
  }

  if (isGradient(pattern.fgColor)) {
    // The white tile becomes an alpha mask over a folder-wide gradient.
    defs.push(
      `<mask id="${ids.ink}"><rect width="${FW}" height="${FH}" fill="url(#${ids.tile})"/></mask>`,
      gradientElementUserSpace(ids.grad, pattern.fgColor, FW, FH),
    );
    layers.push(
      `<rect width="${FW}" height="${FH}" fill="url(#${ids.grad})" mask="url(#${ids.ink})"/>`,
    );
  } else {
    layers.push(`<rect width="${FW}" height="${FH}" fill="url(#${ids.tile})"/>`);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">` +
    `<defs>${defs.join("")}</defs>` +
    `<g mask="url(#${ids.folder})">${layers.join("")}</g>` +
    `</svg>`
  );
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
