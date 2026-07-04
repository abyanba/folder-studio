/**
 * Shared docked-panel header: title, optional back button (sub-views), and a
 * close button that collapses the dock.
 */

import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";

export function PanelHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  return (
    <div className="sticky top-0 z-10 flex h-11 items-center gap-1 border-b bg-card/95 px-2 backdrop-blur">
      {onBack && (
        <Button variant="ghost" size="icon" className="size-7" aria-label="Back" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <h2 className="flex-1 px-1 text-sm font-semibold">{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Close panel"
        onClick={() => setActivePanel(null)}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
