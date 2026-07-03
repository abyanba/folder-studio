/**
 * Labeled slider with a numeric readout.
 *
 * `onChange` fires on every movement so the workspace previews live, but the
 * whole drag is wrapped in a document-preview transaction
 * ({@link beginDocPreview}/{@link endDocPreview}) so it lands as ONE undo
 * entry. Keyboard steps commit per keypress (Radix fires change+commit).
 */

import { useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { beginDocPreview, endDocPreview } from "@/store/documentStore";
import { cn } from "@/lib/utils";

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Readout formatter (default: the raw value). */
  format?: (value: number) => string;
  /**
   * Wrap the drag in a single-undo document transaction (default true).
   * Disable for sliders that edit non-document state.
   */
  undoGroup?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  undoGroup = true,
  disabled,
  className,
}: SliderFieldProps) {
  const dragging = useRef(false);

  // If the component unmounts mid-drag, close the transaction so history
  // doesn't stay paused.
  useEffect(
    () => () => {
      if (dragging.current) endDocPreview();
    },
    [],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onValueChange={([v]) => {
          if (undoGroup && !dragging.current) {
            dragging.current = true;
            beginDocPreview();
          }
          onChange(v);
        }}
        onValueCommit={([v]) => {
          if (undoGroup && dragging.current) {
            dragging.current = false;
            endDocPreview();
          }
          onChange(v);
        }}
      />
    </div>
  );
}
