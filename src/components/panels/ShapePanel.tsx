/**
 * Base-shape picker: 2-column grid of grayscale shape thumbnails. Picking a
 * shape applies its per-shape defaults (solid color, clipToFolder) in a single
 * undo entry via `applyBaseShape`, matching the legacy shape panel.
 */

import { BASE_SHAPES, type BaseShapeDef } from "@/lib/export/baseShapes";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { getHex } from "@/lib/color";
import { useDocumentStore } from "@/store/documentStore";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

/** Grayscale preview: fake a neutral solid fill through each shape's builder. */
function thumbnailUrl(shape: BaseShapeDef): string {
  const gray = "#9a9a9a";
  if (shape.buildSvg) {
    return toSvgDataUrl(
      shape.buildSvg({
        mode: "solid",
        hue: 0,
        sat: 0,
        bri: 0.6,
        stops: [],
        gradType: "linear",
        gradAngle: 0,
      }),
    );
  }
  return toSvgDataUrl(
    (shape.svg ?? "").replace(/__DEFS__/g, "").replace(/__COLOR__/g, gray),
  );
}

const THUMBS = new Map(BASE_SHAPES.map((s) => [s.id, thumbnailUrl(s)]));

export function ShapePanel() {
  const baseShape = useDocumentStore((s) => s.doc.baseShape);
  const applyBaseShape = useDocumentStore((s) => s.applyBaseShape);

  return (
    <div>
      <PanelHeader title="Base Shape" />
      <div className="grid grid-cols-2 gap-2 p-3">
        {BASE_SHAPES.map((shape) => {
          const active = baseShape === shape.id;
          return (
            <button
              key={shape.id}
              type="button"
              onClick={() =>
                applyBaseShape(shape.id, {
                  folderColor: getHex(...shape.defaultHsv),
                  clipToFolder: shape.defaultClip,
                })
              }
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-transparent bg-muted/40 hover:border-border hover:bg-muted",
              )}
            >
              <img
                src={THUMBS.get(shape.id)}
                alt=""
                draggable={false}
                className="pointer-events-none size-[70%] object-contain opacity-80"
              />
              <span
                className={cn(
                  "text-[11px]",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {shape.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
