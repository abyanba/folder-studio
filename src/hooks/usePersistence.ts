/**
 * Boot-time restore of the autosaved working document, then start autosave
 * (ST-06). Restore runs once per page load (guarded so React StrictMode's
 * double-mount doesn't restore or toast twice); the undo history starts empty
 * so the restored doc can't be undone into an empty canvas.
 */

import { useEffect } from "react";
import { loadWorkingDoc, startAutosave } from "@/lib/autosave";
import { useDocumentStore } from "@/store/documentStore";
import { notify } from "@/store/toastStore";

let restoredOnce = false;

export function usePersistence(): void {
  useEffect(() => {
    if (!restoredOnce) {
      restoredOnce = true;
      const saved = loadWorkingDoc();
      if (saved) {
        useDocumentStore.getState().loadDocument(saved);
        useDocumentStore.temporal.getState().clear();
        notify.info("Restored your last session");
      }
    }
    return startAutosave();
  }, []);
}
