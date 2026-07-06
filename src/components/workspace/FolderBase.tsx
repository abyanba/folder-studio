/**
 * The base folder layer: either a background image (masked to the folder
 * silhouette) or the colored base-shape SVG. Reuses the Phase-3
 * `buildBaseShapeSvg`/`getBaseShapeMask` so the editor base matches the export.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { FW, FH } from "@/lib/constants";
import type { FolderDocument } from "@/types/document";
import { buildBaseShapeSvg, getBaseShapeMask } from "@/lib/export/baseShapes";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

/** Make the 256×256 export SVG fill the editor's FW×FH box (editor-only tweak). */
function responsiveBaseSvg(doc: FolderDocument): string {
  return buildBaseShapeSvg(doc).replace(
    /<svg([^>]*)>/,
    '<svg$1 preserveAspectRatio="none" style="width:100%;height:100%;display:block">',
  );
}

function FolderBaseImpl({ doc }: { doc: FolderDocument }) {
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

  // Inline SVG (not <img src=dataURL>) so a folder-color drag diffs DOM
  // attributes instead of minting a new data URL and re-decoding an image
  // every frame (PF-02).
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: FW,
        height: FH,
        pointerEvents: "none",
        opacity: doc.folderOpacity ?? 1,
      }}
      dangerouslySetInnerHTML={{ __html: responsiveBaseSvg(doc) }}
    />
  );
}

// Memoized: during an element drag `doc` is stable, so the base doesn't
// re-render; a color drag changes `doc` and re-diffs the inline SVG (cheap).
export const FolderBase = memo(FolderBaseImpl);
