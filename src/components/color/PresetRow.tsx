/**
 * Preset swatch rows shared by every color picker: removable default swatches,
 * user-saved swatches, and (when gradients are allowed) hideable built-in
 * gradient presets plus user-saved gradients — all persisted via the presets
 * store to the legacy `fs_*` localStorage keys.
 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GRADIENT_PRESETS } from "@/data/gradientPresets";
import { gradientToCss } from "@/lib/color";
import { createId } from "@/lib/id";
import { usePresetsStore } from "@/store/presetsStore";
import type { GradientStop } from "@/types/gradient";
import { cn } from "@/lib/utils";

function Chip({
  title,
  background,
  onPick,
  onRemove,
  removeLabel,
}: {
  title: string;
  background: string;
  onPick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        className="size-6 rounded-md border shadow-sm transition-transform hover:scale-110"
        style={{ background }}
        onClick={onPick}
      />
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${title}`}
          className="absolute -top-1.5 -right-1.5 z-10 hidden size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white group-hover:flex"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function PresetRow({
  onPickSolid,
  onPickGradientStops,
  currentHex,
  currentStops,
}: {
  onPickSolid: (hex: string) => void;
  /** Provide to show gradient presets/saved gradients (gradient-capable fields). */
  onPickGradientStops?: (stops: GradientStop[]) => void;
  /** Provide to show a "Save color" button for the current solid. */
  currentHex?: string;
  /** Provide to show a "Save gradient" button for the current stops. */
  currentStops?: GradientStop[];
}) {
  const {
    defaultPresets,
    customPresets,
    savedGradients,
    hiddenGradPresets,
    removeDefaultPreset,
    saveCustomPreset,
    removeCustomPreset,
    saveGradient,
    removeSavedGradient,
    hideGradientPreset,
  } = usePresetsStore();

  const cloneStops = (stops: GradientStop[]) =>
    stops.map((s) => ({ ...s, id: createId() }));

  const chips: ReactNode[] = [
    ...defaultPresets.map((hex) => (
      <Chip
        key={`d${hex}`}
        title={hex}
        background={hex}
        onPick={() => onPickSolid(hex)}
        onRemove={() => removeDefaultPreset(hex)}
      />
    )),
    ...customPresets.map((hex) => (
      <Chip
        key={`c${hex}`}
        title={hex}
        background={hex}
        onPick={() => onPickSolid(hex)}
        onRemove={() => removeCustomPreset(hex)}
      />
    )),
  ];

  if (onPickGradientStops) {
    chips.push(
      ...GRADIENT_PRESETS.map((preset, i) =>
        hiddenGradPresets.includes(i) ? null : (
          <Chip
            key={`g${i}`}
            title={preset.name}
            background={gradientToCss({ kind: "linear", angle: 135, stops: preset.stops })}
            onPick={() => onPickGradientStops(cloneStops(preset.stops))}
            onRemove={() => hideGradientPreset(i)}
            removeLabel={`Hide ${preset.name} preset`}
          />
        ),
      ),
      ...savedGradients.map((saved) => (
        <Chip
          key={`s${saved.id}`}
          title="Saved gradient"
          background={gradientToCss({ kind: "linear", angle: 135, stops: saved.stops })}
          onPick={() => onPickGradientStops(cloneStops(saved.stops))}
          onRemove={() => removeSavedGradient(saved.id)}
        />
      )),
    );
  }

  const canSave = currentHex !== undefined || currentStops !== undefined;

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-wrap gap-1.5")}>{chips}</div>
      {canSave && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-full text-xs"
          onClick={() => {
            if (currentStops) {
              saveGradient(currentStops);
              return;
            }
            if (currentHex) {
              const normalized = currentHex.toLowerCase();
              if (
                !defaultPresets.includes(normalized) &&
                !customPresets.includes(normalized)
              ) {
                saveCustomPreset(normalized);
              }
            }
          }}
        >
          {currentStops ? "Save gradient" : "Save color"}
        </Button>
      )}
    </div>
  );
}
