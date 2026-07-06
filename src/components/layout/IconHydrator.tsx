/**
 * Headless: requests icon/logo bodies for whatever the document currently
 * references, re-firing whenever the element list changes (ST-11). This is what
 * makes a gallery-loaded / undone / pasted design show its icons on the canvas
 * without the user first opening the matching panel.
 */

import { useEffect } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { hydrateDocumentIcons } from "@/lib/iconHydration";

export function IconHydrator() {
  const elements = useDocumentStore((s) => s.doc.elements);
  useEffect(() => {
    void hydrateDocumentIcons(useDocumentStore.getState().doc);
  }, [elements]);
  return null;
}
