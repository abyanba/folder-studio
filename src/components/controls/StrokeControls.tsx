/**
 * Stroke/outline group: enable switch, width slider, color swatch. Strokes are
 * always painted outside the fill — the inside/center variants were dropped
 * (they could not be rendered faithfully for text in any of the three paths).
 */

import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "./PanelSection";
import { SliderField } from "./SliderField";

export interface StrokePatch {
  enabled?: boolean;
  width?: number;
  color?: string;
}

export function StrokeControls({
  label = "Stroke",
  enabled,
  width,
  color,
  widthMin = 1,
  widthMax = 20,
  widthStep = 1,
  onChange,
}: {
  label?: string;
  enabled: boolean;
  width: number;
  color: string;
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
