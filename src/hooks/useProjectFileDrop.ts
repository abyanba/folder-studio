/**
 * Drag a .json project file anywhere onto the app to open it (Phase 8). Only
 * intercepts JSON file drops — anything else falls through to default handling.
 */

import { useEffect } from "react";
import { openProjectFile } from "@/lib/projectActions";

function isJsonFileDrag(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types).includes("Files");
}

export function useProjectFileDrop(): void {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (isJsonFileDrag(e.dataTransfer)) e.preventDefault(); // allow the drop
    };
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !/\.json$/i.test(file.name)) return;
      e.preventDefault();
      void openProjectFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
