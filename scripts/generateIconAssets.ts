/**
 * Bakes the icon/logo assets the app ships offline, keyed by the closed
 * catalogs in `src/data/`:
 *
 *   1. Phosphor icons  — @iconify-json/ph (node_modules, no network)
 *   2. Mono logos      — simple-icons npm package (node_modules, no network)
 *   3. Color logos     — thesvg.org via its jsDelivr CDN (network at
 *                        generation time only; slugs from THESVG_SLUGS)
 *
 * Output: src/data/generated/{phBodies,logoBodies,colorLogoBodies}.ts —
 * checked in, lazily imported by lib/iconify.ts. Re-run after editing the
 * catalogs:  npm run generate:icons
 *
 * The script FAILS if a Phosphor name or a thesvg logo doesn't resolve
 * (catalog typo). Mono logos missing from simple-icons (trademark removals:
 * Microsoft/Adobe/LinkedIn/…) are expected and reported — those brands are
 * color-only.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getIconData } from "@iconify/utils";
import phJson from "@iconify-json/ph/icons.json" with { type: "json" };
import * as simpleIcons from "simple-icons";
import { ICON_NAMES } from "../src/data/iconNames";
import { LOGO_NAMES, thesvgSlug } from "../src/data/logos";

const THESVG_REF = "main";
const THESVG_CDN = `https://cdn.jsdelivr.net/gh/glincker/thesvg@${THESVG_REF}/public/icons`;
const PH_VARIANT_SUFFIXES = ["", "-bold", "-thin", "-light", "-fill", "-duotone"];

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "generated");
mkdirSync(outDir, { recursive: true });

interface BodyData {
  body: string;
  width: number;
  height: number;
}

function header(source: string): string {
  return `/**
 * GENERATED FILE — do not edit. Rebuild with \`npm run generate:icons\`.
 * Source: ${source}
 */

/* eslint-disable */

`;
}

function emit(file: string, source: string, chunks: string[]): void {
  writeFileSync(join(outDir, file), header(source) + chunks.join("\n") + "\n");
  console.log(`wrote src/data/generated/${file}`);
}

// ---------------------------------------------------------------- Phosphor
function generatePhosphor(): void {
  const names = [...new Set(Object.values(ICON_NAMES).flat())];
  const bodies: Record<string, BodyData> = {};
  const missing: string[] = [];
  for (const name of names) {
    for (const suffix of PH_VARIANT_SUFFIXES) {
      const key = name + suffix;
      const data = getIconData(phJson, key);
      if (!data) {
        missing.push(key);
        continue;
      }
      bodies[key] = {
        body: data.body,
        width: data.width ?? phJson.width ?? 256,
        height: data.height ?? phJson.height ?? 256,
      };
    }
  }
  if (missing.length) {
    throw new Error(`Phosphor icons missing from @iconify-json/ph: ${missing.join(", ")}`);
  }
  emit("phBodies.ts", "@iconify-json/ph", [
    `import type { IconBody } from "@/lib/export/elementSvg";`,
    ``,
    `export const PH_BODIES: Record<string, IconBody> = ${JSON.stringify(bodies)};`,
  ]);
  console.log(`  ${Object.keys(bodies).length} phosphor bodies (${names.length} names × ${PH_VARIANT_SUFFIXES.length} variants)`);
}

// -------------------------------------------------------------- Mono logos
function generateMonoLogos(): string[] {
  const names = [...new Set(Object.values(LOGO_NAMES).flat())];
  const bySlug = new Map<string, { path: string }>();
  for (const value of Object.values(simpleIcons)) {
    const icon = value as { slug?: string; path?: string };
    if (icon && typeof icon.slug === "string" && typeof icon.path === "string") {
      bySlug.set(icon.slug, { path: icon.path });
    }
  }
  const bodies: Record<string, BodyData> = {};
  const colorOnly: string[] = [];
  for (const name of names) {
    const icon = bySlug.get(name);
    if (!icon) {
      colorOnly.push(name);
      continue;
    }
    bodies[name] = {
      body: `<path fill="currentColor" d="${icon.path}"/>`,
      width: 24,
      height: 24,
    };
  }
  emit("logoBodies.ts", "simple-icons (simpleicons.org)", [
    `import type { IconBody } from "@/lib/export/elementSvg";`,
    ``,
    `export const LOGO_BODIES: Record<string, IconBody> = ${JSON.stringify(bodies)};`,
  ]);
  // Small standalone module so panels can filter synchronously without
  // pulling the body data into the main bundle.
  emit("monoLogoNames.ts", "simple-icons (simpleicons.org)", [
    `/** Catalog names with a tintable mono body (rest are color-only). */`,
    `export const MONO_LOGO_NAMES: string[] = ${JSON.stringify(Object.keys(bodies))};`,
  ]);
  console.log(`  ${Object.keys(bodies).length} mono logos; ${colorOnly.length} color-only (removed from simple-icons): ${colorOnly.join(", ")}`);
  return names;
}

// ------------------------------------------------------------- Color logos
async function fetchSvg(slug: string, variant: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${THESVG_CDN}/${slug}/${variant}.svg`);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch {
      // Transient network error — retry with backoff.
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  return null;
}

