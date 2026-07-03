/**
 * Screen color sampler using the EyeDropper API. Renders nothing when the
 * browser doesn't support it (Chromium-only), matching the legacy behavior.
 */

import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperApi {
  open: () => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi;
  }
}

export function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  if (!window.EyeDropper) return null;
  const EyeDropperCtor = window.EyeDropper;

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7 shrink-0"
      aria-label="Pick color from screen"
      onClick={async () => {
        try {
          const result = await new EyeDropperCtor().open();
          onPick(result.sRGBHex.toLowerCase());
        } catch {
          // User cancelled the eyedropper — nothing to do.
        }
      }}
    >
      <Pipette className="size-3.5" />
    </Button>
  );
}
