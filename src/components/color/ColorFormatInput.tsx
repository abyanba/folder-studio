/**
 * Text row of the picker: format select (hex/rgb/hsl/hsv) + editable value +
 * eyedropper. Drafts locally and commits parseable values on Enter/blur.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COLOR_TEXT_FORMATS,
  formatColor,
  parseColorInput,
  type ColorTextFormat,
} from "@/lib/colorFormat";
import { EyeDropperButton } from "./EyeDropperButton";

export function ColorFormatInput({
  hex,
  onChange,
}: {
  hex: string;
  onChange: (hex: string) => void;
}) {
  const [fmt, setFmt] = useState<ColorTextFormat>("hex");
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseColorInput(draft, fmt);
    setDraft(null);
    if (parsed) onChange(parsed);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={fmt} onValueChange={(v) => setFmt(v as ColorTextFormat)}>
        <SelectTrigger size="sm" className="h-7 w-[4.5rem] px-2 text-xs" aria-label="Color format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COLOR_TEXT_FORMATS.map((f) => (
            <SelectItem key={f} value={f} className="text-xs uppercase">
              {f.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={draft ?? formatColor(hex, fmt)}
        className="h-7 flex-1 px-2 font-mono text-xs"
        aria-label="Color value"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      <EyeDropperButton onPick={onChange} />
    </div>
  );
}
