/**
 * The texture pattern layer, masked to the folder silhouette. Sits within the
 * content-rect stack at the texture's z-position (interleaved by DOM order in
 * `Workspace`). Reuses the Phase-3 `buildTextureSvg`. Ported from public/legacy.html
 * L1144/L1241.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { FW, FH, CDX, CDY } from "@/lib/constants";
import type { TextureSettings } from "@/types/document";
import { buildTextureSvg } from "@/lib/export/textures";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

function parseAttr(svg: string, attr: string): number {
  const m = svg.match(new RegExp(`${attr}="(\\d+(?:\\.\\d+)?)"`));
  return m ? parseFloat(m[1]) : 10;
}

function TextureOverlayImpl({
  texture,
  maskUrl,
}: {
  texture: TextureSettings;
  maskUrl: string;
}) {
  const svg = buildTextureSvg(texture);
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
    opacity: texture.opacity,
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
    backgroundSize: `${tnw * texture.scale}px ${tnh * texture.scale}px`,
    transform: texture.rotation ? `rotate(${texture.rotation}deg)` : undefined,
    transformOrigin: "center",
  };
  return (
    <div style={outer}>
      <div style={inner} />
    </div>
  );
}

// Memoized on (texture, maskUrl) so it doesn't rebuild the tile SVG + regex-parse
// it on every unrelated drag frame (PF-03); the texture object identity is stable
// unless the texture actually changes.
export const TextureOverlay = memo(TextureOverlayImpl);
