/**
 * Iconify body cache + batch fetchers, replacing the legacy `_iconCache` /
 * `fetchIconBatch` / `fetchLogoBatch` / `fetchColorLogoBatch`. Unlike the
 * legacy app — which kicked off fetches during render and `forceUpdate()`d —
 * fetches here are requested from effects, and components subscribe to the
 * cache via `useIconCacheVersion()` (useSyncExternalStore).
 *
 * Cache keys mirror the legacy scheme so `_getIconBody` semantics carry over:
 * - Phosphor:   `<name><-variant?>`      (ph.json)
 * - Mono logo:  `logo:<simple-icons slug>` (simple-icons.json)
 * - Color logo: `logoc:<logos slug>`     (logos.json)
 *
 * Phase 6 owns hardening (retry policy, persistent cache, alternatives).
 */

import { useSyncExternalStore } from "react";
import type { IconBody } from "@/lib/export/elementSvg";
import type { IconVariant } from "@/types/element";
import { LOGO_COLOR_KEYS } from "@/data/logos";

type CacheEntry = IconBody | "pending";

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-render the caller whenever any icon body arrives or is evicted. */
export function useIconCacheVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function phSuffix(variant: IconVariant | string): string {
  return variant && variant !== "regular" ? `-${variant}` : "";
}

export function phCacheKey(name: string, variant: IconVariant | string): string {
  return name + phSuffix(variant);
}

/** Legacy `_getIconBody`: `variant === "logo"` reads the mono-logo cache. */
export function getIconBody(name: string, variant: IconVariant | string): IconBody | null {
  const key = variant === "logo" ? `logo:${name}` : phCacheKey(name, variant);
  const v = cache.get(key);
  return v && v !== "pending" ? v : null;
}

export function getColorLogoBody(name: string): IconBody | null {
  const slug = LOGO_COLOR_KEYS[name];
  if (!slug) return null;
  const v = cache.get(`logoc:${slug}`);
  return v && v !== "pending" ? v : null;
}

export function isIconPending(cacheKey: string): boolean {
  return cache.get(cacheKey) === "pending";
}

async function fetchBatch(
  setUrl: string,
  entries: Array<{ cacheKey: string; apiName: string }>,
): Promise<void> {
  const uncached = entries.filter((e) => !cache.has(e.cacheKey));
  if (!uncached.length) return;
  uncached.forEach((e) => cache.set(e.cacheKey, "pending"));
  notify();
  const byApiName = new Map(uncached.map((e) => [e.apiName, e.cacheKey]));
  try {
    const res = await fetch(`${setUrl}?icons=${uncached.map((e) => e.apiName).join(",")}`);
    const data = (await res.json()) as {
      icons?: Record<string, IconBody>;
      width?: number;
      height?: number;
    };
    // Evict pendings first so failed names retry on the next request.
    uncached.forEach((e) => {
      if (cache.get(e.cacheKey) === "pending") cache.delete(e.cacheKey);
    });
    Object.entries(data.icons ?? {}).forEach(([apiName, body]) => {
      const key = byApiName.get(apiName);
      if (key) {
        cache.set(key, {
          width: body.width ?? data.width,
          height: body.height ?? data.height,
          body: body.body,
        });
      }
    });
  } catch {
    uncached.forEach((e) => {
      if (cache.get(e.cacheKey) === "pending") cache.delete(e.cacheKey);
    });
  }
  notify();
}

const API = "https://api.iconify.design";

/** Fetch Phosphor icon bodies for `names` in `variant` (batch, deduped). */
export function requestPhosphorIcons(
  names: string[],
  variant: IconVariant | string,
): Promise<void> {
  return fetchBatch(
    `${API}/ph.json`,
    names.map((n) => ({ cacheKey: phCacheKey(n, variant), apiName: phCacheKey(n, variant) })),
  );
}

/** Fetch mono (simple-icons) logo bodies. */
export function requestMonoLogos(names: string[]): Promise<void> {
  return fetchBatch(
    `${API}/simple-icons.json`,
    names.map((n) => ({ cacheKey: `logo:${n}`, apiName: n })),
  );
}

/** Fetch full-color (`logos` set) logo bodies for names with a color mapping. */
export function requestColorLogos(names: string[]): Promise<void> {
  const entries = names
    .filter((n) => LOGO_COLOR_KEYS[n])
    .map((n) => ({ cacheKey: `logoc:${LOGO_COLOR_KEYS[n]}`, apiName: LOGO_COLOR_KEYS[n] }));
  return fetchBatch(`${API}/logos.json`, entries);
}

/** Test-only: reset the module cache between cases. */
export function __resetIconCacheForTests(): void {
  cache.clear();
  version = 0;
}
