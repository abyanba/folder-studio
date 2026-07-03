/**
 * The common transform block shared by the image/icon/text/shapes/draw panels:
 * X/Y/W/H number fields plus rotation and opacity sliders, writing straight to
 * the document store.
 */

import { useDocumentStore } from "@/store/documentStore";
import { NumberField } from "./NumberField";
import { SliderField } from "./SliderField";
import { PanelSection } from "./PanelSection";
import type { FolderElement } from "@/types/element";

export function TransformFields({
  el,
  rotationMin = -180,
  rotationMax = 180,
}: {
  el: FolderElement;
  rotationMin?: number;
  rotationMax?: number;
}) {
  const updateElement = useDocumentStore((s) => s.updateElement);

  return (
    <PanelSection title="Transform">
      <div className="grid grid-cols-4 gap-1.5">
        <NumberField label="X" value={el.x} onCommit={(v) => updateElement(el.id, { x: v })} />
        <NumberField label="Y" value={el.y} onCommit={(v) => updateElement(el.id, { y: v })} />
        <NumberField
          label="W"
          value={el.width}
          min={2}
          onCommit={(v) => updateElement(el.id, { width: v })}
        />
        <NumberField
          label="H"
          value={el.height}
          min={2}
          onCommit={(v) => updateElement(el.id, { height: v })}
        />
      </div>
      <SliderField
        label="Rotate"
        value={Math.round(el.rotation)}
        min={rotationMin}
        max={rotationMax}
        onChange={(v) => updateElement(el.id, { rotation: v })}
        format={(v) => `${v}°`}
      />
      <SliderField
        label="Opacity"
        value={el.opacity}
        min={0.05}
        max={1}
        step={0.05}
        onChange={(v) => updateElement(el.id, { opacity: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
    </PanelSection>
  );
}
