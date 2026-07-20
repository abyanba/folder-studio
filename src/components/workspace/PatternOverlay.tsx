/**
 * The pattern pattern layer, masked to the folder silhouette. Sits within the
 * content-rect stack at the pattern's z-position (interleaved by DOM order in
 * `Workspace`). Reuses the Phase-3 `buildPatternSvg`. Ported from public/legacy.html
 * L1144/L1241.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { FW, FH, CDX, CDY } from "@/lib/constants";
import type { PatternSettings } from "@/types/document";
import { buildPatternSvg } from "@/lib/export/patterns";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

function parseAttr(svg: string, attr: string): number {
  const m = svg.match(new RegExp(`${attr}="(\\d+(?:\\.\\d+)?)"`));
  return m ? parseFloat(m[1]) : 10;
}

function PatternOverlayImpl({
  pattern,
  maskUrl,
}: {
  pattern: PatternSettings;
  maskUrl: string;
}) {
  const svg = buildPatternSvg(pattern);
  if (!svg) return null;
  const tileUrl = toSvgDataUrl(svg);
  const tnw = parseAttr(svg, "width");
  const tnh = parseAttr(svg, "height");

  const outer: CSSProperties = {
    position: "absolute",
    left: -CDX,
    top: -CDY,
    width: FW,
    height: FH,
    WebkitMaskImage: `url("${maskUrl}")`,
    maskImage: `url("${maskUrl}")`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    opacity: pattern.opacity,
    overflow: "hidden",
    pointerEvents: "none",
  };
  const inner: CSSProperties = {
    position: "absolute",
    top: "-60%",
    left: "-60%",
    width: "220%",
    height: "220%",
    backgroundImage: `url("${tileUrl}")`,
    backgroundSize: `${tnw * pattern.scale}px ${tnh * pattern.scale}px`,
    transform: pattern.rotation ? `rotate(${pattern.rotation}deg)` : undefined,
    transformOrigin: "center",
  };
  return (
    <div style={outer}>
      <div style={inner} />
    </div>
  );
}

// Memoized on (pattern, maskUrl) so it doesn't rebuild the tile SVG + regex-parse
// it on every unrelated drag frame (PF-03); the pattern object identity is stable
// unless the pattern actually changes.
export const PatternOverlay = memo(PatternOverlayImpl);
