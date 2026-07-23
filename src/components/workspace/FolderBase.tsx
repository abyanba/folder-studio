/**
 * The base folder layer: either a background image (masked to the folder
 * silhouette) or the colored base-shape SVG. Reuses the Phase-3
 * `buildBaseShapeSvg`/`getBaseShapeMask` so the editor base matches the export.
 */

import { memo } from "react";
import type { CSSProperties } from "react";
import { FW, FH } from "@/lib/constants";
import type { FolderDocument } from "@/types/document";
import {
  buildBaseShapeOverlaySvg,
  buildBaseShapePaperSvg,
  buildBaseShapeSvg,
  buildBaseShapeUnderlaySvg,
  buildFrontImageBackSvg,
  buildFrontImageOverlaySvg,
  buildImageColorOverlaySvg,
  folderGroupOpacity,
  frontImageAlpha,
  getBaseShapeFillMask,
  getFrontMask,
  isFrontImage,
  shapeVariant,
} from "@/lib/export/baseShapes";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { isGradient } from "@/types/gradient";
import { useUiStore } from "@/store/uiStore";

/** Make a 256×256 export SVG fill the editor's FW×FH box (editor-only tweak). */
function responsive(svg: string): string {
  return svg.replace(
    /<svg([^>]*)>/,
    '<svg$1 preserveAspectRatio="none" style="width:100%;height:100%;display:block">',
  );
}

