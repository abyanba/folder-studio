/**
 * Gradient surface: stop track (click to add, drag to move, select to edit),
 * linear/radial + angle + reverse/delete controls, and an HSV picker editing
 * the selected stop directly in HSV (no lossy hex round-trip).
 *
 * Ported behaviors from the legacy gradient editor: click adds a stop whose
 * HSV is interpolated between its neighbors; delete requires >2 stops;
 * reverse flips every `pos`; angle applies to linear only.
 */

import { useRef, useState } from "react";
import { HsvColorPicker } from "react-colorful";
import { FlipHorizontal2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SliderField } from "@/components/controls/SliderField";
import { getHex, gradientToCss, hexToHsv } from "@/lib/color";
import { createId } from "@/lib/id";
import type { Gradient, GradientStop } from "@/types/gradient";
import { ColorFormatInput } from "./ColorFormatInput";
import { useDocPreviewDrag } from "./useDocPreviewDrag";

/** Interpolate a new stop's HSV between its neighbors at `pos` (legacy parity). */
export function interpolateStop(stops: GradientStop[], pos: number): Omit<GradientStop, "id"> {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const next = sorted.find((s) => s.pos >= pos);
  const prev = [...sorted].reverse().find((s) => s.pos <= pos);
  if (!prev && !next) return { pos, hue: 0, sat: 0, bri: 1 };
  if (!prev) return { pos, hue: next!.hue, sat: next!.sat, bri: next!.bri };
  if (!next || next === prev) return { pos, hue: prev.hue, sat: prev.sat, bri: prev.bri };
  const t = next.pos === prev.pos ? 0 : (pos - prev.pos) / (next.pos - prev.pos);
  const a = (s: GradientStop) => s.alpha ?? 1;
  return {
    pos,
    hue: prev.hue + (next.hue - prev.hue) * t,
    sat: prev.sat + (next.sat - prev.sat) * t,
    bri: prev.bri + (next.bri - prev.bri) * t,
    alpha: a(prev) + (a(next) - a(prev)) * t,
  };
}

export function GradientEditor({
  value,
  onChange,
  linearOnly = false,
}: {
  value: Gradient;
  onChange: (gradient: Gradient) => void;
  /** Hide the Linear/Radial toggle and pin the gradient to linear (e.g. the Windows back tab). */
  linearOnly?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sorted = [...value.stops].sort((a, b) => a.pos - b.pos);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const selected = value.stops.find((s) => s.id === selectedId) ?? sorted[0];
  const previewDrag = useDocPreviewDrag();

  const updateStop = (id: string, patch: Partial<GradientStop>) =>
    onChange({
      ...value,
      stops: value.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const posFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const addStopAt = (clientX: number) => {
    const pos = posFromClientX(clientX);
    const stop: GradientStop = { id: createId(), ...interpolateStop(value.stops, pos) };
    onChange({ ...value, stops: [...value.stops, stop] });
    setSelectedId(stop.id);
  };

  // The track preview always renders left→right; `angle` only affects output.
  const trackCss = gradientToCss({ kind: "linear", angle: 90, stops: value.stops });

  return (
    <div className="space-y-2.5">
      <div
        ref={trackRef}
        className="relative h-7 cursor-copy rounded-md border"
        style={{ background: trackCss }}
        {...previewDrag}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) addStopAt(e.clientX);
        }}
      >
        {sorted.map((stop) => (
          <button
            key={stop.id}
            type="button"
            aria-label={`Gradient stop at ${Math.round(stop.pos * 100)}%`}
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 shadow data-selected:z-10 data-selected:ring-2 data-selected:ring-ring"
            data-selected={stop.id === selected?.id || undefined}
            style={{
              left: `${stop.pos * 100}%`,
              background: getHex(stop.hue, stop.sat, stop.bri),
              borderColor: "var(--background)",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedId(stop.id);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.buttons & 1) updateStop(stop.id, { pos: posFromClientX(e.clientX) });
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {!linearOnly && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={value.kind}
            onValueChange={(v) => {
              if (v) onChange({ ...value, kind: v as Gradient["kind"] });
            }}
            className="flex-1"
          >
            <ToggleGroupItem value="linear" className="flex-1 text-xs">
              Linear
            </ToggleGroupItem>
            <ToggleGroupItem value="radial" className="flex-1 text-xs">
              Radial
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {linearOnly && <div className="flex-1" />}
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Reverse gradient"
          onClick={() =>
            onChange({
              ...value,
              stops: value.stops.map((s) => ({ ...s, pos: 1 - s.pos })),
            })
          }
        >
          <FlipHorizontal2 className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Delete selected stop"
          disabled={value.stops.length <= 2 || !selected}
          onClick={() => {
            if (!selected) return;
            const stops = value.stops.filter((s) => s.id !== selected.id);
            onChange({ ...value, stops });
            setSelectedId([...stops].sort((a, b) => a.pos - b.pos)[0]?.id ?? "");
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {(linearOnly || value.kind === "linear") && (
        <SliderField
          label="Angle"
          value={Math.round(value.angle)}
          min={0}
          max={360}
          onChange={(v) => onChange({ ...value, angle: v })}
          format={(v) => `${v}°`}
        />
      )}

      {selected && (
        <>
          <div className="fs-colorful" {...previewDrag}>
            <HsvColorPicker
              color={{ h: selected.hue, s: selected.sat * 100, v: selected.bri * 100 }}
              onChange={(c) =>
                updateStop(selected.id, { hue: c.h, sat: c.s / 100, bri: c.v / 100 })
              }
            />
          </div>
          <ColorFormatInput
            hex={getHex(selected.hue, selected.sat, selected.bri)}
            onChange={(hex) => {
              const [h, s, v] = hexToHsv(hex);
              updateStop(selected.id, { hue: h, sat: s, bri: v });
            }}
          />
          <div {...previewDrag}>
            <SliderField
              label="Opacity"
              value={selected.alpha ?? 1}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateStop(selected.id, { alpha: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </>
      )}
    </div>
  );
}
