/**
 * Document-driven icon hydration (ST-11). Icon/logo bodies must load because
 * they're *in the document*, not as a side effect of browsing a panel — so a
 * gallery-loaded design renders its icons and exports them (EXP-13).
 *
 * Color logos are stored as image elements (self-contained SVG data URLs), so
 * only Phosphor icons (any variant except `logo`) and mono logos (`logo`) need
 * cache requests here.
 */

import type { FolderDocument } from "@/types/document";
import type { FolderElement, IconVariant } from "@/types/element";
import { requestMonoLogos, requestPhosphorIcons } from "@/lib/iconify";

export interface IconRequests {
  /** Phosphor icon names grouped by variant. */
  phosphor: Map<IconVariant | string, string[]>;
  /** Mono (simple-icons) logo names. */
  monoLogos: string[];
}

/** Walk elements and bucket icon-body requests by source, deduped. */
export function collectIconRequests(elements: FolderElement[]): IconRequests {
  const phosphor = new Map<IconVariant | string, string[]>();
  const monoSet = new Set<string>();
  for (const el of elements) {
    if (el.type !== "icon") continue;
    if (el.iconVariant === "logo") {
      monoSet.add(el.iconName);
    } else {
      const variant = el.iconVariant || "regular";
      const names = phosphor.get(variant) ?? [];
      if (!names.includes(el.iconName)) names.push(el.iconName);
      phosphor.set(variant, names);
    }
  }
  return { phosphor, monoLogos: [...monoSet] };
}

/**
 * Fire (idempotent) cache requests for every icon body the document references
 * and resolve once they've all settled. Safe to call repeatedly — the cache
 * dedupes, so re-running on every `elements` change is cheap.
 */
export async function hydrateDocumentIcons(doc: FolderDocument): Promise<void> {
  const { phosphor, monoLogos } = collectIconRequests(doc.elements);
  const jobs: Promise<void>[] = [];
  for (const [variant, names] of phosphor) {
    if (names.length) jobs.push(requestPhosphorIcons(names, variant));
  }
  if (monoLogos.length) jobs.push(requestMonoLogos(monoLogos));
  await Promise.all(jobs);
}
