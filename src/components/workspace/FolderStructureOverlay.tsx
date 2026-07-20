/**
 * The folder's HIGHLIGHTS (Windows shine, macOS seam + the two rim stripes)
 * re-applied ON TOP of the pattern layer, so a pattern doesn't flatten the
 * folder by burying them.
 *
 * Deliberately `buildFrontImageOverlaySvg`, not `buildBaseShapeOverlaySvg`: the
 * latter also carries a darkening vignette, which a colour fill already has
 * baked into its base — applying it again visibly double-darkens the folder
 * even at 10% pattern opacity. This builder is highlights only.
 *
 * Deliberately NOT inside `PatternOverlay`'s masked wrapper: a front-span
 * pattern is clipped to the front panel, and the structure has to keep spanning
 * the whole folder.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { CDX, CDY, FH, FW } from "@/lib/constants";
import { buildFrontImageOverlaySvg } from "@/lib/export/baseShapes";

function responsive(svg: string): string {
  return svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg width="100%" height="100%" preserveAspectRatio="none"`);
}

function FolderStructureOverlayImpl({ baseShape }: { baseShape: string }) {
  const svg = buildFrontImageOverlaySvg(baseShape);
  if (!svg) return null; // shapes with no structural shading
  const style: CSSProperties = {
    position: "absolute",
    left: -CDX,
    top: -CDY,
    width: FW,
    height: FH,
    pointerEvents: "none",
  };
  return <div aria-hidden style={style} dangerouslySetInnerHTML={{ __html: responsive(svg) }} />;
}

export const FolderStructureOverlay = memo(FolderStructureOverlayImpl);
