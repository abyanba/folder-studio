/**
 * Working-document autosave (ST-06): the in-progress design is debounced to
 * localStorage so a tab close/crash no longer loses unsaved work. Writes are
 * skipped mid-gesture (commit-time state only) and a quota failure surfaces once
 * via a latch, not on every write.
 *
 * Persist format: `{ v: 1, doc }`. The doc is normalized through the same
 * migration path as gallery snapshots on restore.
 */

import isEqual from "fast-deep-equal";
import type { FolderDocument } from "@/types/document";
import { createEmptyDocument } from "@/types/document";
import { isDocPreviewActive, useDocumentStore } from "@/store/documentStore";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";
import { notify } from "@/store/toastStore";

const KEY = "fs_workingdoc";
const DEBOUNCE_MS = 800;

interface Persisted {
  v: 1;
  doc: FolderDocument;
}

/** Read the saved working doc, or null when absent/corrupt/pristine. */
export function loadWorkingDoc(): FolderDocument | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || typeof parsed !== "object" || !parsed.doc) return null;
    const doc = normalizeLegacySnapshot(parsed.doc);
    // Nothing to restore if it's an untouched empty document.
    return isEqual(doc, createEmptyDocument()) ? null : doc;
  } catch {
    return null;
  }
}

export function clearWorkingDoc(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Subscribe to document changes and debounce-persist commit-time state. Returns
 * an unsubscribe. `deps` are injectable for testing (default = real store/timers).
 */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let quotaWarned = false;

  const write = (doc: FolderDocument): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, doc }));
      quotaWarned = false;
    } catch {
      if (!quotaWarned) {
        quotaWarned = true;
        notify.error("Autosave paused — storage full", "Save to the gallery or free up space");
      }
    }
  };

  const unsubscribe = useDocumentStore.subscribe((state) => {
    if (isDocPreviewActive()) return; // only persist settled state
    if (timer != null) clearTimeout(timer);
    const doc = state.doc;
    timer = setTimeout(() => write(doc), DEBOUNCE_MS);
  });

  return () => {
    if (timer != null) clearTimeout(timer);
    unsubscribe();
  };
}
