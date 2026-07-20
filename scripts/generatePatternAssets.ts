/**
 * Bakes the Hero Patterns motifs listed in `src/data/patterns.ts` into
 * `src/data/generated/patternBodies.ts` — checked in, lazily imported so the
 * app stays offline at runtime. Re-run after editing the catalog:
 *
 *   npm run generate:patterns
 *
 * Source: the `hero-patterns` npm package via jsDelivr (network at generation
 * time only), same arrangement as the thesvg color logos.
 *
 * Each upstream export is a function `(color, opacity) => "url('data:…')"` with
 * exactly one parameterised `fill` and one `fill-opacity`. We call it with
 * sentinels and swap those for `{{FG}}` / `{{FGO}}` placeholders, so the runtime
 * can recolor without re-parsing SVG. The script FAILS if a name doesn't
 * resolve, or if a tile turns out to carry a second hardcoded fill (which the
 * single-color model couldn't express).
 *
 * Hero Patterns © Steve Schoger, CC BY 4.0.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { PATTERN_CATALOG } from "../src/data/patterns";

const HERO_VERSION = "2.1.0";
const HERO_CDN = `https://cdn.jsdelivr.net/npm/hero-patterns@${HERO_VERSION}/dist/hero-patterns.es.js`;

/** Sentinels chosen so they can't collide with anything in the path data. */
const FG_SENTINEL = "#abcdef";
const FGO_SENTINEL = "0.123456";

/**
 * Tiles range from 8×8 to 600×600 upstream — a 75× spread — so a single global
 * scale is meaningless: at 1.0 an 8px tile repeats ~25× across the 305-unit
 * content rect while a 600px one shows a third of a repeat. Each pattern gets a
 * baked default that lands it in a legible band, which the panel's scale slider
 * then multiplies.
 */
const MAX_TILE = 110;
const MIN_TILE = 20;

function defaultScale(w: number, h: number): number {
  const long = Math.max(w, h);
  if (long > MAX_TILE) return round(MAX_TILE / long);
  if (long < MIN_TILE) return round(MIN_TILE / long);
  return 1;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "generated");
mkdirSync(outDir, { recursive: true });

interface PatternBody {
  /** Tile SVG with `{{FG}}` / `{{FGO}}` placeholders. */
  svg: string;
  w: number;
  h: number;
  defaultScale: number;
}

/** Pull the raw SVG out of the `url('data:image/svg+xml,…')` the package returns. */
function decodeCss(css: string): string {
  const start = css.indexOf("svg+xml,");
  if (start < 0) throw new Error(`unexpected hero-patterns output: ${css.slice(0, 80)}`);
  return decodeURIComponent(css.slice(start + 8).replace(/'\)$/, ""));
}

async function main(): Promise<void> {
  // Node's ESM loader won't import an https: specifier, and the module is far
  // too big for a data: URL — so stage it in a temp file and import that. The
  // package never lands in node_modules; the artwork is baked in below.
  const res = await fetch(HERO_CDN);
  if (!res.ok) throw new Error(`fetching hero-patterns failed: ${res.status} ${res.statusText}`);
  const staged = join(tmpdir(), `hero-patterns-${HERO_VERSION}.mjs`);
  writeFileSync(staged, await res.text());
  let mod: Record<string, ((color: string, opacity: number) => string) | undefined>;
  try {
    mod = (await import(pathToFileURL(staged).href)) as typeof mod;
  } finally {
    rmSync(staged, { force: true });
  }

  const bodies: Record<string, PatternBody> = {};
  const missing: string[] = [];
  const multiFill: string[] = [];

  for (const { key, name } of PATTERN_CATALOG) {
    const fn = mod[key];
    if (typeof fn !== "function") {
      missing.push(`${name} (${key})`);
      continue;
    }
    const raw = decodeCss(fn(FG_SENTINEL, Number(FGO_SENTINEL)));

    const w = Number(/width="([\d.]+)"/.exec(raw)?.[1]);
    const h = Number(/height="([\d.]+)"/.exec(raw)?.[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || !w || !h) {
      throw new Error(`${name}: could not read tile size`);
    }

    // Every fill must be either the sentinel or "none"; a hardcoded second color
    // would silently ignore the user's foreground pick.
    const fills = [...raw.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);
    const stray = [...new Set(fills)].filter(
      (f) => f.toLowerCase() !== FG_SENTINEL && f !== "none",
    );
    if (stray.length) multiFill.push(`${name}: ${stray.join(", ")}`);

    const svg = raw
      .split(FG_SENTINEL).join("{{FG}}")
      .split(FGO_SENTINEL).join("{{FGO}}");
    if (!svg.includes("{{FG}}")) throw new Error(`${name}: foreground color not parameterised`);

    bodies[key] = { svg, w, h, defaultScale: defaultScale(w, h) };
  }

  if (missing.length) {
    throw new Error(`hero-patterns has no export for:\n  ${missing.join("\n  ")}`);
  }
  if (multiFill.length) {
    throw new Error(
      `these tiles carry a hardcoded fill the single-color model can't express:\n  ${multiFill.join("\n  ")}`,
    );
  }

  const entries = Object.entries(bodies)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");

  writeFileSync(
    join(outDir, "patternBodies.ts"),
    `/**
 * GENERATED FILE — do not edit. Rebuild with \`npm run generate:patterns\`.
 * Source: hero-patterns@${HERO_VERSION} (© Steve Schoger, CC BY 4.0).
 */

/* eslint-disable */

export interface PatternBody {
  /** Tile SVG; \`{{FG}}\` / \`{{FGO}}\` stand in for the foreground color/opacity. */
  svg: string;
  w: number;
  h: number;
  /** Baked per-pattern scale normalising the tile to a legible repeat count. */
  defaultScale: number;
}

export const PATTERN_BODIES: Record<string, PatternBody> = {
${entries}
};
`,
  );

  const scaled = Object.entries(bodies).filter(([, v]) => v.defaultScale !== 1);
  console.log(`wrote src/data/generated/patternBodies.ts (${Object.keys(bodies).length} patterns)`);
  console.log(`rescaled ${scaled.length}: ${scaled.map(([k, v]) => `${k}@${v.defaultScale}`).join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
