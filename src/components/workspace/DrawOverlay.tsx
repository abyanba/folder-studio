/**
 * Content-rect overlay active while the draw tool is on: captures pointer
 * events for `useDrawTool` and renders the live artifacts — the in-progress
 * freehand stroke, the committed line/arc anchors plus a preview segment to
 * the cursor, and the arc handle being dragged out.
 */

import { CDW, CDH } from "@/lib/constants";
import { buildShapeSvgPath, buildSvgPath } from "@/lib/smoothing";
import { getHex } from "@/lib/color";
import { isGradient, type ColorValue } from "@/types/gradient";
import { useUiStore } from "@/store/uiStore";
import { useDrawTool } from "@/hooks/useDrawTool";

/** Solid stroke for live previews (gradients preview as their first stop). */
function previewStroke(color: ColorValue): string {
  if (!isGradient(color)) return color;
  const first = [...color.stops].sort((a, b) => a.pos - b.pos)[0];
  return first ? getHex(first.hue, first.sat, first.bri) : "#ffffff";
}

export function DrawOverlay() {
  const handlers = useDrawTool();
  const drawMode = useUiStore((s) => s.drawMode);
  const drawSubmode = useUiStore((s) => s.drawSubmode);
  const drawColor = useUiStore((s) => s.drawColor);
  const drawSize = useUiStore((s) => s.drawSize);
  const drawOpacity = useUiStore((s) => s.drawOpacity);
  const currentDraw = useUiStore((s) => s.currentDraw);
  const shapePoints = useUiStore((s) => s.shapePoints);
  const shapeCursorPos = useUiStore((s) => s.shapeCursorPos);
  const shapeDragPoint = useUiStore((s) => s.shapeDragPoint);

  const stroke = previewStroke(drawColor);
  const liveShapePts = shapeDragPoint ? [...shapePoints, shapeDragPoint] : shapePoints;
  const shapePath =
    liveShapePts.length || shapeCursorPos
      ? buildShapeSvgPath(
          liveShapePts,
          shapeDragPoint ? null : shapeCursorPos,
          drawSubmode === "arc" ? "arc" : "line",
        )
      : "";

  return (
    <div
      data-draw-overlay
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 150,
        cursor: drawMode === "eraser" ? "cell" : "crosshair",
        touchAction: "none",
      }}
      {...handlers}
    >
      <svg
        width={CDW}
        height={CDH}
        viewBox={`0 0 ${CDW} ${CDH}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
      >
        {currentDraw && (
          <path
            d={buildSvgPath(currentDraw.points)}
            stroke={previewStroke(currentDraw.color)}
            strokeWidth={currentDraw.size}
            opacity={currentDraw.opacity}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {shapePath && drawMode === "pen" && (
          <path
            d={shapePath}
            stroke={stroke}
            strokeWidth={drawSize}
            opacity={drawOpacity * 0.85}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {drawMode === "pen" &&
          (drawSubmode === "line" || drawSubmode === "arc") &&
          liveShapePts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="var(--background)"
              stroke="var(--primary)"
              strokeWidth={1.5}
            />
          ))}
      </svg>
    </div>
  );
}
