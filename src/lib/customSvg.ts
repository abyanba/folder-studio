/**
 * Ingest pasted SVG source into a custom library asset (icons/logos panels).
 *
 * Builds on the existing {@link sanitizeSvgSource} (scripts, event handlers and
 * external refs are already stripped there), then:
 *   - detects whether the art is monochrome (tintable) or full-color,
 *   - for the tintable path, rewrites every paint to `currentColor` so it takes
 *     the tint chosen at placement, and namespaces internal ids so inlined
 *     gradients can't collide with another asset's,
 *   - reports intrinsic width/height (the sanitizer guarantees them).
 *
 * Tintable bodies feed the icon-body cache (like a mono logo); full-color art
 * becomes a self-contained `image/svg+xml` data URL (like a color logo).
 */

import { sanitizeSvgSource } from "@/lib/pasteImage";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

export interface IngestedSvg {
  /** Detected nature; the caller may override mono→color intent, not the art. */
  detected: "mono" | "color";
  /** Inner markup with paints forced to `currentColor` + ids namespaced (tintable). */
  monoBody: string;
  /** Full sanitized `<svg>…</svg>` as a data URL (full-color path). */
  colorSrc: string;
  width: number;
  height: number;
}

const COLOR_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "lighting-color"];

/** A paint value that actually carries color (not none/transparent/currentColor). */
function isRealColor(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "none" && s !== "transparent" && s !== "currentcolor";
}

/**
 * The coordinate box the body is drawn in. The viewBox wins over width/height:
 * those are only a display size, and rendering a `0 0 256 256` icon inside a
 * `68×68` viewBox (Phosphor's non-raw copy) would clip and offset it. minX/minY
 * are carried so a non-zero-origin viewBox can be shifted back to the origin.
 */
function readViewport(root: SVGElement): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  const num = (v: string | null) => {
    const n = v ? Number.parseFloat(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const vb = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    return { width: vb[2], height: vb[3], minX: vb[0] || 0, minY: vb[1] || 0 };
  }
  return {
    width: num(root.getAttribute("width")) || 24,
    height: num(root.getAttribute("height")) || 24,
    minX: 0,
    minY: 0,
  };
}

/** Shapes whose default fill is black — made tintable when they carry no paint. */
const FILLABLE = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline"]);

/** Parse, detect, and produce both a tintable body and a color data URL. */
export function ingestSvg(source: string): IngestedSvg | null {
  const clean = sanitizeSvgSource(source);
  if (!clean) return null;
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const root = doc.documentElement as unknown as SVGElement;
  if (doc.querySelector("parsererror") || root.localName.toLowerCase() !== "svg") return null;

  const { width, height, minX, minY } = readViewport(root);

  // --- detect mono vs color -------------------------------------------------
  const colors = new Set<string>();
  let complex = false;
  const all = root.querySelectorAll("*");
  const scan = (el: Element) => {
    if (/^(linearGradient|radialGradient|image|pattern)$/i.test(el.localName)) complex = true;
    for (const attr of COLOR_ATTRS) {
      const v = el.getAttribute(attr);
      if (v && isRealColor(v)) {
        if (/url\(/i.test(v)) complex = true;
        else colors.add(v.trim().toLowerCase());
      }
    }
    const style = el.getAttribute("style");
    if (style) {
      for (const m of style.matchAll(/(fill|stroke|stop-color)\s*:\s*([^;]+)/gi)) {
        if (isRealColor(m[2])) {
          if (/url\(/i.test(m[2])) complex = true;
          else colors.add(m[2].trim().toLowerCase());
        }
      }
    }
  };
  scan(root);
  all.forEach(scan);
  const detected: "mono" | "color" = complex || colors.size > 1 ? "color" : "mono";

  // --- tintable body: force every paint to currentColor, namespace ids ------
  const mono = doc.cloneNode(true) as Document;
  const monoRoot = mono.documentElement as unknown as SVGElement;
  const uid = `c${Math.random().toString(36).slice(2, 8)}`;
  const forcePaint = (el: Element) => {
    // Flatten ALL paint to currentColor — including gradient/pattern refs
    // (`fill="url(#…)"`). Keeping a gradient would leave the "tintable" body
    // uncolorable AND duplicate its <defs> ids in the DOM (canvas + panel tile),
    // which misrenders the logo whenever its library tile is on screen.
    for (const attr of COLOR_ATTRS) {
      const v = el.getAttribute(attr);
      if (v && isRealColor(v)) el.setAttribute(attr, "currentColor");
    }
    const style = el.getAttribute("style");
    if (style) {
      el.setAttribute(
        "style",
        style.replace(
          /(fill|stroke|stop-color)\s*:\s*([^;]+)/gi,
          (whole, prop, val) => (isRealColor(val) ? `${prop}:currentColor` : whole),
        ),
      );
    }
    // A fillable shape with no fill of its own defaults to solid black — make it
    // currentColor so it tints (Phosphor's "fill" variant, raw simple-icons, and
    // duotone's faded layer all rely on this default fill).
    if (
      FILLABLE.has(el.localName.toLowerCase()) &&
      !el.hasAttribute("fill") &&
      !/(?:^|[;\s])fill\s*:/i.test(el.getAttribute("style") ?? "")
    ) {
      el.setAttribute("fill", "currentColor");
    }
    const id = el.getAttribute("id");
    if (id) el.setAttribute("id", `${uid}_${id}`);
  };
  forcePaint(monoRoot);
  monoRoot.querySelectorAll("*").forEach(forcePaint);
  // Gradients are now unreferenced (all paint is currentColor) — drop them, and
  // any <defs> they leave empty, so no stray ids survive to collide.
  monoRoot.querySelectorAll("linearGradient, radialGradient").forEach((n) => n.remove());
  monoRoot.querySelectorAll("defs").forEach((d) => {
    if (!d.childElementCount) d.remove();
  });
  // Re-point any references to the namespaced ids.
  let monoBody = monoRoot.innerHTML;
  for (const m of clean.matchAll(/\sid="([^"]+)"/g)) {
    monoBody = monoBody
      .replaceAll(`url(#${m[1]})`, `url(#${uid}_${m[1]})`)
      .replaceAll(`href="#${m[1]}"`, `href="#${uid}_${m[1]}"`);
  }

  // Consumers render the body in a `0 0 width height` viewBox, so shift a
  // non-zero-origin viewBox back to the origin (the color path keeps the full
  // <svg> with its own viewBox, so it needs no shift).
  if (minX || minY) monoBody = `<g transform="translate(${-minX} ${-minY})">${monoBody}</g>`;

  return { detected, monoBody, colorSrc: toSvgDataUrl(clean), width, height };
}
