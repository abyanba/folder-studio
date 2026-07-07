/**
 * Application shell: toolbar over (icon rail + docked panel + workspace).
 * Installs the global keyboard shortcuts and the tooltip provider.
 */

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePersistence } from "@/hooks/usePersistence";
import { useProjectFileDrop } from "@/hooks/useProjectFileDrop";
import { Toolbar } from "./Toolbar";
import { IconRail } from "./IconRail";
import { PanelDock } from "./PanelDock";
import { IconHydrator } from "./IconHydrator";
import { HelpDialog } from "./HelpDialog";
import { Workspace } from "@/components/workspace/Workspace";

export function AppShell() {
  useKeyboardShortcuts();
  usePersistence();
  useProjectFileDrop();
  return (
    <TooltipProvider delayDuration={300}>
      <IconHydrator />
      <div className="flex h-svh w-full flex-col bg-background text-foreground">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <IconRail />
          <PanelDock />
          <Workspace />
        </div>
      </div>
      <HelpDialog />
      <Toaster />
    </TooltipProvider>
  );
}
