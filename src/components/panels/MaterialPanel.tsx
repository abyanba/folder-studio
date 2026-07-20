/**
 * Material panel: pick a surface (leather, brushed metal, fabric, paper) and
 * tune it. Controls are per-material — each recipe declares which knobs it
 * actually responds to, so the panel doesn't show a light-direction slider on
 * paper, where it does nothing.
 *
 * Swatches preview the real shading layer over a neutral card, using the same
 * `buildMaterialLayerSvg` the workspace and both exports consume.
 */

import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MATERIALS, buildMaterialLayerSvg, getMaterialRecipe } from "@/lib/export/materials";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { useDocumentStore } from "@/store/documentStore";
import type { MaterialSettings, PatternSpan } from "@/types/document";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

/** Base shapes with a front/back split — the only ones where span is meaningful. */
const SPLIT_SHAPES = ["windows", "macos"];

/** All-white mask, so a swatch shows the material unclipped. */
const FULL_MASK =
  '<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="white"/></svg>';

function swatch(id: string, settings: MaterialSettings): string | undefined {
  const svg = buildMaterialLayerSvg({ ...settings, id }, FULL_MASK);
  return svg ? `url("${toSvgDataUrl(svg)}")` : undefined;
}

export function MaterialPanel() {
  const material = useDocumentStore((s) => s.doc.material);
  const baseShape = useDocumentStore((s) => s.doc.baseShape);
  const setMaterial = useDocumentStore((s) => s.setMaterial);
  const recipe = getMaterialRecipe(material.id);

  return (
    <div>
      <PanelHeader title="Material" />
      <div className="space-y-4 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setMaterial({ id: "none" })}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-1 text-[10px] transition-colors",
              material.id === "none"
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-transparent bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted",
            )}
          >
            None
          </button>
          {MATERIALS.map((m) => {
            const active = material.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                title={m.name}
                onClick={() => setMaterial({ id: m.id, angle: m.azimuth })}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border p-1 transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent bg-muted/40 hover:border-border hover:bg-muted",
                )}
              >
                <div
                  className="w-full flex-1 rounded bg-[#8a8f98]"
                  style={{
                    backgroundImage: swatch(m.id, { ...material, id: m.id, intensity: 1 }),
                    backgroundSize: "cover",
                    backgroundBlendMode: "soft-light",
                  }}
                />
                <span
                  className={cn(
                    "max-w-full truncate text-[9px] leading-tight",
                    active ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  {m.name}
                </span>
              </button>
            );
          })}
        </div>

        {recipe && (
          <>
            {recipe.controls.includes("intensity") && (
              <SliderField
                label="Intensity"
                value={material.intensity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setMaterial({ intensity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            )}
            {recipe.controls.includes("scale") && (
              <SliderField
                label="Grain size"
                value={material.scale}
                min={0.25}
                max={4}
                step={0.05}
                onChange={(v) => setMaterial({ scale: v })}
                format={(v) => `${v.toFixed(2)}×`}
              />
            )}
            {recipe.controls.includes("angle") && (
              <SliderField
                label="Brush direction"
                value={material.angle}
                min={0}
                max={360}
                onChange={(v) => setMaterial({ angle: v })}
                format={(v) => `${v}°`}
              />
            )}

            {SPLIT_SHAPES.includes(baseShape) && (
              <PanelSection title="Material span">
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  value={material.span}
                  onValueChange={(v) => {
                    if (v) setMaterial({ span: v as PatternSpan });
                  }}
                >
                  <ToggleGroupItem value="full" className="h-7 flex-1 text-xs">
                    Whole folder
                  </ToggleGroupItem>
                  <ToggleGroupItem value="front" className="h-7 flex-1 text-xs">
                    Front only
                  </ToggleGroupItem>
                </ToggleGroup>
              </PanelSection>
            )}

            <p className="text-[10px] leading-snug text-muted-foreground">
              The material shades whatever is beneath it, so a pattern picks up its
              grain rather than sitting flat on top.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
