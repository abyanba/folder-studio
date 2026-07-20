/**
 * Lazy access to the baked Hero Patterns bodies. The generated module is ~130KB,
 * so it loads as its own chunk on first use — the same arrangement as the icon
 * and logo bodies, keeping it out of the initial bundle.
 *
 * `getPatternBody` is synchronous and returns null until the chunk has landed,
 * so render paths stay sync; `loadPatternBodies` is awaited by the editor (via
 * `usePatternBody`) and by `prepareDocumentAssets` before an export rasterizes.
 */

import type { PatternBody } from "@/data/generated/patternBodies";

let bodies: Record<string, PatternBody> | null = null;
let inFlight: Promise<void> | null = null;

/** Bumped when the chunk lands, so subscribed components re-render. */
let version = 0;
const listeners = new Set<() => void>();

export function loadPatternBodies(): Promise<void> {
  if (bodies) return Promise.resolve();
  inFlight ??= import("@/data/generated/patternBodies")
    .then((m) => {
      bodies = m.PATTERN_BODIES;
      version++;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      // Leave `bodies` null — callers render nothing rather than throwing, and a
      // later call retries.
      inFlight = null;
    });
  return inFlight;
}

/** The baked body, or null when the id is unknown or the chunk isn't loaded yet. */
export function getPatternBody(id: string): PatternBody | null {
  if (!id || id === "none") return null;
  return bodies?.[id] ?? null;
}

export function subscribePatternBodies(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function patternBodiesVersion(): number {
  return version;
}
