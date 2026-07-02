/**
 * Single source of element IDs. The legacy app mixed numeric IDs (shapes/text/
 * images) with `"el"+n` strings (icons/logos), which broke the `nextId` recompute.
 * Here every ID is a string from one monotonic counter.
 */

let counter = 0;

/** Return a new unique string ID, e.g. `"el1"`, `"el2"`, … */
export function createId(prefix = "el"): string {
  counter += 1;
  return `${prefix}${counter}`;
}

/**
 * Advance the counter so future IDs won't collide with an already-loaded set.
 * Pass the highest numeric suffix currently in use (see {@link maxIdSuffix}).
 */
export function reseedIds(fromMax: number): void {
  if (fromMax > counter) counter = fromMax;
}

/** Extract the trailing integer from IDs like `"el12"` → 12 (0 if none). */
export function idSuffix(id: string): number {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Highest trailing-integer suffix across a set of IDs. */
export function maxIdSuffix(ids: readonly string[]): number {
  return ids.reduce((mx, id) => Math.max(mx, idSuffix(id)), 0);
}

/** Test-only: reset the counter to zero. */
export function __resetIdCounterForTests(): void {
  counter = 0;
}
