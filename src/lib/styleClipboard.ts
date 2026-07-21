/**
 * "Copy style / Paste style" — Figma-style transfer of an element's appearance
 * (color, shadows, stroke, typography, material, opacity) onto other elements,
 * leaving position/size/rotation/content untouched. Module-scoped, ephemeral
 * buffer like `clipboard.ts`.
 *
 * Same-type paste replaces the full style key set (a missing key on the source
 * clears it on the target, matching Figma's "replace appearance"). Cross-type
 * paste maps only the properties that generalise — opacity, material, primary
 * color, outer shadow, inner shadow — since stroke/typography have no
 * cross-type meaning.
 */

import type { DropShadow, ElementType, FolderElement } from "@/types/element";
import type { ColorValue } from "@/types/gradient";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";

/** Full style keys per type, for high-fidelity same-type paste. */
const STYLE_KEYS: Record<ElementType, string[]> = {
  shape: ["opacity", "material", "fill", "stroke", "borderRadius", "dropShadow", "innerShadow"],
  text: [
    "opacity", "material", "color", "fontFamily", "fontSize", "fontWeight",
    "fontStyle", "align", "letterSpacing", "lineHeight", "underline", "clip",
    "stroke", "shadow", "innerShadow",
  ],
  image: ["opacity", "material", "blendMode", "stroke", "dropShadow"],
  icon: ["opacity", "material", "color", "dropShadow", "innerShadow"],
  draw: ["opacity", "material", "stroke"],
};

let styleClip: FolderElement | null = null;

export function hasStyleClipboard(): boolean {
  return styleClip !== null;
}

/** Stash one element's style (source stays untouched). */
export function copyElementStyle(el: FolderElement): void {
  styleClip = structuredClone(el);
}

/** The element's primary fill/tint color, or undefined (images have none). */
function primaryColor(el: FolderElement): ColorValue | undefined {
  if (el.type === "shape") return el.fill.color;
  if (el.type === "text" || el.type === "icon") return el.color;
  if (el.type === "draw") return el.stroke.color;
  return undefined;
}

/** The element's outer shadow (text calls it `shadow`; others `dropShadow`). */
function outerShadow(el: FolderElement): DropShadow | undefined {
  if (el.type === "text") return el.shadow;
  if (el.type === "shape" || el.type === "icon" || el.type === "image") return el.dropShadow;
  return undefined;
}

function innerShadow(el: FolderElement): DropShadow | undefined {
  if (el.type === "shape" || el.type === "text" || el.type === "icon") return el.innerShadow;
  return undefined;
}

/** Patch mapping the canonical style onto `target`, for cross-type paste. */
function crossTypePatch(target: FolderElement, src: FolderElement): Partial<FolderElement> {
  const patch: Record<string, unknown> = { opacity: src.opacity, material: src.material };

  const color = primaryColor(src);
  if (color !== undefined) {
    if (target.type === "shape") patch.fill = { ...target.fill, color };
    else if (target.type === "text" || target.type === "icon") patch.color = color;
    else if (target.type === "draw") patch.stroke = { ...target.stroke, color };
  }

  const outer = outerShadow(src);
  if (target.type === "text") patch.shadow = outer;
  else if (target.type === "shape" || target.type === "icon" || target.type === "image")
    patch.dropShadow = outer;

  if (target.type === "shape" || target.type === "text" || target.type === "icon")
    patch.innerShadow = innerShadow(src);

  return patch as Partial<FolderElement>;
}

/** Build the paste patch for one target given the copied source. */
function stylePatch(target: FolderElement, src: FolderElement): Partial<FolderElement> {
  if (target.type === src.type) {
    // Same type: replace the whole style key set (undefined clears a key).
    const patch: Record<string, unknown> = {};
    for (const k of STYLE_KEYS[target.type]) patch[k] = (src as Record<string, unknown>)[k];
    return patch as Partial<FolderElement>;
  }
  return crossTypePatch(target, src);
}

/** Apply the copied style to every selected element (one undo entry). */
export function pasteElementStyle(): void {
  if (!styleClip) return;
  const src = styleClip;
  const elements = useDocumentStore.getState().doc.elements;
  const selected = new Set(useSelectionStore.getState().selectedIds);
  const patches: Record<string, Partial<FolderElement>> = {};
  for (const el of elements) {
    if (selected.has(el.id) && el.id !== src.id) patches[el.id] = stylePatch(el, src);
  }
  if (Object.keys(patches).length) useDocumentStore.getState().updateElements(patches);
}

/** Test-only reset. */
export function __resetStyleClipboardForTests(): void {
  styleClip = null;
}
