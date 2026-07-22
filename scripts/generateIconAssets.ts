/**
 * Bakes the icon/logo assets the app ships offline, keyed by the closed
 * catalogs in `src/data/`:
 *
 *   1. Phosphor icons  — @iconify-json/ph (node_modules, no network)
 *   2. Mono logos      — simple-icons npm package (node_modules, no network)
 *   3. Color logos     — svgl.app via its CDN (network at generation time
 *                        only; slugs from SVGL_SLUGS)
 *
 * Output: src/data/generated/{phBodies,logoBodies,colorLogoBodies}.ts —
 * checked in, lazily imported by lib/iconify.ts. Re-run after editing the
 * catalogs:  npm run generate:icons
 *
 * The script FAILS if a Phosphor name or an svgl logo doesn't resolve
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
import { LOGO_NAMES, SVGL_DARK_SLUGS, SVGL_SLUGS, svglSlug } from "../src/data/logos";

const SVGL_CDN = "https://svgl.app/library";
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
async function fetchSvg(slug: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${SVGL_CDN}/${slug}.svg`);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch {
      // Transient network error — retry with backoff.
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  return null;
}

/**
 * Presentation attributes that INHERIT into children. When svgl sets these on
 * the root `<svg>` (e.g. Docker's blue `fill`, dark logos' white `fill`/`color`
 * that `currentColor` reads), stripping the root tag would drop them and the
 * body would render with the default black fill — so they're carried onto the
 * body's wrapping `<g>`.
 */
const ROOT_PAINT_ATTRS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "color",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-dasharray",
];

/** Inheritable paints set on the root `<svg>` tag, as `attr="value"` strings. */
function rootPaints(openTag: string): string {
  const paints = new Map<string, string>();
  for (const a of ROOT_PAINT_ATTRS) {
    const m = openTag.match(new RegExp(`\\s${a}="([^"]*)"`, "i"));
    if (m) paints.set(a, m[1]);
  }
  // Inline `style` wins over the presentation attribute, per CSS precedence.
  const style = openTag.match(/\sstyle="([^"]*)"/i)?.[1];
  if (style) {
    for (const seg of style.split(";")) {
      const i = seg.indexOf(":");
      if (i < 0) continue;
      const prop = seg.slice(0, i).trim().toLowerCase();
      const val = seg.slice(i + 1).trim();
      if (val && ROOT_PAINT_ATTRS.includes(prop)) paints.set(prop, val);
    }
  }
  return [...paints].map(([k, v]) => `${k}="${v}"`).join(" ");
}

function parseSvg(svg: string, name: string): BodyData {
  const open = svg.match(/<svg[^>]*>/i);
  if (!open) throw new Error("no <svg> tag");
  let body = svg.slice(svg.indexOf(open[0]) + open[0].length, svg.lastIndexOf("</svg>")).trim();
  if (!body) throw new Error("empty body");
  // `xlink:href` only resolves when the `xlink` namespace is declared, which the
  // consumers' wrapper `<svg>` doesn't carry — so gradient-template inheritance
  // (`<radialGradient xlink:href>`) and `<use>` silently break in a standalone
  // data-URL <img>. Rewrite to the plain SVG2 `href`, which needs no namespace.
  body = body.replaceAll("xlink:href", "href");
  // Consumers render the body in a `0 0 w h` viewBox, so a source viewBox with
  // a non-zero origin used to render offset/half-clipped. Shift it back here.
  const vb = open[0].match(/viewBox="([\d.\s,-]+)"/i)?.[1]?.split(/[\s,]+/).map(Number);
  const [minX, minY] = [vb?.[0] ?? 0, vb?.[1] ?? 0];
  const width = vb?.[2] ?? Number(open[0].match(/width="([\d.]+)"/i)?.[1] ?? 24);
  const height = vb?.[3] ?? Number(open[0].match(/height="([\d.]+)"/i)?.[1] ?? 24);
  // Carry inherited root paints and any origin shift onto one wrapping `<g>`.
  const paint = rootPaints(open[0]);
  const transform = minX || minY ? ` transform="translate(${-minX} ${-minY})"` : "";
  if (paint || transform) body = `<g${paint ? ` ${paint}` : ""}${transform}>${body}</g>`;
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
  const dark: Record<string, BodyData> = {};
  const failed: string[] = [];
  for (const name of names) {
    // Mono-only catalog entries (e.g. Google Docs — in simple-icons but not on
    // svgl) have no svgl slug; skip them so the fetch doesn't 404 and fail.
    if (!(name in SVGL_SLUGS)) continue;
    const slug = svglSlug(name);
    const svg = await fetchSvg(slug);
    if (!svg) {
      failed.push(`${name} (slug: ${slug})`);
      continue;
    }
    try {
      bodies[name] = parseSvg(svg, name);
    } catch (e) {
      failed.push(`${name} (slug: ${slug}) — ${(e as Error).message}`);
    }
    // Optional dark-theme variant. The light one is the default, so a missing
    // or malformed dark body is non-fatal — just skip it.
    const darkSlug = SVGL_DARK_SLUGS[name];
    if (darkSlug) {
      const dsvg = await fetchSvg(darkSlug);
      if (dsvg) {
        try {
          dark[name] = parseSvg(dsvg, `${name}_dark`);
        } catch {
          // Keep the light default; ignore a broken dark variant.
        }
      }
    }
  }
  if (failed.length) {
    throw new Error(`svgl logos failed to fetch: ${failed.join(", ")}`);
  }
  emit("colorLogoBodies.ts", "svgl.app", [
    `import type { IconBody } from "@/lib/export/elementSvg";`,
    ``,
    `export const COLOR_LOGO_BODIES: Record<string, IconBody> = ${JSON.stringify(bodies)};`,
  ]);
  emit("colorLogoDarkBodies.ts", "svgl.app (dark-theme variants)", [
    `import type { IconBody } from "@/lib/export/elementSvg";`,
    ``,
    `export const COLOR_LOGO_DARK_BODIES: Record<string, IconBody> = ${JSON.stringify(dark)};`,
  ]);
  emit("colorLogoDarkNames.ts", "svgl.app (dark-theme variants)", [
    `/** Catalog ids that ship a dark-theme color variant (light is the default). */`,
    `export const COLOR_LOGO_DARK_NAMES: string[] = ${JSON.stringify(Object.keys(dark))};`,
  ]);
  console.log(`  ${Object.keys(bodies).length} color logos from svgl (${Object.keys(dark).length} with dark variant)`);
}

const logoNames = (generatePhosphor(), generateMonoLogos());
await generateColorLogos(logoNames);
console.log("done");
