/**
 * Application shell: toolbar over (icon rail + docked panel + workspace).
 * Installs the global keyboard shortcuts and the tooltip provider.
 */

import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Toolbar } from "./Toolbar";
import { IconRail } from "./IconRail";
import { PanelDock } from "./PanelDock";
import { Workspace } from "@/components/workspace/Workspace";

export function AppShell() {
  useKeyboardShortcuts();
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-svh w-full flex-col bg-background text-foreground">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <IconRail />
          <PanelDock />
          <Workspace />
        </div>
      </div>
    </TooltipProvider>
  );
}
