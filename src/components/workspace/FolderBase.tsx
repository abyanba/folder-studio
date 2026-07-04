/**
 * The base folder layer: either a background image (masked to the folder
 * silhouette) or the colored base-shape SVG. Reuses the Phase-3
 * `buildBaseShapeSvg`/`getBaseShapeMask` so the editor base matches the export.
 */

import type { CSSProperties } from "react";
import { FW, FH } from "@/lib/constants";
import type { FolderDocument } from "@/types/document";
import { buildBaseShapeSvg, getBaseShapeMask } from "@/lib/export/baseShapes";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

export function FolderBase({ doc }: { doc: FolderDocument }) {
  if (doc.folderFillMode === "image" && doc.folderBgImage) {
    const maskUrl = toSvgDataUrl(getBaseShapeMask(doc.baseShape));
    const style: CSSProperties = {
      position: "absolute",
      inset: 0,
      width: FW,
      height: FH,
      backgroundImage: `url("${doc.folderBgImage}")`,
      backgroundSize: `${(doc.folderBgZoom || 1) * 100}%`,
      backgroundPosition: `${doc.folderBgX ?? 50}% ${doc.folderBgY ?? 50}%`,
      opacity: doc.folderOpacity ?? 1,
      WebkitMaskImage: `url("${maskUrl}")`,
      maskImage: `url("${maskUrl}")`,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      pointerEvents: "none",
    };
    return <div style={style} />;
  }

  return (
    <img
      src={toSvgDataUrl(buildBaseShapeSvg(doc))}
      draggable={false}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: FW,
        height: FH,
        display: "block",
        pointerEvents: "none",
        opacity: doc.folderOpacity ?? 1,
      }}
    />
  );
}
