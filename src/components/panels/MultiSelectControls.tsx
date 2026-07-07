/**
 * The shared body of the multi-selection editor: shared opacity/rotation
 * (showing the average), same-type extras (text size/weight/align, icon
 * uniform size, shape fill), and delete-all. Rendered both as the standalone
 * `MultiSelectPanel` (which overrides the dock) and inline inside the Layers
 * panel's collapsible "N selected" section, so a user can curate the selection
 * in the list and edit it as a group without losing either view. Every edit
 * goes through `updateElements` → one undo entry.
 */

import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { FolderElement, TextAlign } from "@/types/element";

const WEIGHTS = ["300", "400", "500", "600", "700"];

const avgOf = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/** Whether 2+ elements are selected — callers gate rendering on this. */
export function useHasMultiSelection(): boolean {
  return useSelectionStore((s) => s.selectedIds.length > 1);
}

export function MultiSelectControls() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const elements = useDocumentStore((s) => s.doc.elements);
  const updateElements = useDocumentStore((s) => s.updateElements);
  const removeElements = useDocumentStore((s) => s.removeElements);

  const sel = elements.filter((e) => selectedIds.includes(e.id));
  if (sel.length < 2) return null;

  const counts = new Map<string, number>();
  sel.forEach((e) => counts.set(e.type, (counts.get(e.type) ?? 0) + 1));

  const patchAll = (make: (el: FolderElement) => Partial<FolderElement>) => {
    const patches: Record<string, Partial<FolderElement>> = {};
    sel.forEach((el) => {
      patches[el.id] = make(el);
    });
    updateElements(patches);
  };

  const texts = sel.filter((e) => e.type === "text");
  const icons = sel.filter((e) => e.type === "icon");
  const shapes = sel.filter((e) => e.type === "shape");
  const allText = texts.length === sel.length;
  const allIcons = icons.length === sel.length;
  const allShapes = shapes.length === sel.length;

  const weights = new Set(texts.map((t) => t.fontWeight));
  const weightValue = weights.size === 1 ? [...weights][0] : "mixed";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {[...counts.entries()].map(([type, n]) => (
          <Badge key={type} variant="secondary" className="text-[10px] capitalize">
            {type} × {n}
          </Badge>
        ))}
      </div>

      <SliderField
        label="Opacity"
        value={Math.round(avgOf(sel.map((e) => e.opacity)) * 100) / 100}
        min={0.05}
        max={1}
        step={0.05}
        onChange={(v) => patchAll(() => ({ opacity: v }))}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <SliderField
        label="Rotation"
        value={Math.round(avgOf(sel.map((e) => e.rotation)))}
        min={-180}
        max={180}
        onChange={(v) => patchAll(() => ({ rotation: v }))}
        format={(v) => `${v}°`}
      />

      {allText && (
        <PanelSection title="Text">
          <SliderField
            label="Font size"
            value={Math.round(avgOf(texts.map((t) => t.fontSize)))}
            min={8}
            max={96}
            onChange={(v) => patchAll(() => ({ fontSize: v }))}
          />
          <Select
            value={weightValue}
            onValueChange={(v) => {
              if (v !== "mixed") patchAll(() => ({ fontWeight: v }));
            }}
          >
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Font weight">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weightValue === "mixed" && (
                <SelectItem value="mixed" className="text-xs" disabled>
                  Mixed
                </SelectItem>
              )}
              {WEIGHTS.map((w) => (
                <SelectItem key={w} value={w} className="text-xs">
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            className="w-full"
            value=""
            onValueChange={(v) => {
              if (v) patchAll(() => ({ align: v as TextAlign }));
            }}
          >
            <ToggleGroupItem value="left" aria-label="Align left" className="flex-1">
              <AlignLeft className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center" className="flex-1">
              <AlignCenter className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right" className="flex-1">
              <AlignRight className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </PanelSection>
      )}

      {allIcons && (
        <PanelSection title="Icons">
          <SliderField
            label="Uniform size"
            value={Math.round(avgOf(icons.map((i) => i.width)))}
            min={10}
            max={200}
            onChange={(v) => patchAll(() => ({ width: v, height: v }))}
          />
        </PanelSection>
      )}

      {allShapes && (
        <PanelSection title="Shapes">
          <div className="flex items-center gap-2">
            <ColorField
              value={shapes[0].fill.color}
              onChange={(v) =>
                patchAll((el) =>
                  el.type === "shape" ? { fill: { ...el.fill, color: v } } : {},
                )
              }
              allowGradient
              ariaLabel="Fill color for all"
            />
            <span className="text-xs text-muted-foreground">Fill all</span>
          </div>
        </PanelSection>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full text-xs text-destructive"
        onClick={() => {
          removeElements(sel.map((e) => e.id));
          useSelectionStore.getState().clear();
        }}
      >
        <Trash2 className="size-3" /> Delete All ({sel.length})
      </Button>
    </div>
  );
}
