/**
 * UI glue for project-file save/open (Phase 8): serialize + download, and
 * read + parse + load into the stores with a toast either way. Kept out of the
 * pure {@link parseProject}/{@link serializeProject} module so those stay
 * store-free and node-testable.
 */

import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { notify } from "@/store/toastStore";
import { downloadBlob } from "@/lib/export/exporters";
import { PROJECT_FILE_NAME, parseProject, serializeProject } from "@/lib/projectFile";

/** Download the current design as a portable project file. */
export function saveProjectFile(): void {
  const doc = useDocumentStore.getState().doc;
  const blob = new Blob([serializeProject(doc)], { type: "application/json" });
  downloadBlob(blob, PROJECT_FILE_NAME);
  notify.success("Project file saved");
}

/** Read, parse, and load a project file, replacing the current design. */
export async function openProjectFile(file: File): Promise<void> {
  try {
    const doc = parseProject(await file.text());
    useDocumentStore.getState().loadDocument(doc);
    useDocumentStore.temporal.getState().clear(); // opening a file is a fresh session
    useSelectionStore.getState().clear();
    notify.success(`Opened ${file.name}`);
  } catch (err) {
    notify.error("Couldn’t open project", err instanceof Error ? err.message : undefined);
  }
}
