/**
 * Shapes panel: add-grid of the five primitive shapes, and the selected-shape
 * editor (type switch, gradient-capable fill, positioned outline, corner
 * radius for rects, size sliders, shadow, transform).
 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { ShadowControls } from "@/components/controls/ShadowControls";
import { SliderField } from "@/components/controls/SliderField";
import { TransformFields } from "@/components/controls/TransformFields";
import { CDW, CDH } from "@/lib/constants";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { ShapeElement, ShapeType, StrokePosition } from "@/types/element";
import { PanelHeader } from "./PanelHeader";

const SHAPE_TYPES: Array<{ id: ShapeType; name: string; icon: ReactNode }> = [
  {
    id: "rect",
    name: "Rectangle",
    icon: <rect x="4" y="6" width="16" height="12" rx="2" />,
  },
  { id: "ellipse", name: "Ellipse", icon: <circle cx="12" cy="12" r="8" /> },
  { id: "triangle", name: "Triangle", icon: <path d="M12 5L20 19H4Z" /> },
  {
    id: "star",
    name: "Star",
    icon: (
      <path d="M12 4l2.1 5.1 5.5.4-4.2 3.6 1.3 5.4L12 15.6l-4.7 2.9 1.3-5.4-4.2-3.6 5.5-.4z" />
    ),
  },
  {
    id: "hexagon",
    name: "Hexagon",
    icon: <path d="M12 4l7 4v8l-7 4-7-4V8z" />,
  },
];

function ShapeGlyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="1.5">
      {children}
    </svg>
  );
}

function SelectedShapeEditor({ el }: { el: ShapeElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);

  return (
    <div className="space-y-4">
      <PanelSection title="Shape">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={el.shapeType}
          onValueChange={(v) => {
            if (v) updateElement(el.id, { shapeType: v as ShapeType });
          }}
        >
          {SHAPE_TYPES.map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              aria-label={s.name}
              className="flex-1 p-0"
            >
              <ShapeGlyph>{s.icon}</ShapeGlyph>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PanelSection>

      <PanelSection
        title="Fill"
        action={
          <Switch
            checked={el.fill.enabled}
            aria-label="Toggle fill"
            onCheckedChange={(v) => updateElement(el.id, { fill: { ...el.fill, enabled: v } })}
          />
        }
      >
        {el.fill.enabled && (
          <ColorField
            value={el.fill.color}
            onChange={(v) => updateElement(el.id, { fill: { ...el.fill, color: v } })}
            allowGradient
            ariaLabel="Fill color"
          />
        )}
      </PanelSection>

      <PanelSection
        title="Outline"
        action={
          <Switch
            checked={el.stroke.enabled}
            aria-label="Toggle outline"
            onCheckedChange={(v) =>
              updateElement(el.id, { stroke: { ...el.stroke, enabled: v } })
            }
          />
        }
      >
        {el.stroke.enabled && (
          <div className="space-y-2.5">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              className="w-full"
              value={el.stroke.position}
              onValueChange={(v) => {
                if (v)
                  updateElement(el.id, {
                    stroke: { ...el.stroke, position: v as StrokePosition },
                  });
              }}
            >
              <ToggleGroupItem value="outside" className="flex-1 text-xs">
                Outside
              </ToggleGroupItem>
              <ToggleGroupItem value="center" className="flex-1 text-xs">
                Center
              </ToggleGroupItem>
              <ToggleGroupItem value="inside" className="flex-1 text-xs">
                Inside
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-end gap-2">
              <SliderField
                label="Width"
                value={el.stroke.width}
                min={1}
                max={20}
                onChange={(v) => updateElement(el.id, { stroke: { ...el.stroke, width: v } })}
                className="flex-1"
              />
              <ColorField
                value={el.stroke.color}
                onChange={(v) => {
                  if (typeof v === "string")
                    updateElement(el.id, { stroke: { ...el.stroke, color: v } });
                }}
                ariaLabel="Outline color"
              />
            </div>
          </div>
        )}
      </PanelSection>

      {el.shapeType === "rect" && (
        <SliderField
          label="Corner radius"
          value={el.borderRadius}
          min={0}
          max={50}
          onChange={(v) => updateElement(el.id, { borderRadius: v })}
        />
      )}

      <PanelSection title="Size">
        <SliderField
          label="Width"
          value={Math.round(el.width)}
          min={10}
          max={CDW}
          onChange={(v) => updateElement(el.id, { width: v })}
        />
        <SliderField
          label="Height"
          value={Math.round(el.height)}
          min={10}
          max={CDH}
          onChange={(v) => updateElement(el.id, { height: v })}
        />
      </PanelSection>

      <ShadowControls
        shadow={el.dropShadow}
        onChange={(shadow) => updateElement(el.id, { dropShadow: shadow ?? undefined })}
      />

      <TransformFields el={el} rotationMin={0} rotationMax={360} />
    </div>
  );
}

export function ShapesPanel() {
  const addShape = useDocumentStore((s) => s.addShape);
  const select = useSelectionStore((s) => s.select);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const el = useDocumentStore((s) =>
    s.doc.elements.find((e) => e.id === selectedId && e.type === "shape"),
  ) as ShapeElement | undefined;

  return (
    <div>
      <PanelHeader title="Shapes" />
      <div className="space-y-4 p-3">
        {el ? (
          <SelectedShapeEditor el={el} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {SHAPE_TYPES.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="h-16 flex-col gap-1 text-[11px] text-muted-foreground"
                onClick={() => select(addShape(s.id))}
              >
                <ShapeGlyph>{s.icon}</ShapeGlyph>
                {s.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
