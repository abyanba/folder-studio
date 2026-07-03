/**
 * Wraps a continuous pointer gesture (HSV square drag, gradient-stop drag) in
 * a document-preview transaction so the whole gesture is ONE undo entry.
 * Spread the returned props onto the gesture's container element.
 */

import { beginDocPreview, endDocPreview } from "@/store/documentStore";

export function useDocPreviewDrag(): {
  onPointerDownCapture: () => void;
} {
  return {
    onPointerDownCapture: () => {
      beginDocPreview();
      const finish = () => {
        endDocPreview();
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
  };
}
