/**
 * The surface material layer. Injects the same `buildMaterialLayerSvg` markup
 * the canvas export rasterizes and the vector export inlines, blended with
 * `soft-light` over everything beneath it — base fill AND pattern, which is
 * what prints the grain onto the pattern instead of letting it float on top.
 *
 * The blend lives here rather than inside the layer SVG because it has to act
 * against the layers already drawn below, not against the layer's own contents.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { CDX, CDY, FH, FW } from "@/lib/constants";
import type { MaterialSettings } from "@/types/document";
import { buildMaterialLayerSvg } from "@/lib/export/materials";

function MaterialOverlayImpl({
  material,
  maskSvg,
}: {
  material: MaterialSettings;
  /** Folder silhouette, or just the front panel for a front-span material. */
  maskSvg: string;
}) {
  const svg = buildMaterialLayerSvg(material, maskSvg);
  if (!svg) return null;

  const style: CSSProperties = {
    position: "absolute",
    left: -CDX,
    top: -CDY,
    width: FW,
    height: FH,
    mixBlendMode: "soft-light",
    pointerEvents: "none",
  };
  return <div aria-hidden style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export const MaterialOverlay = memo(MaterialOverlayImpl);