function FolderBaseImpl({ doc: rawDoc }: { doc: FolderDocument }) {
  // Live-preview the color profile being hovered in the panel, without
  // committing it to the (undoable) document. Each slot targets one
  // shape+fill combination; only the matching one applies.
  const winGradientPreview = useUiStore((s) => s.windowsGradientPreview);
  const winSolidPreview = useUiStore((s) => s.windowsColorProfilePreview);
  const macSolidPreview = useUiStore((s) => s.macColorProfilePreview);
  const macGradientPreview = useUiStore((s) => s.macGradientPreview);
  const papirusSolidPreview = useUiStore((s) => s.papirusColorProfilePreview);
  const yaruProfilePreview = useUiStore((s) => s.yaruColorProfilePreview);
  const imageSpanPreview = useUiStore((s) => s.imageSpanPreview);
  const isColor = rawDoc.folderFillMode === "color";
  const isGrad = isColor && isGradient(rawDoc.folderColor);
  let doc = rawDoc;
  // Preview the hovered image span on the folder base (mac uses its own field).
  if (imageSpanPreview && rawDoc.folderFillMode === "image") {
    doc =
      rawDoc.baseShape === "macos"
        ? { ...rawDoc, macImageMode: imageSpanPreview }
        : { ...rawDoc, windowsImageMode: imageSpanPreview };
  }
  if (winGradientPreview && rawDoc.baseShape === "windows" && isGrad) {
    doc = { ...rawDoc, windowsGradientAlgo: winGradientPreview };
  } else if (winSolidPreview && rawDoc.baseShape === "windows" && isColor && !isGrad) {
    doc = { ...rawDoc, windowsColorProfile: winSolidPreview };
  } else if (macGradientPreview && rawDoc.baseShape === "macos" && isGrad) {
    doc = { ...rawDoc, macGradientAlgo: macGradientPreview };
  } else if (macSolidPreview && rawDoc.baseShape === "macos" && isColor && !isGrad) {
    doc = { ...rawDoc, macColorProfile: macSolidPreview };
  } else if (papirusSolidPreview && rawDoc.baseShape === "papirus" && isColor && !isGrad) {
    doc = { ...rawDoc, papirusColorProfile: papirusSolidPreview };
  } else if (yaruProfilePreview && rawDoc.baseShape === "yaru" && isColor) {
    doc = { ...rawDoc, yaruColorProfile: yaruProfilePreview };
  }

  if (doc.folderFillMode === "image" && doc.folderBgImage) {
    const frontMode = isFrontImage(doc);
    // Front-only: the image is masked to the front panel and the tab/back is
    // painted with the adaptive color; full: image spans the fill silhouette
    // (everything except the fixed paper peek + drop shadow).
    const maskUrl = toSvgDataUrl(frontMode ? getFrontMask(doc.baseShape, shapeVariant(doc)) : getBaseShapeFillMask(doc));
    const opacity = folderGroupOpacity(doc);
    // Fluent paints its front image translucent, so the covered paper frosts
    // through it (front-only mode only — full-span has nothing behind it).
    const imgOpacity = frontMode ? opacity * frontImageAlpha(doc) : opacity;
    const fill: CSSProperties = { position: "absolute", inset: 0, width: FW, height: FH, pointerEvents: "none" };
    const style: CSSProperties = {
      ...fill,
      backgroundImage: `url("${doc.folderBgImage}")`,
      backgroundSize: `${(doc.folderBgZoom || 1) * 100}%`,
      backgroundPosition: `${doc.folderBgX ?? 50}% ${doc.folderBgY ?? 50}%`,
      opacity: imgOpacity,
      WebkitMaskImage: `url("${maskUrl}")`,
      maskImage: `url("${maskUrl}")`,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    };
    // Full: one shading overlay (dark back + shine). Front: an adaptive back
    // layer behind the image + a shine-only overlay on top.
    const backSvg = frontMode
      ? buildFrontImageBackSvg(
          doc.baseShape,
          doc.folderBgImageColor ?? "#888888",
          doc.folderBackColor,
          doc.folderBgImageColor2,
          shapeVariant(doc),
          doc.folderPaperColor,
        )
      : null;
    const overlay = frontMode
      ? buildFrontImageOverlaySvg(doc.baseShape, shapeVariant(doc))
      : buildBaseShapeOverlaySvg(doc.baseShape, shapeVariant(doc));
    // Color tint over the image (masked to the folder), below the structure.
    const tint = buildImageColorOverlaySvg(doc.baseShape, doc.folderBgOverlayColor, doc.folderBgOverlayOpacity, shapeVariant(doc));
    // The paper peek is the top-most layer so the image, tint and shading never
    // affect it (it self-clips to the tab→front gap). Front mode already has it
    // in the reused back layer, so only draw the separate paper for full mode.
    const paper =
      frontMode && (doc.baseShape === "papirus" || doc.baseShape === "fluent")
        ? null
        : buildBaseShapePaperSvg(doc.baseShape, doc.folderState, doc.folderPaperColor);
    // Structure drawn BELOW the image (full mode only) — the Papirus drop shadow.
    const underlay = frontMode ? null : buildBaseShapeUnderlaySvg(doc.baseShape);
    return (
      <>
        {underlay && (
          <div aria-hidden style={{ ...fill, opacity }} dangerouslySetInnerHTML={{ __html: responsive(underlay) }} />
        )}
        {backSvg && (
          <div aria-hidden style={{ ...fill, opacity }} dangerouslySetInnerHTML={{ __html: responsive(backSvg) }} />
        )}
        <div style={style} />
        {tint && (
          <div aria-hidden style={{ ...fill, opacity }} dangerouslySetInnerHTML={{ __html: responsive(tint) }} />
        )}
        {overlay && (
          <div aria-hidden style={{ ...fill, opacity }} dangerouslySetInnerHTML={{ __html: responsive(overlay) }} />
        )}
        {paper && (
          <div aria-hidden style={{ ...fill, opacity }} dangerouslySetInnerHTML={{ __html: responsive(paper) }} />
        )}
      </>
    );
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
        opacity: folderGroupOpacity(doc),
      }}
      dangerouslySetInnerHTML={{ __html: responsive(buildBaseShapeSvg(doc)) }}
    />
  );
}

// Memoized: during an element drag `doc` is stable, so the base doesn't
// re-render; a color drag changes `doc` and re-diffs the inline SVG (cheap).
export const FolderBase = memo(FolderBaseImpl);
