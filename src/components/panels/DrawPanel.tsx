/**
 * Free-draw panel: start/stop the tool, pen vs eraser, freehand/line/arc
 * submodes (switching discards in-progress anchors), gradient-capable stroke
 * color, size/opacity with a live stroke preview, and Clear All. A selected
 * draw element instead shows its editor (path preview, stroke, transform).
 */

import { Eraser, Pen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { TransformFields } from "@/components/controls/TransformFields";
import { strokeSizePatch } from "@/lib/draw";
import { getHex } from "@/lib/color";
import { isGradient, type ColorValue } from "@/types/gradient";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore, type DrawMode, type DrawSubmode } from "@/store/uiStore";
import type { DrawElement } from "@/types/element";
import { PanelHeader } from "./PanelHeader";
import { commitShapePoints } from "@/hooks/useDrawTool";

const HINTS: Record<DrawSubmode, string> = {
  freehand: "Click and drag on the folder to draw. Strokes are smoothed automatically.",
  line: "Click to place points. Double-click or press Enter to finish, Escape to cancel.",
  arc: "Click and drag to place curved points. Double-click or press Enter to finish.",
};

function solidPreview(color: ColorValue): string {
  if (!isGradient(color)) return color;
  const first = [...color.stops].sort((a, b) => a.pos - b.pos)[0];
  return first ? getHex(first.hue, first.sat, first.bri) : "#ffffff";
}

