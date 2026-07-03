/**
 * The one color control used everywhere: a swatch button opening a popover
 * with a solid picker and — when `allowGradient` — a gradient tab.
 *
 * Unifies the legacy docked picker and floating "FP" popover, and resolves
 * their gradient-allowed disagreement: gradients are offered wherever the
 * target field is typed `ColorValue` (the caller passes `allowGradient`).
 * The active tab is derived from the value's type; switching tabs converts
 * the value (hex → seeded gradient, gradient → first stop's hex).
 */

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHex, gradientToCss, hexToHsv } from "@/lib/color";
import { createId } from "@/lib/id";
import { isGradient, type ColorValue, type Gradient, type GradientStop } from "@/types/gradient";
import { GradientEditor } from "./GradientEditor";
import { PresetRow } from "./PresetRow";
import { SolidColorPicker } from "./SolidColorPicker";
import { cn } from "@/lib/utils";

/** Seed a gradient from a solid: the color at 0, a hue-shifted companion at 1. */
export function gradientFromHex(hex: string): Gradient {
  const [h, s, v] = hexToHsv(hex);
  return {
    kind: "linear",
    angle: 90,
    stops: [
      { id: createId(), pos: 0, hue: h, sat: s, bri: v },
      { id: createId(), pos: 1, hue: (h + 40) % 360, sat: s, bri: v },
    ],
  };
}

const firstStopHex = (g: Gradient): string => {
  const first = [...g.stops].sort((a, b) => a.pos - b.pos)[0];
  return first ? getHex(first.hue, first.sat, first.bri) : "#ffffff";
};

export function ColorField({
  value,
  onChange,
  allowGradient = false,
  ariaLabel = "Color",
  className,
}: {
  value: ColorValue;
  onChange: (value: ColorValue) => void;
  allowGradient?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const grad: Gradient | null = isGradient(value) ? value : null;
  const hex: string = grad ? firstStopHex(grad) : (value as string);
  const mode = grad ? "gradient" : "solid";

  const pickGradientStops = (stops: GradientStop[]) =>
    onChange({
      kind: grad?.kind ?? "linear",
      angle: grad?.angle ?? 90,
      stops,
    });

  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          "size-7 shrink-0 rounded-md border shadow-sm transition-transform hover:scale-105",
          className,
        )}
        style={{ background: grad ? gradientToCss(grad) : (value as string) }}
      />
      <PopoverContent className="w-72 space-y-3 p-3" align="start">
        {allowGradient && (
          <Tabs
            value={mode}
            onValueChange={(m) => {
              if (m === mode) return;
              onChange(m === "gradient" ? gradientFromHex(hex) : firstStopHex(grad!));
            }}
          >
            <TabsList className="h-7 w-full">
              <TabsTrigger value="solid" className="flex-1 text-xs">
                Solid
              </TabsTrigger>
              <TabsTrigger value="gradient" className="flex-1 text-xs">
                Gradient
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {grad ? (
          <GradientEditor value={grad} onChange={onChange} />
        ) : (
          <SolidColorPicker hex={hex} onChange={onChange} />
        )}

        <PresetRow
          onPickSolid={onChange}
          onPickGradientStops={allowGradient ? pickGradientStops : undefined}
          currentHex={grad ? undefined : hex}
          currentStops={grad?.stops}
        />
      </PopoverContent>
    </Popover>
  );
}
