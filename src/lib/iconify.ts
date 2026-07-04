/**
 * Icon-body cache with LOCAL-FIRST resolution (Phase 6): bodies come from the
 * baked asset modules in `src/data/generated/` (Phosphor via @iconify-json/ph,
 * mono logos via the simple-icons npm package, color logos via thesvg.org),
 * loaded through lazy `import()` so they ship as split chunks off the main
 * bundle. The app therefore works fully offline.
 *
 * The Iconify REST fetch survives only as a defensive fallback for Phosphor
 * names outside the baked subset (shouldn't happen — the catalogs are closed).
 * Mono/color logos have no network path at all: simple-icons and thesvg are
 * the only sources.
 *
 * Cache keys keep the legacy scheme so `_getIconBody` semantics carry over:
 * - Phosphor:   `<name><-variant?>`
 * - Mono logo:  `logo:<catalog name>`
 * - Color logo: `logoc:<catalog name>`
 *
 * Components subscribe via `useIconCacheVersion()` (useSyncExternalStore);
 * fetching/loading is requested from effects, never during render.
 */

import { useSyncExternalStore } from "react";
import type { IconBody } from "@/lib/export/elementSvg";
import type { IconVariant } from "@/types/element";

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
  const v = cache.get(`logoc:${name}`);
  return v && v !== "pending" ? v : null;
}

export function isIconPending(cacheKey: string): boolean {
  return cache.get(cacheKey) === "pending";
}

// ---------------------------------------------------------- baked assets

/** Memoized lazy loaders — each generated module is a separate build chunk. */
let phAssets: Promise<Record<string, IconBody>> | null = null;
let monoAssets: Promise<Record<string, IconBody>> | null = null;
let colorAssets: Promise<Record<string, IconBody>> | null = null;

const loadPhAssets = () =>
  (phAssets ??= import("@/data/generated/phBodies").then((m) => m.PH_BODIES));
const loadMonoAssets = () =>
  (monoAssets ??= import("@/data/generated/logoBodies").then((m) => m.LOGO_BODIES));
const loadColorAssets = () =>
  (colorAssets ??= import("@/data/generated/colorLogoBodies").then((m) => m.COLOR_LOGO_BODIES));

// ------------------------------------------------------- fetch fallback

const API = "https://api.iconify.design";

/** REST fallback for Phosphor keys outside the baked subset. */
async function fetchPhosphorFallback(keys: string[]): Promise<void> {
  try {
    const res = await fetch(`${API}/ph.json?icons=${keys.join(",")}`);
    const data = (await res.json()) as {
      icons?: Record<string, IconBody>;
      width?: number;
      height?: number;
    };
    keys.forEach((k) => {
      if (cache.get(k) === "pending") cache.delete(k);
    });
    Object.entries(data.icons ?? {}).forEach(([apiName, body]) => {
      if (keys.includes(apiName)) {
        cache.set(apiName, {
          width: body.width ?? data.width,
          height: body.height ?? data.height,
          body: body.body,
        });
      }
    });
  } catch {
    keys.forEach((k) => {
      if (cache.get(k) === "pending") cache.delete(k);
    });
  }
}

// ------------------------------------------------------------- requests

async function resolve(
  entries: Array<{ cacheKey: string; assetKey: string }>,
  loadAssets: () => Promise<Record<string, IconBody>>,
  fallback?: (missingAssetKeys: string[]) => Promise<void>,
): Promise<void> {
  const uncached = entries.filter((e) => !cache.has(e.cacheKey));
  if (!uncached.length) return;
  uncached.forEach((e) => cache.set(e.cacheKey, "pending"));
  notify();

  const assets = await loadAssets();
  const missing: string[] = [];
  uncached.forEach((e) => {
    const body = assets[e.assetKey];
    if (body) cache.set(e.cacheKey, body);
    else missing.push(e.assetKey);
  });

  if (missing.length && fallback) {
    await fallback(missing);
  } else {
    // No fallback source — evict so a later request may retry.
    uncached.forEach((e) => {
      if (cache.get(e.cacheKey) === "pending") cache.delete(e.cacheKey);
    });
  }
  notify();
}

/** Resolve Phosphor bodies for `names` in `variant` (baked subset + REST fallback). */
export function requestPhosphorIcons(
  names: string[],
  variant: IconVariant | string,
): Promise<void> {
  return resolve(
    names.map((n) => {
      const key = phCacheKey(n, variant);
      return { cacheKey: key, assetKey: key };
    }),
    loadPhAssets,
    fetchPhosphorFallback,
  );
}

/** Resolve mono (simple-icons) logo bodies — baked only, no network. */
export function requestMonoLogos(names: string[]): Promise<void> {
  return resolve(
    names.map((n) => ({ cacheKey: `logo:${n}`, assetKey: n })),
    loadMonoAssets,
  );
}

/** Resolve full-color (thesvg) logo bodies — baked only, no network. */
export function requestColorLogos(names: string[]): Promise<void> {
  return resolve(
    names.map((n) => ({ cacheKey: `logoc:${n}`, assetKey: n })),
    loadColorAssets,
  );
}

/** Test-only: reset the module cache between cases. */
export function __resetIconCacheForTests(): void {
  cache.clear();
  version = 0;
}
