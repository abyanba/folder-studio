/**
 * Keyboard-shortcut cheat sheet (Phase 7). Static reference for the shortcuts
 * the app already supports — opened from the toolbar Help button or the `?` key.
 * Discoverability was the audit's "the tool teaches nothing" gap.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/store/uiStore";

const SHORTCUTS: Array<[keys: string, action: string]> = [
  ["Ctrl/⌘ + Z", "Undo"],
  ["Ctrl/⌘ + Y · Ctrl/⌘ + Shift + Z", "Redo"],
  ["Ctrl/⌘ + A", "Select all"],
  ["Ctrl/⌘ + C · V", "Copy · Paste"],
  ["Ctrl/⌘ + D", "Duplicate"],
  ["Delete · Backspace", "Delete selection"],
  ["Arrows", "Nudge (Shift = 10px)"],
  ["[ · ]", "Send backward · Bring forward"],
  ["Alt + drag", "Duplicate element"],
  ["Double-click text", "Edit in place"],
  ["Escape", "Cancel drag / exit editing"],
  ["?", "This cheat sheet"],
];

export function HelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything you can drive from the keyboard.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 py-1 text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt className="text-muted-foreground">{action}</dt>
              <dd className="text-right font-mono text-xs">{keys}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
