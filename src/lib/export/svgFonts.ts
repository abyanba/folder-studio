/**
 * Browser-only font inlining for the true SVG export (EXP-14). Reads the loaded
 * `@font-face` rules for the families a design's text actually uses and rewrites
 * their `src` to a base64 data URL, so the exported SVG renders with the right
 * typeface on any machine — no network, self-contained.
 *
 * Best-effort: any failure (unreadable cross-origin sheet, fetch error) is
 * swallowed and that face is skipped — the text then falls back to the family
 * name, which still renders. Not unit-tested (needs real stylesheets + fetch);
 * verified in Chrome via the export harness.
 */

import type { FolderDocument } from "@/types/document";
import { pickFace } from "./fontMatch";
import type { FaceDescriptor } from "./fontMatch";

interface FaceKey {
  family: string;
  weight: string;
  style: string;
}

/** The (family, weight, style) triples used by a document's text elements. */
function usedFaces(doc: FolderDocument): FaceKey[] {
  const seen = new Map<string, FaceKey>();
  for (const el of doc.elements) {
    if (el.type !== "text") continue;
    const key: FaceKey = {
      family: el.fontFamily,
      weight: String(el.fontWeight),
      style: el.fontStyle || "normal",
    };
    seen.set(`${key.family}|${key.weight}|${key.style}`, key);
  }
  return [...seen.values()];
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}

/** A font-face rule's declared descriptors. */
function descriptorOf(rule: CSSFontFaceRule): FaceDescriptor {
  const s = rule.style;
  return {
    family: stripQuotes(s.getPropertyValue("font-family")),
    weight: s.getPropertyValue("font-weight").trim() || "400",
    style: s.getPropertyValue("font-style").trim() || "normal",
  };
}

/** Extract the first `url(...)` from a font-face `src` descriptor. */
function firstUrl(src: string): string | null {
  const m = src.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/);
  return m ? m[2] : null;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:font/woff2;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/** Build embeddable `@font-face` CSS (data-URL src) for a document's text fonts. */
export async function collectFontFaceCss(doc: FolderDocument): Promise<string> {
  const faces = usedFaces(doc);
  if (!faces.length) return "";

  // Every readable @font-face rule in the document, then the nearest one per
  // wanted face. Collecting first (rather than matching inside the loop) is
  // what lets the choice be "closest available" instead of "exact or nothing".
  const available: Array<FaceDescriptor & { rule: CSSFontFaceRule }> = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet — unreadable
    }
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name !== "CSSFontFaceRule") continue;
      const fr = rule as CSSFontFaceRule;
      available.push({ ...descriptorOf(fr), rule: fr });
    }
  }

  const wanted: Array<{ face: FaceDescriptor; rule: CSSFontFaceRule }> = [];
  for (const face of faces) {
    const hit = pickFace(available, face);
    // Keyed on the RULE: two weights of one family that resolve to the same
    // single available face must not embed it twice.
    if (hit && !wanted.some((w) => w.rule === hit.rule)) {
      // The face is declared with its REAL descriptors, not the requested
      // ones, so the SVG viewer performs the same nearest-weight match (and
      // any synthetic bolding) the editor and the canvas export already do.
      wanted.push({ face: { family: hit.family, weight: hit.weight, style: hit.style }, rule: hit.rule });
    }
  }

  const blocks = await Promise.all(
    wanted.map(async ({ face, rule }) => {
      const url = firstUrl(rule.style.getPropertyValue("src"));
      if (!url) return "";
      const dataUrl = await toDataUrl(new URL(url, location.href).href);
      if (!dataUrl) return "";
      return `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};src:url(${dataUrl}) format("woff2");}`;
    }),
  );
  return blocks.filter(Boolean).join("");
}
