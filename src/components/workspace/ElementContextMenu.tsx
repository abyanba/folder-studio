/**
 * Right-click menu for workspace elements: duplicate, z-order, lock/hide,
 * delete — reusing the document-store actions (each = one undo entry). The
 * trigger wraps the workspace; the target element resolves from the event via
 * `data-element-id` and gets selected before the menu opens.
 */

import { useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MousePointerClick,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { hasClipboard, pasteClipboard, selectAll } from "@/lib/clipboard";

/** Render a shortcut as shadcn Kbd chips, e.g. ["Ctrl","D"]. */
function Shortcut({ keys }: { keys: string[] }) {
  return (
    <ContextMenuShortcut>
      <KbdGroup>
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </KbdGroup>
    </ContextMenuShortcut>
  );
}

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
      {!el ? (
        // Right-click on empty canvas (AR-10): canvas-level actions instead of a
        // dead, contentless menu.
        <ContextMenuContent className="w-52">
          <ContextMenuItem className="text-xs" disabled={!hasClipboard()} onSelect={pasteClipboard}>
            <ClipboardPaste />
            Paste
            <Shortcut keys={["Ctrl", "V"]} />
          </ContextMenuItem>
          <ContextMenuItem className="text-xs" onSelect={selectAll}>
            <MousePointerClick />
            Select all
            <Shortcut keys={["Ctrl", "A"]} />
          </ContextMenuItem>
        </ContextMenuContent>
      ) : (
        <ContextMenuContent className="w-52">
          <ContextMenuItem
            className="text-xs"
            onSelect={() => {
              const newId = useDocumentStore.getState().duplicateElement(el.id);
              if (newId) useSelectionStore.getState().select(newId);
            }}
          >
            <Copy />
            Duplicate
            <Shortcut keys={["Ctrl", "D"]} />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().bringToFront(el.id)}
          >
            <ArrowUpToLine />
            Bring to front
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().moveUp(el.id)}
          >
            <ChevronUp />
            Bring forward
            <Shortcut keys={["]"]} />
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().moveDown(el.id)}
          >
            <ChevronDown />
            Send backward
            <Shortcut keys={["["]} />
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().sendToBack(el.id)}
          >
            <ArrowDownToLine />
            Send to back
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().toggleLock(el.id)}
          >
            {el.locked ? <LockOpen /> : <Lock />}
            {el.locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs"
            onSelect={() => useDocumentStore.getState().toggleVisible(el.id)}
          >
            {el.visible === false ? <Eye /> : <EyeOff />}
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
            <Trash2 />
            Delete
            <Shortcut keys={["Del"]} />
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
