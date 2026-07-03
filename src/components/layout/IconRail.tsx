/**
 * Left icon rail: one button per tool, toggling the docked panel. Rebuilt on
 * shadcn `Button` + `Tooltip` (not the legacy inline-styled rail).
 */

import type { ComponentType } from "react";
import {
  Award,
  Folder,
  Grid3x3,
  Image,
  Images,
  Layers,
  Palette,
  Pencil,
  Shapes,
  Star,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/store/uiStore";
import { TOOLS } from "./tools";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  shape: Folder,
  color: Palette,
  image: Image,
  logos: Award,
  icon: Star,
  shapes: Shapes,
  text: Type,
  draw: Pencil,
  texture: Grid3x3,
  layers: Layers,
  gallery: Images,
};

export function IconRail() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      {TOOLS.map((t) => {
        const Icon = ICONS[t.id] ?? Folder;
        const active = activePanel === t.id;
        return (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="icon"
                aria-pressed={active}
                aria-label={t.label}
                onClick={() => setActivePanel(active ? null : t.id)}
              >
                <Icon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
