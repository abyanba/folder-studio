/**
 * The editor canvas: a fixed FW×FH folder (base + interleaved texture + elements)
 * with selection chrome, marquee, and snap guides — the DOM twin of
 * `buildExportCanvas`. Drives pointer interaction through `useInteraction`, whose
 * live drag transforms are applied to both elements and selection chrome.
 */

import { useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { FW, FH, CDX, CDY, CDW, CDH } from "@/lib/constants";
import type { FolderElement } from "@/types/element";
import { getBaseShapeMask } from "@/lib/export/baseShapes";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { useInteraction } from "@/hooks/useInteraction";
import type { LiveOverride } from "@/hooks/useInteraction";
import { FolderBase } from "./FolderBase";
import { TextureOverlay } from "./TextureOverlay";
import { ElementView } from "./ElementView";
import { SelectionOverlay } from "./SelectionOverlay";
import { DrawOverlay } from "./DrawOverlay";
import { ElementContextMenu } from "./ElementContextMenu";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { AlignBar } from "./AlignBar";
import type { EffectiveRect } from "./SelectionOverlay";

function effective(el: FolderElement, o: LiveOverride | undefined): EffectiveRect {
  return {
    id: el.id,
    x: o?.x ?? el.x,
    y: o?.y ?? el.y,
    width: o?.width ?? el.width,
    height: o?.height ?? el.height,
    rotation: o?.rotation ?? el.rotation,
    hidden: el.visible === false,
  };
}

export function Workspace() {
  const doc = useDocumentStore((s) => s.doc);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const drawToolActive = useUiStore((s) => s.activeTool === "draw");
  const canvasLight = useUiStore((s) => s.canvasLight);
  const wsRef = useRef<HTMLDivElement>(null);
  const { state, beginMove, beginResize, beginRotate, beginMarquee } = useInteraction(wsRef);
  const { overrides, marquee, snap } = state;

  const tz = Math.min(doc.textureLayerZ, doc.elements.length);
  // Pure function of the base shape — don't rebuild the mask data URL every
  // drag frame (PF-03).
  const maskUrl = useMemo(() => toSvgDataUrl(getBaseShapeMask(doc.baseShape)), [doc.baseShape]);

  const renderEl = (el: FolderElement) =>
    el.visible === false && !selectedIds.includes(el.id) ? null : (
      <ElementView key={el.id} el={el} override={overrides[el.id]} onPointerDown={beginMove} />
    );

  const selectedEls = doc.elements
    .filter((e) => selectedIds.includes(e.id))
    .map((e) => effective(e, overrides[e.id]));

  // The clip mask applies to the content layer only, so selection handles,
  // marquee, and snap guides are never clipped near the folder edge (fixes a
  // legacy quirk flagged in Phase 4).
  const contentLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    ...(doc.clipToFolder
      ? {
          WebkitMaskImage: `url("${maskUrl}")`,
          maskImage: `url("${maskUrl}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }
      : {}),
  };

  const contentRect: CSSProperties = {
    position: "absolute",
    left: CDX,
    top: CDY,
    width: CDW,
    height: CDH,
    overflow: "visible",
  };

  return (
    <ElementContextMenu>
      <div
        className={`relative flex flex-1 items-center justify-center overflow-hidden transition-colors ${
          canvasLight ? "bg-neutral-200" : ""
        }`}
        style={{ touchAction: "none" }}
        // Marquee-select spans the whole visible workspace pane, not just the
        // FW×FH canvas — a drag can start in the surrounding padding and still
        // pick up elements once it crosses into the content rect (only the
        // canvas area itself is ever exported).
        onPointerDown={(e) => {
          if (useUiStore.getState().editingTextId) return;
          // The draw tool owns the canvas — don't also start a marquee (IN-12).
          if (drawToolActive) return;
          beginMarquee(e);
        }}
      >
        <WorkspaceGrid />
        <AlignBar />
        <div
          ref={wsRef}
          data-ws
          style={{ position: "relative", width: FW, height: FH, touchAction: "none" }}
        >
        <div style={contentLayerStyle}>
          <FolderBase doc={doc} />
          <div style={contentRect}>
            {doc.elements.slice(0, tz).map(renderEl)}
            {doc.texture.id !== "none" && <TextureOverlay texture={doc.texture} maskUrl={maskUrl} />}
            {doc.elements.slice(tz).map(renderEl)}
          </div>
        </div>
        <div style={{ ...contentRect, pointerEvents: "none" }}>
          <SelectionOverlay
            selected={selectedEls}
            primaryId={selectedId}
            onResizeDown={beginResize}
            onRotateDown={beginRotate}
          />
          {drawToolActive && <DrawOverlay />}
          {marquee && (
            <div
              style={{
                position: "absolute",
                left: marquee.x,
                top: marquee.y,
                width: marquee.width,
                height: marquee.height,
                border: "1.5px dashed var(--primary)",
                background: "color-mix(in oklch, var(--primary) 8%, transparent)",
                borderRadius: 2,
                pointerEvents: "none",
                zIndex: 200,
              }}
            />
          )}
          {snap.v && (
            <div
              style={{
                position: "absolute",
                left: snap.vx ?? CDW / 2,
                top: -20,
                width: 0,
                height: CDH + 40,
                borderLeft: "1px dashed var(--primary)",
                pointerEvents: "none",
                zIndex: 30,
                opacity: 0.7,
              }}
            />
          )}
          {snap.h && (
            <div
              style={{
                position: "absolute",
                top: snap.hy ?? CDH / 2,
                left: -20,
                height: 0,
                width: CDW + 40,
                borderTop: "1px dashed var(--primary)",
                pointerEvents: "none",
                zIndex: 30,
                opacity: 0.7,
              }}
            />
          )}
        </div>
        </div>
      </div>
    </ElementContextMenu>
  );
}
