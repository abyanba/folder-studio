/**
 * Right-click menu for workspace elements: duplicate, z-order, lock/hide,
 * delete — reusing the document-store actions (each = one undo entry). The
 * trigger wraps the workspace; the target element resolves from the event via
 * `data-element-id` and gets selected before the menu opens.
 */

import { useState, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

export function ElementContextMenu({ children }: { children: ReactNode }) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const el = useDocumentStore((s) => s.doc.elements.find((e) => e.id === targetId));

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenu={(e) => {
          const hit = (e.target as HTMLElement).closest("[data-element-id]");
          const id = hit?.getAttribute("data-element-id") ?? null;
          setTargetId(id);
          if (id && !useSelectionStore.getState().selectedIds.includes(id)) {
            useSelectionStore.getState().select(id);
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      {el && (
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            className="text-xs"
            onSelect={() => {
              const newId = useDocumentStore.getState().duplicateElement(el.id);
              if (newId) useSelectionStore.getState().select(newId);
            }}
          >
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().bringToFront(el.id)}
          >
            Bring to front
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().moveUp(el.id)}
          >
            Bring forward
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().moveDown(el.id)}
          >
            Send backward
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().sendToBack(el.id)}
          >
            Send to back
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().toggleLock(el.id)}
          >
            {el.locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().toggleVisible(el.id)}
          >
            {el.visible === false ? "Show" : "Hide"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            className="text-xs"
            onSelect={() => {
              useDocumentStore.getState().removeElements([el.id]);
              useSelectionStore.getState().clear();
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
