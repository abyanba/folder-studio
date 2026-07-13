/**
 * Screen color sampler using the EyeDropper API. Renders nothing when the
 * browser doesn't support it (Chromium-only), matching the legacy behavior.
 *
 * Windows Chrome implements the eyedropper as a modal native capture window.
 * If the React subtree that started a capture unmounts mid-session (e.g. the
 * color popover dismissing itself when the overlay steals focus), the capture
 * window is orphaned and the whole browser stops accepting clicks. Three
 * defenses here: the session is announced module-wide so popovers can refuse
 * to dismiss ({@link isEyeDropperSessionActive}), `open()` waits for the
 * triggering click to fully settle, and an unmount aborts the native session.
 */

import { useEffect, useRef } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperApi {
  open: (options?: { signal?: AbortSignal }) => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi;
  }
}

let activeSessions = 0;

/** True while any eyedropper capture is in progress (or just finishing). */
export function isEyeDropperSessionActive(): boolean {
  return activeSessions > 0;
}

export function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const abortRef = useRef<AbortController | null>(null);

  // If this button ever unmounts mid-capture, cancel the native session
  // instead of orphaning Chrome's modal capture window.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!window.EyeDropper) return null;
  const EyeDropperCtor = window.EyeDropper;

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7 shrink-0"
      aria-label="Pick color from screen"
      onClick={async () => {
        activeSessions++;
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        try {
          // Let the click event and any popover focus handling settle before
          // the native overlay takes over.
          await new Promise((resolve) => setTimeout(resolve, 0));
          const result = await new EyeDropperCtor().open({ signal: ctrl.signal });
          onPick(result.sRGBHex.toLowerCase());
        } catch {
          // User cancelled the eyedropper — nothing to do.
        } finally {
          abortRef.current = null;
          // Decrement a tick later: the focus/click that ended the capture is
          // still being dispatched, and dismiss guards must still see "active".
          setTimeout(() => {
            activeSessions--;
          }, 0);
        }
      }}
    >
      <Pipette className="size-3.5" />
    </Button>
  );
}
