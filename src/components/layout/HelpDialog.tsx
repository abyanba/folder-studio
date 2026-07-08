/**
 * Keyboard-shortcut cheat sheet (Phase 7). Static reference for the shortcuts
 * the app already supports — opened from the toolbar Help button or the `?` key.
 * Discoverability was the audit's "the tool teaches nothing" gap.
 */

import { Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useUiStore } from "@/store/uiStore";

/**
 * Each entry is `[action, alternatives]`, where `alternatives` is a list of
 * equivalent key combos and each combo is its own list of key tokens. Combos
 * render as a KbdGroup; alternatives are joined with a muted "or".
 */
const SHORTCUTS: Array<[action: string, alternatives: string[][]]> = [
  ["Undo", [["Ctrl/⌘", "Z"]]],
  ["Redo", [["Ctrl/⌘", "Y"], ["Ctrl/⌘", "Shift", "Z"]]],
  ["Select all", [["Ctrl/⌘", "A"]]],
  ["Copy", [["Ctrl/⌘", "C"]]],
  ["Paste", [["Ctrl/⌘", "V"]]],
  ["Duplicate", [["Ctrl/⌘", "D"]]],
  ["Delete selection", [["Delete"], ["Backspace"]]],
  ["Nudge (Shift = 10px)", [["←"], ["↑"], ["→"], ["↓"]]],
  ["Send backward", [["["]]],
  ["Bring forward", [["]"]]],
  ["Duplicate element", [["Alt", "drag"]]],
  ["Edit text in place", [["Double-click"]]],
  ["Cancel drag / exit editing", [["Esc"]]],
  ["This cheat sheet", [["?"]]],
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
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 py-1 text-sm">
          {SHORTCUTS.map(([action, alternatives]) => (
            <div key={action} className="contents">
              <dt className="text-muted-foreground">{action}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-1.5">
                {alternatives.map((combo, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="text-xs text-muted-foreground">or</span>}
                    <KbdGroup>
                      {combo.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </KbdGroup>
                  </Fragment>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
