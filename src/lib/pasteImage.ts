/**
 * Bringing outside images into the document — from a file picker, or pasted
 * from the system clipboard.
 *
 * The clipboard hands us two genuinely different payloads for a "logo":
 *
 *   - a FILE (copying a .png/.svg in the file manager, or "Copy image" on a web
 *     page) arrives in `DataTransfer.files` / `.items`;
 *   - SVG SOURCE TEXT (svgl.app's "copy SVG" button and friends) arrives only as
 *     `text/plain`, with no file attached at all.
 *
 * Both are supported and converge on the same path: anything SVG-shaped becomes
 * a sanitized `image/svg+xml` File and goes through {@link importImageFile} with
 * the uploads, so there is one import pipeline rather than two.
 *
 * Note that "Copy image" on an SVG *rendered in a page* usually puts a PNG
 * bitmap on the clipboard — the browser rasterizes it — so vector round-trips
 * need the site's copy-source button or the .svg file itself.
 */

import { importImageFile } from "@/lib/importImage";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { notify } from "@/store/toastStore";

/** Leading `<svg`, allowing an XML prolog, comments, and a DOCTYPE first. */
const SVG_START =
  /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

/**
 * Parse, validate and defang SVG source, returning serialized markup or null if
 * it isn't really an SVG.
 *
 * Pasted markup is untrusted input from an arbitrary source. It only ever
 * renders inside an `<img>`/canvas — a passive context where scripts don't run
 * and external refs don't load — but it is stripped anyway so it stays safe if
 * it's ever inlined, and so a pasted logo can't quietly phone home. Remote
 * references are dropped rather than kept, since the app is offline at runtime
 * and they'd render as blanks regardless.
 */
export function sanitizeSvgSource(source: string): string | null {
  if (!SVG_START.test(source)) return null;
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return null;
  const root = parsed.documentElement;
  if (!root || root.localName.toLowerCase() !== "svg") return null;

  root.querySelectorAll("script, foreignObject, animate, set").forEach((n) => n.remove());

  const walker = parsed.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [root];
  while (walker.nextNode()) elements.push(walker.currentNode as Element);
  for (const el of elements) {
    // Snapshot: removing attributes mutates the live NamedNodeMap mid-loop.
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      // Event handlers, and any reference that isn't same-document or inline.
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (
        (name === "href" || name === "xlink:href" || name === "src") &&
        !/^(#|data:image\/)/i.test(value)
      ) {
        el.removeAttribute(attr.name);
      } else if (/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  // The importer sizes an SVG by decoding it, which needs real intrinsic
  // dimensions — plenty of icon sets ship a viewBox only, which would otherwise
  // decode at the browser's 300x150 default and paste at the wrong aspect.
  const px = (name: string): number => {
    const raw = root.getAttribute(name);
    if (!raw || raw.includes("%")) return 0;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  if (!px("width") || !px("height")) {
    const vb = root
      .getAttribute("viewBox")
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    const [vw, vh] = vb && vb.length === 4 ? [vb[2], vb[3]] : [0, 0];
    root.setAttribute("width", String(vw > 0 ? vw : 300));
    root.setAttribute("height", String(vh > 0 ? vh : 300));
  }
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  return new XMLSerializer().serializeToString(root);
}

/** Wrap SVG source text as a File so it joins the normal import pipeline. */
export function svgTextToFile(text: string, name = "Pasted.svg"): File | null {
  const clean = sanitizeSvgSource(text);
  return clean ? new File([clean], name, { type: "image/svg+xml" }) : null;
}

/**
 * Image files on a paste/drop, falling back to SVG source text. Files win when
 * both are present: a real bitmap beats a stray text/plain alternative.
 */
export function pastedImageFiles(dt: DataTransfer): File[] {
  const fromFiles = Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"));
  if (fromFiles.length) return fromFiles;

  // Web-page "Copy image" often exposes the bitmap only through `items`.
  const fromItems = Array.from(dt.items ?? [])
    .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
    .map((i) => i.getAsFile())
    .filter((f): f is File => f != null);
  if (fromItems.length) return fromItems;

  const svg = svgTextToFile(dt.getData("text/plain") || "");
  return svg ? [svg] : [];
}

/** Re-wrap an SVG file through the sanitizer; other types pass through. */
async function normalizeSvg(file: File): Promise<File> {
  if (file.type !== "image/svg+xml") return file;
  const clean = svgTextToFile(await file.text(), file.name);
  if (!clean) throw new Error("Not a valid SVG");
  return clean;
}

/**
 * Import files as image elements, selecting the last one. Shared by the upload
 * button and clipboard paste so both downscale, sanitize and name identically.
 */
export async function addImageFiles(files: File[]): Promise<void> {
  const { addImage } = useDocumentStore.getState();
  const { select } = useSelectionStore.getState();
  for (const file of files) {
    try {
      const { dataUrl, width, height, scaled } = await importImageFile(await normalizeSvg(file));
      select(addImage(dataUrl, width, height));
      if (scaled) notify.info("Image resized to 1024px for performance");
    } catch (err) {
      notify.error(
        `Couldn't load ${file.name}`,
        err instanceof Error ? err.message : undefined,
      );
    }
  }
}
