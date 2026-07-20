/**
 * The 280px docked panel. Renders the active tool's panel inside a scroll
 * area; hidden when no panel is active. A multi-selection overrides whatever
 * panel is docked (legacy `multiPanel || …` priority).
 */

import type { ComponentType } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUiStore } from "@/store/uiStore";
import { useSelectionStore } from "@/store/selectionStore";
import { ShapePanel } from "@/components/panels/ShapePanel";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { ImagePanel } from "@/components/panels/ImagePanel";
import { TextPanel } from "@/components/panels/TextPanel";
import { ShapesPanel } from "@/components/panels/ShapesPanel";
import { IconPanel } from "@/components/panels/IconPanel";
import { LogosPanel } from "@/components/panels/LogosPanel";
import { DrawPanel } from "@/components/panels/DrawPanel";
import { LayersPanel } from "@/components/panels/LayersPanel";
import { GalleryPanel } from "@/components/panels/GalleryPanel";
import { MultiSelectPanel } from "@/components/panels/MultiSelectPanel";

const PANELS: Record<string, ComponentType> = {
  shape: ShapePanel,
  color: ColorPanel,
  image: ImagePanel,
  text: TextPanel,
  shapes: ShapesPanel,
  icon: IconPanel,
  logos: LogosPanel,
  draw: DrawPanel,
  layers: LayersPanel,
  gallery: GalleryPanel,
};

/** Management panels that stay reachable during a multi-selection (IN-13). */
const MANAGEMENT_PANELS = new Set(["layers", "gallery"]);

export function PanelDock() {
  const activePanel = useUiStore((s) => s.activePanel);
  const multi = useSelectionStore((s) => s.selectedIds.length > 1);
  if (!activePanel && !multi) return null;
  const Panel = activePanel ? PANELS[activePanel] : null;
  // The multi-select panel overrides an element panel, but an explicit Layers/
  // Gallery choice wins — so they aren't unreachable while multi-selecting.
  const showMulti = multi && !(activePanel && MANAGEMENT_PANELS.has(activePanel));
  return (
    <aside className="w-[280px] shrink-0 border-r bg-card">
      <ScrollArea className="h-full">
        {showMulti ? <MultiSelectPanel /> : Panel ? <Panel /> : null}
      </ScrollArea>
    </aside>
  );
}
