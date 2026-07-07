/**
 * Project file (.json) round-trip (Phase 8 roadmap item 6): save the whole
 * design to a single portable file and reopen it later — the same `{ v, doc }`
 * shape autosave uses, run back through the shared migration path so files from
 * older versions (and legacy gallery snapshots) still open.
 */

import type { FolderDocument } from "@/types/document";
import { DOCUMENT_VERSION } from "@/types/document";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";

/** Suggested download name for a saved project. */
export const PROJECT_FILE_NAME = "folder-studio-project.json";

interface ProjectFile {
  v: number;
  doc: FolderDocument;
}

/** Serialize a document to a pretty-printed project-file string. */
export function serializeProject(doc: FolderDocument): string {
  return JSON.stringify({ v: DOCUMENT_VERSION, doc } satisfies ProjectFile, null, 2);
}

/**
 * Parse a project-file string back to a normalized document. Throws a
 * user-readable error when the text isn't a recognizable project file.
 */
export function parseProject(text: string): FolderDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn’t valid JSON.");
  }
  const p = parsed as Partial<ProjectFile> | null;
  if (!p || typeof p !== "object" || !p.doc || typeof p.doc !== "object") {
    throw new Error("That doesn’t look like a Folder Studio project file.");
  }
  return normalizeLegacySnapshot(p.doc);
}