/** A smooth sine wave across the box, so the pen preview reads as a real stroke. */
function wavePath(w: number, h: number, amp: number): string {
  const mid = h / 2;
  const n = 48;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const y = mid + Math.sin((i / n) * Math.PI * 4) * amp;
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

function SelectedDrawEditor({ el }: { el: DrawElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);

  return (
    <div className="space-y-4">
      <div
        className="flex h-20 items-center justify-center rounded-lg border bg-muted/40 p-2"
        aria-label="Drawing preview"
      >
        <svg
          viewBox={`0 0 ${el.origWidth} ${el.origHeight}`}
          className="max-h-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d={el.svgPath}
            stroke={solidPreview(el.stroke.color)}
            strokeWidth={el.stroke.size}
            fill="none"
            strokeLinecap={el.stroke.linecap}
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="flex items-end gap-2">
        <SliderField
          label="Stroke size"
          value={el.stroke.size}
          min={1}
          max={40}
          // Re-pad/re-center the box so a wider stroke grows cleanly instead of
          // clipping at the baked viewBox edge (Figma-like).
          onChange={(v) => updateElement(el.id, strokeSizePatch(el, v))}
          className="flex-1"
        />
        <ColorField
          value={el.stroke.color}
          onChange={(v) => updateElement(el.id, { stroke: { ...el.stroke, color: v } })}
          allowGradient
          ariaLabel="Stroke color"
        />
      </div>

      <TransformFields el={el} />
    </div>
  );
}

export function DrawPanel() {
  const activeTool = useUiStore((s) => s.activeTool);
  const setActiveTool = useUiStore((s) => s.setActiveTool);
  const drawMode = useUiStore((s) => s.drawMode);
  const setDrawMode = useUiStore((s) => s.setDrawMode);
  const drawSubmode = useUiStore((s) => s.drawSubmode);
  const setDrawSubmode = useUiStore((s) => s.setDrawSubmode);
  const drawColor = useUiStore((s) => s.drawColor);
  const setDrawColor = useUiStore((s) => s.setDrawColor);
  const drawSize = useUiStore((s) => s.drawSize);
  const setDrawSize = useUiStore((s) => s.setDrawSize);
  const drawOpacity = useUiStore((s) => s.drawOpacity);
  const setDrawOpacity = useUiStore((s) => s.setDrawOpacity);
  const shapePoints = useUiStore((s) => s.shapePoints);
  const clearDrawings = useDocumentStore((s) => s.clearDrawings);
  const hasDrawings = useDocumentStore((s) => s.doc.elements.some((e) => e.type === "draw"));

  const selectedId = useSelectionStore((s) => s.selectedId);
  const el = useDocumentStore((s) =>
    s.doc.elements.find((e) => e.id === selectedId && e.type === "draw"),
  ) as DrawElement | undefined;

  const drawing = activeTool === "draw";

  if (el && !drawing) {
    return (
      <div>
        <PanelHeader title="Free Draw" />
        <div className="space-y-4 p-3">
          <SelectedDrawEditor el={el} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="Free Draw" />
      <div className="space-y-4 p-3">
        <Button
          variant={drawing ? "secondary" : "default"}
          size="sm"
          className="h-8 w-full text-xs"
          onClick={() => setActiveTool(drawing ? null : "draw")}
        >
          <Pencil className="size-3.5" />
          {drawing ? "Stop Drawing" : "Start Drawing"}
        </Button>

        {drawing && (
          <>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {drawMode === "eraser"
                ? "Click or drag over drawings to erase them."
                : HINTS[drawSubmode]}
            </p>

            <PanelSection title="Mode">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                className="w-full"
                value={drawMode}
                onValueChange={(v) => {
                  if (v) setDrawMode(v as DrawMode);
                }}
              >
                <ToggleGroupItem value="pen" className="flex-1 text-xs">
                  <Pen className="size-3" /> Pen
                </ToggleGroupItem>
                <ToggleGroupItem value="eraser" className="flex-1 text-xs">
                  <Eraser className="size-3" /> Eraser
                </ToggleGroupItem>
              </ToggleGroup>
            </PanelSection>

            {drawMode === "pen" && (
              <>
                <PanelSection title="Draw tool">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    value={drawSubmode}
                    onValueChange={(v) => {
                      if (v) setDrawSubmode(v as DrawSubmode);
                    }}
                  >
                    <ToggleGroupItem value="freehand" className="flex-1 text-xs">
                      Freehand
                    </ToggleGroupItem>
                    <ToggleGroupItem value="line" className="flex-1 text-xs">
                      Line
                    </ToggleGroupItem>
                    <ToggleGroupItem value="arc" className="flex-1 text-xs">
                      Arc
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {shapePoints.length >= 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-full text-[11px]"
                      onClick={commitShapePoints}
                    >
                      Finish path ({shapePoints.length} point
                      {shapePoints.length === 1 ? "" : "s"})
                    </Button>
                  )}
                </PanelSection>

                <div className="flex items-end gap-2">
                  <SliderField
                    label="Size"
                    value={drawSize}
                    min={1}
                    max={40}
                    onChange={setDrawSize}
                    undoGroup={false}
                    className="flex-1"
                  />
                  <ColorField
                    value={drawColor}
                    onChange={setDrawColor}
                    allowGradient
                    ariaLabel="Draw color"
                  />
                </div>
                <SliderField
                  label="Opacity"
                  value={drawOpacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={setDrawOpacity}
                  undoGroup={false}
                  format={(v) => `${Math.round(v * 100)}%`}
                />

                <PanelSection title="Preview">
                  <div className="rounded-lg border bg-muted/40 px-3 py-1.5">
                    {(() => {
                      const sw = Math.min(drawSize, 40);
                      const amp = Math.max(3, (48 - sw) / 2 - 3);
                      const grad = isGradient(drawColor) ? drawColor : null;
                      const stops = grad ? [...grad.stops].sort((a, b) => a.pos - b.pos) : [];
                      return (
                        <svg viewBox="0 0 200 48" preserveAspectRatio="none" className="h-11 w-full">
                          {grad && (
                            <defs>
                              <linearGradient id="drawWavePreview" x1="0" y1="0" x2="1" y2="0">
                                {stops.map((st) => (
                                  <stop
                                    key={st.id}
                                    offset={`${Math.round(st.pos * 100)}%`}
                                    stopColor={getHex(st.hue, st.sat, st.bri)}
                                  />
                                ))}
                              </linearGradient>
                            </defs>
                          )}
                          <path
                            d={wavePath(200, 48, amp)}
                            fill="none"
                            stroke={grad ? "url(#drawWavePreview)" : (drawColor as string)}
                            strokeWidth={sw}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={drawOpacity}
                          />
                        </svg>
                      );
                    })()}
                  </div>
                </PanelSection>
              </>
            )}
          </>
        )}

        {hasDrawings && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs text-destructive"
            onClick={clearDrawings}
          >
            <Trash2 className="size-3" /> Clear All Drawings
          </Button>
        )}
      </div>
    </div>
  );
}
