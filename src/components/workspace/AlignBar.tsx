/**
 * Floating align / distribute / mirror bar over the workspace, shown while at
 * least one element is selected (ported from the legacy alignBar). Align and
 * flip act relative to the content rect / each element's own center; distribute
 * needs 3+. Each action is one undo entry (the store applies it in a single set).
 */

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  FlipHorizontal2,
  FlipVertical2,
} from "lucide-react";
import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentStore, type AlignDirection, type FlipAxis } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

function BarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

export function AlignBar() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const align = useDocumentStore((s) => s.align);
  const flip = useDocumentStore((s) => s.flip);
  if (selectedIds.length < 1) return null;

  const a = (dir: AlignDirection) => () => align(selectedIds, dir);
  const f = (axis: FlipAxis) => () => flip(selectedIds, axis);
  const canDistribute = selectedIds.length >= 3;

  return (
    <TooltipProvider>
      <div className="absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-card/90 px-1.5 py-1 shadow-md backdrop-blur">
      <BarButton label="Align left" icon={AlignStartVertical} onClick={a("left")} />
      <BarButton label="Align center" icon={AlignCenterVertical} onClick={a("center")} />
      <BarButton label="Align right" icon={AlignEndVertical} onClick={a("right")} />
      <Sep />
      <BarButton label="Align top" icon={AlignStartHorizontal} onClick={a("top")} />
      <BarButton label="Align middle" icon={AlignCenterHorizontal} onClick={a("middle")} />
      <BarButton label="Align bottom" icon={AlignEndHorizontal} onClick={a("bottom")} />
      <Sep />
      <BarButton label="Flip horizontal" icon={FlipHorizontal2} onClick={f("h")} />
      <BarButton label="Flip vertical" icon={FlipVertical2} onClick={f("v")} />
      {canDistribute && (
        <>
          <Sep />
          <BarButton
            label="Distribute horizontally"
            icon={AlignHorizontalDistributeCenter}
            onClick={a("distH")}
          />
          <BarButton
            label="Distribute vertically"
            icon={AlignVerticalDistributeCenter}
            onClick={a("distV")}
          />
        </>
      )}
      </div>
    </TooltipProvider>
  );
}
