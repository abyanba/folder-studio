/**
 * The material control block, shared by every panel whose element can carry a
 * surface material (shape, text, icon, mono logo). One component rather than a
 * copy per panel — the recipes decide which sliders exist, so a new material
 * with different knobs needs no panel changes at all.
 *
 * Collapsed to a single dropdown until a material is picked, so panels that are
 * already dense don't grow for a feature most designs won't use.
 */

import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MATERIALS, getMaterialRecipe } from "@/lib/export/materials";
import { useDocumentStore } from "@/store/documentStore";
import type { ElementMaterial, FolderElement } from "@/types/element";

/** Applied when a material is first chosen; matches the folder-level defaults. */
export const DEFAULT_ELEMENT_MATERIAL: ElementMaterial = {
  id: "none",
  intensity: 0.7,
  scale: 1,
  angle: 90,
};

export function MaterialControls({ el }: { el: FolderElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  const material = el.material ?? DEFAULT_ELEMENT_MATERIAL;
  const recipe = getMaterialRecipe(material.id);

  const patch = (next: Partial<ElementMaterial>): void => {
    updateElement(el.id, { material: { ...material, ...next } });
  };

  return (
    <PanelSection title="Material">
      <Select
        value={material.id}
        onValueChange={(id) => {
          // Picking a material also seeds its recipe's own light direction, so
          // brushed metal starts brushing the way it was tuned to.
          const r = getMaterialRecipe(id);
          patch({ id, ...(r ? { angle: r.azimuth } : {}) });
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Material">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" sideOffset={4}>
          <SelectItem value="none" className="text-xs">
            None
          </SelectItem>
          {MATERIALS.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {recipe?.controls.includes("intensity") && (
        <SliderField
          label="Intensity"
          value={material.intensity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ intensity: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}
      {recipe?.controls.includes("scale") && (
        <SliderField
          label="Grain size"
          value={material.scale}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => patch({ scale: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
      )}
      {recipe?.controls.includes("angle") && (
        <SliderField
          label="Brush direction"
          value={material.angle}
          min={0}
          max={360}
          onChange={(v) => patch({ angle: v })}
          format={(v) => `${v}°`}
        />
      )}
    </PanelSection>
  );
}
