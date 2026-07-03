/**
 * The 280px docked panel. Renders the panel for the active tool (stubs in
 * Phase 4) inside a scroll area; hidden when no panel is active.
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { useUiStore } from "@/store/uiStore";
import { PanelStub } from "@/components/panels/PanelStub";

export function PanelDock() {
  const activePanel = useUiStore((s) => s.activePanel);
  if (!activePanel) return null;
  return (
    <aside className="w-[280px] shrink-0 border-r bg-card">
      <ScrollArea className="h-full">
        <PanelStub id={activePanel} />
      </ScrollArea>
    </aside>
  );
}
