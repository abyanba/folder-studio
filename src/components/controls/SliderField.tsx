/**
 * Labeled slider with a numeric readout.
 *
 * `onChange` fires on every movement so the workspace previews live, but the
 * whole drag is wrapped in a document-preview transaction
 * ({@link beginDocPreview}/{@link endDocPreview}) so it lands as ONE undo
 * entry. Keyboard steps commit per keypress (Radix fires change+commit).
 */

import { useEffect, useRef, useState } from "react";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // If the component unmounts mid-drag, close the transaction so history
  // doesn't stay paused.
  useEffect(
    () => () => {
      if (dragging.current) endDocPreview();
    },
    [],
  );

  // Typed numeric entry: clamp to [min,max], snap to the slider's step, and
  // commit as a single onChange (one undo entry). Blur/Enter commits, Escape
  // reverts.
  const commitDraft = () => {
    setEditing(false);
    const n = Number.parseFloat(draft);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(max, Math.max(min, n));
    const snapped = Number((min + Math.round((clamped - min) / step) * step).toFixed(4));
    if (snapped !== value) onChange(snapped);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {editing ? (
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={draft}
            min={min}
            max={max}
            step={step}
            aria-label={`${label} value`}
            // Spinners are hidden: they overlapped the digits in this 14-unit
            // readout, and the slider right below already steps the value.
            className="h-5 w-14 rounded border bg-transparent px-1 text-right text-xs font-medium tabular-nums outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setEditing(false);
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            className="rounded px-1 text-xs font-medium tabular-nums hover:bg-muted disabled:pointer-events-none"
            title="Click to type a value"
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {format ? format(value) : value}
          </button>
        )}
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