function parseSvg(svg: string, name: string): BodyData {
  const open = svg.match(/<svg[^>]*>/i);
  if (!open) throw new Error("no <svg> tag");
  let body = svg.slice(svg.indexOf(open[0]) + open[0].length, svg.lastIndexOf("</svg>")).trim();
  if (!body) throw new Error("empty body");
  // Consumers render the body in a `0 0 w h` viewBox, so a source viewBox with
  // a non-zero origin used to render offset/half-clipped. Shift it back here.
  const vb = open[0].match(/viewBox="([\d.\s,-]+)"/i)?.[1]?.split(/[\s,]+/).map(Number);
  const [minX, minY] = [vb?.[0] ?? 0, vb?.[1] ?? 0];
  const width = vb?.[2] ?? Number(open[0].match(/width="([\d.]+)"/i)?.[1] ?? 24);
  const height = vb?.[3] ?? Number(open[0].match(/height="([\d.]+)"/i)?.[1] ?? 24);
  if (minX || minY) body = `<g transform="translate(${-minX} ${-minY})">${body}</g>`;
  // These bodies are rasterized as standalone `<img>` data-URLs, where external
  // references never load — such a logo would ship as a blank.
  if (/<image\b[^>]*href="https?:/i.test(body)) throw new Error("external <image> reference");
  // Ids are global once several bodies are inlined into one document; namespace
  // them per logo so `url(#a)` can't resolve to a different logo's gradient.
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids)) {
    const safe = id.replace(/[^\w-]/g, "");
    const pfx = `${name.replace(/[^\w-]/g, "")}_${safe}`;
    body = body
      .replaceAll(` id="${id}"`, ` id="${pfx}"`)
      .replaceAll(`url(#${id})`, `url(#${pfx})`)
      .replaceAll(`href="#${id}"`, `href="#${pfx}"`);
  }
  return { body, width, height };
}

async function generateColorLogos(names: string[]): Promise<void> {
  const bodies: Record<string, BodyData> = {};
  const failed: string[] = [];
  for (const name of names) {
    const slug = thesvgSlug(name);
    // Prefer an explicit color variant, else the default artwork.
    const svg = (await fetchSvg(slug, "color")) ?? (await fetchSvg(slug, "default"));
    if (!svg) {
      failed.push(`${name} (slug: ${slug})`);
      continue;
    }
    try {
      bodies[name] = parseSvg(svg, name);
    } catch (e) {
      failed.push(`${name} (slug: ${slug}) — ${(e as Error).message}`);
    }
  }
  if (failed.length) {
    throw new Error(`thesvg logos failed to fetch: ${failed.join(", ")}`);
  }
  emit("colorLogoBodies.ts", `thesvg.org (glincker/thesvg@${THESVG_REF} via jsDelivr)`, [
    `import type { IconBody } from "@/lib/export/elementSvg";`,
    ``,
    `export const COLOR_LOGO_BODIES: Record<string, IconBody> = ${JSON.stringify(bodies)};`,
  ]);
  console.log(`  ${Object.keys(bodies).length} color logos from thesvg`);
}

const logoNames = (generatePhosphor(), generateMonoLogos());
await generateColorLogos(logoNames);
console.log("done");
