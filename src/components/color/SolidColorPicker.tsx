/**
 * Solid-color surface: react-colorful HSV square/hue strip + format input.
 *
 * Keeps HSV state internally and only re-derives it when the incoming hex
 * differs from the last hex this picker emitted — so hue/saturation survive
 * while the color sits at an extreme (black/white), where hex→HSV is lossy.
 */

import { useState } from "react";
import { HsvColorPicker } from "react-colorful";
import { getHex, hexToHsv } from "@/lib/color";
import { ColorFormatInput } from "./ColorFormatInput";
import { useDocPreviewDrag } from "./useDocPreviewDrag";

interface PickerHsv {
  h: number;
  s: number;
  v: number;
}

const hexToPickerHsv = (hex: string): PickerHsv => {
  const [h, s, v] = hexToHsv(hex);
  return { h, s: s * 100, v: v * 100 };
};

const pickerHsvToHex = (c: PickerHsv): string => getHex(c.h, c.s / 100, c.v / 100);

export function SolidColorPicker({
  hex,
  onChange,
}: {
  hex: string;
  onChange: (hex: string) => void;
}) {
  const [state, setState] = useState(() => ({ hex, hsv: hexToPickerHsv(hex) }));
  const previewDrag = useDocPreviewDrag();

  // External change (preset click, eyedropper, undo, stop switch): re-derive.
  if (state.hex !== hex) {
    setState({ hex, hsv: hexToPickerHsv(hex) });
  }

  const handlePicker = (hsv: PickerHsv) => {
    const newHex = pickerHsvToHex(hsv);
    setState({ hex: newHex, hsv });
    if (newHex !== hex) onChange(newHex);
  };

  return (
    <div className="space-y-2.5">
      <div className="fs-colorful" {...previewDrag}>
        <HsvColorPicker color={state.hsv} onChange={handlePicker} />
      </div>
      <ColorFormatInput hex={hex} onChange={onChange} />
    </div>
  );
}
