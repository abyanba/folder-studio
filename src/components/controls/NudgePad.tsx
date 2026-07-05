/**
 * 2D offset pad for shadow x/y (port of the legacy `nudgePad`,
 * public/legacy.html L1037): a 64px square with crosshair guides; dragging maps
 * the pointer to integer offsets in ±range. The whole drag is one undo entry
 * via the document-preview transaction.
 */

import { useRef } from "react";
import { beginDocPreview, endDocPreview } from "@/store/documentStore";
import { cn } from "@/lib/utils";

export interface NudgePadProps {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  range?: number;
  className?: string;
}

export function NudgePad({ x, y, onChange, range = 15, className }: NudgePadProps) {
  const padRef = useRef<HTMLDivElement>(null);

  const pick = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.round(
      Math.max(-range, Math.min(range, ((clientX - rect.left) / rect.width * 2 - 1) * range)),
    );
    const ny = Math.round(
      Math.max(-range, Math.min(range, ((clientY - rect.top) / rect.height * 2 - 1) * range)),
    );
    onChange(nx, ny);
  };

  return (
    <div
      ref={padRef}
      role="slider"
      aria-label="Shadow offset"
      aria-valuetext={`x ${x}, y ${y}`}
      className={cn(
        "relative size-16 shrink-0 cursor-crosshair rounded-lg border bg-muted/40",
        className,
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        beginDocPreview();
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) pick(e.clientX, e.clientY);
      }}
      onPointerUp={() => endDocPreview()}
      onPointerCancel={() => endDocPreview()}
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
        style={{
          left: `${((x / range + 1) / 2) * 100}%`,
          top: `${((y / range + 1) / 2) * 100}%`,
        }}
      />
    </div>
  );
}
