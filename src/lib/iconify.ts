/**
 * Icon-body cache with LOCAL-FIRST resolution (Phase 6): bodies come from the
 * baked asset modules in `src/data/generated/` (Phosphor via @iconify-json/ph,
 * mono logos via the simple-icons npm package, color logos via svgl.app),
 * loaded through lazy `import()` so they ship as split chunks off the main
 * bundle. The app therefore works fully offline.
 *
 * The Iconify REST fetch survives only as a defensive fallback for Phosphor
 * names outside the baked subset (shouldn't happen — the catalogs are closed).
 * Mono/color logos have no network path at all: simple-icons and svgl are
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

type CacheEntry = IconBody | "pending" | "failed";

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
  return resolvedBody(cache.get(key));
}

export function getColorLogoBody(name: string): IconBody | null {
  return resolvedBody(cache.get(`logoc:${name}`));
}

export function getColorLogoDarkBody(name: string): IconBody | null {
  return resolvedBody(cache.get(`logocd:${name}`));
}

/** A cache entry is a real body only if it isn't one of the string sentinels. */
function resolvedBody(v: CacheEntry | undefined): IconBody | null {
  return v && v !== "pending" && v !== "failed" ? v : null;
}

export function isIconPending(cacheKey: string): boolean {
  return cache.get(cacheKey) === "pending";
}

/** Cache key for an icon element, mirroring `getIconBody`'s key scheme. */
export function iconCacheKey(name: string, variant: IconVariant | string): string {
  return variant === "logo" ? `logo:${name}` : phCacheKey(name, variant);
}

/**
 * Resolution state of an icon element (ST-10). "failed" means baked lookup (and
 * any REST fallback) came up empty — a distinct, non-loading state so the editor
 * can show "unavailable offline" instead of a placeholder that pulses forever.
 */
export function iconStatus(
  name: string,
  variant: IconVariant | string,
): "ready" | "pending" | "failed" | "idle" {
  const v = cache.get(iconCacheKey(name, variant));
  if (v === "pending") return "pending";
  if (v === "failed") return "failed";
  return v ? "ready" : "idle";
}

/** Clear a "failed" marker and re-request the icon (explicit user retry, ST-10). */
export function retryIcon(name: string, variant: IconVariant | string): Promise<void> {
  const key = iconCacheKey(name, variant);
  if (cache.get(key) === "failed") cache.delete(key);
  return variant === "logo" ? requestMonoLogos([name]) : requestPhosphorIcons([name], variant);
}

// ---------------------------------------------------------- baked assets

/** Memoized lazy loaders — each generated module is a separate build chunk. */
let phAssets: Promise<Record<string, IconBody>> | null = null;
let monoAssets: Promise<Record<string, IconBody>> | null = null;
let colorAssets: Promise<Record<string, IconBody>> | null = null;
let colorDarkAssets: Promise<Record<string, IconBody>> | null = null;

const loadPhAssets = () =>
  (phAssets ??= import("@/data/generated/phBodies").then((m) => m.PH_BODIES));
const loadMonoAssets = () =>
  (monoAssets ??= import("@/data/generated/logoBodies").then((m) => m.LOGO_BODIES));
const loadColorAssets = () =>
  (colorAssets ??= import("@/data/generated/colorLogoBodies").then((m) => m.COLOR_LOGO_BODIES));
const loadColorDarkAssets = () =>
  (colorDarkAssets ??= import("@/data/generated/colorLogoDarkBodies").then(
    (m) => m.COLOR_LOGO_DARK_BODIES,
  ));

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
    // Leave keys "pending"; `resolve` marks whatever the fallback didn't fill
    // as "failed" (ST-10), so an offline miss is a distinct state, not an evict.
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
  }
  // Anything still pending after baked assets (+ optional fallback) has no
  // offline source — mark it "failed" (not evicted) so the UI can show a
  // distinct "unavailable" state instead of a forever-pulsing placeholder (ST-10).
  uncached.forEach((e) => {
    if (cache.get(e.cacheKey) === "pending") cache.set(e.cacheKey, "failed");
  });
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

/** Resolve full-color (svgl) logo bodies — baked only, no network. */
export function requestColorLogos(names: string[]): Promise<void> {
  return resolve(
    names.map((n) => ({ cacheKey: `logoc:${n}`, assetKey: n })),
    loadColorAssets,
  );
}

/** Resolve dark-theme color-logo variants (only some brands ship one). */
export function requestColorLogosDark(names: string[]): Promise<void> {
  return resolve(
    names.map((n) => ({ cacheKey: `logocd:${n}`, assetKey: n })),
    loadColorDarkAssets,
  );
}

// ------------------------------------------------------- custom assets

/**
 * Seed a user-added tintable body directly into the cache (custom assets have
 * no baked module or network source). Keyed exactly like a placed element's
 * lookup so the editor and export both resolve it via {@link getIconBody}.
 */
export function seedCustomBody(name: string, variant: IconVariant | string, body: IconBody): void {
  cache.set(iconCacheKey(name, variant), body);
  notify();
}

/** Drop a custom body when its library entry is removed. */
export function evictCustomBody(name: string, variant: IconVariant | string): void {
  cache.delete(iconCacheKey(name, variant));
  notify();
}

/** Test-only: reset the module cache between cases. */
export function __resetIconCacheForTests(): void {
  cache.clear();
  version = 0;
}
