/**
 * Stroke/outline group: enable switch, width slider, color swatch, and an
 * optional inside/center/outside position toggle (text + shapes have stroke
 * positions; images don't).
 */

import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "./PanelSection";
import { SliderField } from "./SliderField";
import type { StrokePosition } from "@/types/element";

export interface StrokePatch {
  enabled?: boolean;
  width?: number;
  color?: string;
  position?: StrokePosition;
}

export function StrokeControls({
  label = "Stroke",
  enabled,
  width,
  color,
  position,
  widthMin = 1,
  widthMax = 20,
  widthStep = 1,
  onChange,
}: {
  label?: string;
  enabled: boolean;
  width: number;
  color: string;
  /** Provide to show the position toggle; omit to hide it. */
  position?: StrokePosition;
  widthMin?: number;
  widthMax?: number;
  widthStep?: number;
  onChange: (patch: StrokePatch) => void;
}) {
  return (
    <PanelSection
      title={label}
      action={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
          aria-label={`Toggle ${label.toLowerCase()}`}
        />
      }
    >
      {enabled && (
        <div className="space-y-2.5">
          {position !== undefined && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              className="w-full"
              value={position}
              onValueChange={(v) => {
                if (v) onChange({ position: v as StrokePosition });
              }}
            >
              <ToggleGroupItem value="outside" className="flex-1 text-xs">
                Outside
              </ToggleGroupItem>
              <ToggleGroupItem value="center" className="flex-1 text-xs">
                Center
              </ToggleGroupItem>
              {/* if text enable only center and outside. if shape enable all three  */}
              {label !== "Stroke" && (
                <ToggleGroupItem value="inside" className="flex-1 text-xs">
                  Inside
                </ToggleGroupItem>
              )}
            </ToggleGroup>
          )}
          <div className="flex items-end gap-2">
            <SliderField
              label="Width"
              value={width}
              min={widthMin}
              max={widthMax}
              step={widthStep}
              onChange={(v) => onChange({ width: v })}
              className="flex-1"
            />
            <ColorField
              value={color}
              onChange={(v) => {
                if (typeof v === "string") onChange({ color: v });
              }}
              ariaLabel={`${label} color`}
            />
          </div>
        </div>
      )}
    </PanelSection>
  );
}
