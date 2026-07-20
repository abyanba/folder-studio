/**
 * The pattern layer. Injects the SAME `buildPatternLayerSvg` markup the canvas
 * export rasterizes and the vector export inlines — the layer owns its own
 * folder mask, tiling and (for a gradient foreground) the ink mask, so the
 * editor can't drift from either export.
 *
 * This replaced a CSS `background-repeat` + `mask-image` implementation, which
 * could not express a gradient foreground: the mask and the gradient would have
 * had to rotate independently, and CSS can't rotate a mask image on its own.
 */

import { memo, useEffect, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { CDX, CDY, FH, FW } from "@/lib/constants";
import type { PatternSettings } from "@/types/document";
import { buildPatternLayerSvg } from "@/lib/export/patterns";
import {
  getPatternBody,
  loadPatternBodies,
  patternBodiesVersion,
  subscribePatternBodies,
} from "@/lib/patternBodies";

function PatternOverlayImpl({
  pattern,
  maskSvg,
}: {
  pattern: PatternSettings;
  /** Folder silhouette, or just the front panel for a front-span pattern. */
  maskSvg: string;
}) {
  // The bodies are a lazy chunk; re-render once it lands.
  useSyncExternalStore(subscribePatternBodies, patternBodiesVersion);
  useEffect(() => {
    if (pattern.id !== "none") void loadPatternBodies();
  }, [pattern.id]);

  const body = getPatternBody(pattern.id);
  if (!body) return null;

  const style: CSSProperties = {
    position: "absolute",
    left: -CDX,
    top: -CDY,
    width: FW,
    height: FH,
    pointerEvents: "none",
  };
  return (
    <div
      aria-hidden
      style={style}
      dangerouslySetInnerHTML={{ __html: buildPatternLayerSvg(pattern, body, maskSvg) }}
    />
  );
}

// Memoized on (pattern, maskSvg) so an unrelated drag frame doesn't rebuild the
// layer markup (PF-03).
export const PatternOverlay = memo(PatternOverlayImpl);
