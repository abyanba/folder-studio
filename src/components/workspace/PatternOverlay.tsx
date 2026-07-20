/**
 * The pattern layer, masked to the folder silhouette (or just the front panel
 * when `span` is "front"). Sits in the content-rect stack at the pattern's
 * z-position, interleaved by DOM order in `Workspace`.
 *
 * Uses the same `buildPatternSvg` tile as both export paths; only the tiling
 * mechanism differs (CSS `background-repeat` here, `createPattern` on canvas,
 * `<pattern>` in the vector export).
 */

import { memo, useEffect, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { CDX, CDY, FH, FW } from "@/lib/constants";
import type { PatternSettings } from "@/types/document";
import { buildPatternSvg, patternTileSize } from "@/lib/export/patterns";
import {
  getPatternBody,
  loadPatternBodies,
  patternBodiesVersion,
  subscribePatternBodies,
} from "@/lib/patternBodies";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

function PatternOverlayImpl({
  pattern,
  maskUrl,
}: {
  pattern: PatternSettings;
  maskUrl: string;
}) {
  // The bodies are a lazy chunk; re-render once it lands.
  useSyncExternalStore(subscribePatternBodies, patternBodiesVersion);
  useEffect(() => {
    if (pattern.id !== "none") void loadPatternBodies();
  }, [pattern.id]);

  const body = getPatternBody(pattern.id);
  if (!body) return null;

  const tileUrl = toSvgDataUrl(buildPatternSvg(pattern, body));
  const tile = patternTileSize(pattern, body);

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
    overflow: "hidden",
    pointerEvents: "none",
  };
  // Oversized and centred so a rotated tiling still covers every corner.
  const inner: CSSProperties = {
    position: "absolute",
    top: "-60%",
    left: "-60%",
    width: "220%",
    height: "220%",
    backgroundImage: `url("${tileUrl}")`,
    backgroundSize: `${tile.w}px ${tile.h}px`,
    transform: pattern.rotation ? `rotate(${pattern.rotation}deg)` : undefined,
    transformOrigin: "center",
  };
  return (
    <div style={outer}>
      <div style={inner} />
    </div>
  );
}

// Memoized on (pattern, maskUrl) so an unrelated drag frame doesn't rebuild the
// tile SVG and data URL (PF-03).
export const PatternOverlay = memo(PatternOverlayImpl);
