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
import { TexturePanel } from "@/components/panels/TexturePanel";
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
  texture: TexturePanel,
  image: ImagePanel,
  text: TextPanel,
  shapes: ShapesPanel,
  icon: IconPanel,
  logos: LogosPanel,
  draw: DrawPanel,
  layers: LayersPanel,
  gallery: GalleryPanel,
};

export function PanelDock() {
  const activePanel = useUiStore((s) => s.activePanel);
  const multi = useSelectionStore((s) => s.selectedIds.length > 1);
  if (!activePanel && !multi) return null;
  const Panel = activePanel ? PANELS[activePanel] : null;
  return (
    <aside className="w-[280px] shrink-0 border-r bg-card">
      <ScrollArea className="h-full">
        {multi ? <MultiSelectPanel /> : Panel ? <Panel /> : null}
      </ScrollArea>
    </aside>
  );
}
