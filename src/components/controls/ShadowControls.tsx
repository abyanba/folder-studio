/**
 * Drop-shadow group: enable switch; when on, a 2D offset pad plus blur,
 * opacity, and color controls. Enabling seeds the legacy default shadow
 * (`{x:2, y:2, blur:2, black, 0.5}`); disabling passes `null` so the caller
 * clears the field.
 */

import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/color/ColorField";
import { NudgePad } from "./NudgePad";
import { PanelSection } from "./PanelSection";
import { SliderField } from "./SliderField";
import type { DropShadow } from "@/types/element";

export const DEFAULT_SHADOW: DropShadow = {
  x: 2,
  y: 2,
  blur: 2,
  color: "#000000",
  opacity: 0.5,
};

/** Inner shadows read best cast slightly down from the top edge, no side offset. */
export const DEFAULT_INNER_SHADOW: DropShadow = {
  x: 0,
  y: 3,
  blur: 4,
  color: "#000000",
  opacity: 0.5,
};

export function ShadowControls({
  shadow,
  onChange,
  title = "Shadow",
  defaultShadow = DEFAULT_SHADOW,
}: {
  shadow: DropShadow | undefined;
  onChange: (shadow: DropShadow | null) => void;
  /** Section heading — also names the toggle for a11y (default "Shadow"). */
  title?: string;
  /** Seed applied when the switch is turned on (default the outer drop shadow). */
  defaultShadow?: DropShadow;
}) {
  return (
    <PanelSection
      title={title}
      action={
        <Switch
          checked={Boolean(shadow)}
          onCheckedChange={(v) => onChange(v ? { ...defaultShadow } : null)}
          aria-label={`Toggle ${title.toLowerCase()}`}
        />
      }
    >
      {shadow && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <NudgePad
              x={shadow.x}
              y={shadow.y}
              onChange={(x, y) => onChange({ ...shadow, x, y })}
            />
            <span className="text-[9px] font-semibold tracking-widest text-muted-foreground">
              OFFSET
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <SliderField
              label="Blur"
              value={shadow.blur}
              min={0}
              max={20}
              onChange={(v) => onChange({ ...shadow, blur: v })}
            />
            <div className="flex items-end gap-2">
              <SliderField
                label="Opacity"
                value={shadow.opacity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => onChange({ ...shadow, opacity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
                className="flex-1"
              />
              <ColorField
                value={shadow.color}
                onChange={(v) => {
                  if (typeof v === "string") onChange({ ...shadow, color: v });
                }}
                ariaLabel="Shadow color"
              />
            </div>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
