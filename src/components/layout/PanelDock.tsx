/**
 * The 280px docked panel. Renders the active tool's panel inside a scroll
 * area; hidden when no panel is active. Panels not yet rebuilt render the
 * Phase-4 stub.
 */

import type { ComponentType } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUiStore } from "@/store/uiStore";
import { PanelStub } from "@/components/panels/PanelStub";
import { ShapePanel } from "@/components/panels/ShapePanel";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { TexturePanel } from "@/components/panels/TexturePanel";

const PANELS: Record<string, ComponentType> = {
  shape: ShapePanel,
  color: ColorPanel,
  texture: TexturePanel,
};

export function PanelDock() {
  const activePanel = useUiStore((s) => s.activePanel);
  if (!activePanel) return null;
  const Panel = PANELS[activePanel];
  return (
    <aside className="w-[280px] shrink-0 border-r bg-card">
      <ScrollArea className="h-full">
        {Panel ? <Panel /> : <PanelStub id={activePanel} />}
      </ScrollArea>
    </aside>
  );
}
