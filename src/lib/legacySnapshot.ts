/**
 * Migration from legacy gallery snapshots (public/legacy.html `saveToGallery`
 * L982 / `loadFromGallery` L986-989) into a typed {@link FolderDocument}:
 * numeric element ids → `el<N>` strings (id counter reseeded), missing base
 * fields filled, flat `hue/sat/bri` + `gradStops/gradType/gradAngle` →
 * `folderColor`, legacy `{_g, type}` gradients → `{kind}`, per-type field
 * renames (fillColor → fill.color, textColor → color, …).
 *
 * New-format snapshots (already `FolderDocument`-shaped, detected by the
 * presence of `folderColor`) pass through with ids reseeded.
 */

import { getHex } from "./color";
import { createEmptyDocument, type FolderDocument } from "@/types/document";
import type {
  DrawElement,
  DropShadow,
  FolderElement,
  IconElement,
  ImageElement,
  ShapeElement,
  TextElement,
} from "@/types/element";
import type { ColorValue, Gradient, GradientStop } from "@/types/gradient";
import { maxIdSuffix, reseedIds } from "./id";
import { notify } from "@/store/toastStore";
import { PATTERN_CATALOG } from "@/data/patterns";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Legacy = Record<string, any>;

function normalizeStops(stops: unknown): GradientStop[] {
  if (!Array.isArray(stops)) return [];
  return stops.map((s: Legacy, i) => ({
    id: String(s.id ?? i),
    pos: Number(s.pos) || 0,
    hue: Number(s.hue) || 0,
    sat: Number(s.sat) || 0,
    bri: Number(s.bri) || 0,
  }));
}

/** Legacy color: hex string or `{_g, type, angle, stops}` gradient object. */
function normalizeColor(value: unknown, fallback: string): ColorValue {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && (value as Legacy)._g) {
    const g = value as Legacy;
    const grad: Gradient = {
      kind: g.type === "radial" ? "radial" : "linear",
      angle: Number(g.angle) || 90,
      stops: normalizeStops(g.stops),
    };
    if (grad.stops.length >= 2) return grad;
  }
  return fallback;
}

function normalizeShadow(value: unknown): DropShadow | undefined {
  if (!value || typeof value !== "object") return undefined;
  const s = value as Legacy;
  return {
    x: Number(s.x) || 0,
    y: Number(s.y) || 0,
    blur: Number(s.blur) || 0,
    color: typeof s.color === "string" ? s.color : "#000000",
    opacity: s.opacity == null ? 1 : Number(s.opacity),
  };
}

function base(e: Legacy) {
  return {
    id: `el${e.id}`.replace(/^elel/, "el"),
    x: Number(e.x) || 0,
    y: Number(e.y) || 0,
    width: Number(e.width) || 20,
    height: Number(e.height) || 20,
    rotation: Number(e.rotation) || 0,
    opacity: e.opacity == null ? 1 : Number(e.opacity),
    visible: e.visible !== false,
    locked: e.locked === true,
    scaleX: Number(e.scaleX) || 1,
    scaleY: Number(e.scaleY) || 1,
  };
}

function normalizeElement(e: Legacy, index: number): FolderElement | null {
  const common = base(e);
  if (e.type === "shape") {
    const el: ShapeElement = {
      ...common,
      type: "shape",
      name: typeof e.name === "string" ? e.name : `Shape ${index + 1}`,
      shapeType: e.shapeType ?? "rect",
      fill: {
        color: normalizeColor(e.fillColor, "#8cf0a8"),
        enabled: e.fillEnabled !== false,
      },
      stroke: {
        color: typeof e.strokeColor === "string" ? e.strokeColor : "#000000",
        enabled: e.strokeEnabled === true,
        width: Number(e.strokeWidth) || 3,
        position: e.strokePosition ?? "center",
      },
      borderRadius: Number(e.borderRadius) || 0,
      dropShadow: normalizeShadow(e.dropShadow),
    };
    return el;
  }
  if (e.type === "text") {
    const el: TextElement = {
      ...common,
      type: "text",
      name: typeof e.name === "string" ? e.name : "Text",
      text: typeof e.text === "string" ? e.text : "Text",
      fontFamily: e.fontFamily ?? "Space Grotesk",
      fontSize: Number(e.fontSize) || 18,
      fontWeight: String(e.fontWeight ?? "600"),
      fontStyle: e.fontStyle === "italic" ? "italic" : "normal",
      color: normalizeColor(e.textColor, "#ffffff"),
      align: e.textAlign ?? "center",
      letterSpacing: Number(e.letterSpacing) || 0,
      lineHeight: Number(e.lineHeight) || 1.3,
      underline: e.underline === true,
      stroke:
        Number(e.strokeWidth) > 0
          ? {
            color: typeof e.strokeColor === "string" ? e.strokeColor : "#000000",
            width: Number(e.strokeWidth),
            position: e.strokePosition ?? "outside",
          }
          : undefined,
      shadow: normalizeShadow(e.shadow),
    };
    return el;
  }
  if (e.type === "image") {
    if (typeof e.src !== "string") return null;
    const el: ImageElement = {
      ...common,
      type: "image",
      name: typeof e.name === "string" ? e.name : "Image",
      src: e.src,
      blendMode: e.blendMode ?? undefined,
      stroke: e.strokeEnabled
        ? {
          color: typeof e.strokeColor === "string" ? e.strokeColor : "#000000",
          enabled: true,
          width: Number(e.strokeWidth) || 2,
        }
        : undefined,
      dropShadow: normalizeShadow(e.dropShadow),
    };
    return el;
  }
  if (e.type === "icon") {
    if (typeof e.iconName !== "string") return null;
    const el: IconElement = {
      ...common,
      type: "icon",
      name: typeof e.name === "string" ? e.name : e.iconName,
      iconName: e.iconName,
      iconVariant: e.iconVariant ?? "regular",
      iconCacheKey: e.iconCacheKey ?? e.iconName,
      color: normalizeColor(e.iconColor, "#ffffff"),
      dropShadow: normalizeShadow(e.dropShadow),
    };
    return el;
  }
  if (e.type === "draw") {
    if (typeof e.svgPath !== "string") return null;
    const el: DrawElement = {
      ...common,
      type: "draw",
      name: typeof e.name === "string" ? e.name : `Drawing ${index + 1}`,
      svgPath: e.svgPath,
      origWidth: Number(e.origWidth) || common.width,
      origHeight: Number(e.origHeight) || common.height,
      stroke: {
        color: normalizeColor(e.strokeColor, "#ffffff"),
        size: Number(e.strokeSize) || 4,
        linecap: e.linecap ?? "round",
      },
    };
    return el;
  }
  return null;
}

/**
 * Snapshots predate the Hero Patterns rework, so they can name one of the 33
 * retired hand-written motifs (`"dots"`, `"stars"`, …). Those ids resolve to no
 * body — the folder would render pattern-less while the panel showed a motif
 * that isn't in the picker — so anything unknown falls back to "none".
 */
function normalizePatternId(id: unknown): string {
  if (typeof id !== "string" || !id || id === "none") return "none";
  return PATTERN_CATALOG.some((p) => p.key === id) ? id : "none";
}

function isNewFormat(snap: Legacy): boolean {
  return "folderColor" in snap && Array.isArray(snap.elements);
}

/** The field each element type cannot render without. */
const REQUIRED_BY_TYPE: Record<string, string> = {
  shape: "shapeType",
  text: "text",
  image: "src",
  icon: "iconName",
  draw: "svgPath",
};

/**
 * Sanity-check one already-`FolderDocument`-shaped element. A hand-edited or
 * truncated snapshot could otherwise load an element missing `fontSize`/`src`
 * and render blank or throw mid-paint; those are dropped instead.
 *
 * Deliberately shallow — it checks the geometry numbers everything reads plus
 * the one field the element's renderer dereferences, not the full shape.
 * ponytail: hand-rolled check, swap for a schema lib only if the format grows.
 */
function isValidElement(e: unknown): e is FolderElement {
  if (!e || typeof e !== "object") return false;
  const el = e as Legacy;
  if (typeof el.id !== "string" || !el.id) return false;
  const required = REQUIRED_BY_TYPE[el.type];
  if (!required || typeof el[required] !== "string") return false;
  if (el.type === "text" && !Number.isFinite(el.fontSize)) return false;
  return (["x", "y", "width", "height"] as const).every((k) => Number.isFinite(el[k]));
}

export function normalizeLegacySnapshot(legacy: unknown): FolderDocument {
  const doc = createEmptyDocument();
  if (!legacy || typeof legacy !== "object") return doc;
  const sn = legacy as Legacy;

  if (isNewFormat(sn)) {
    const snap = sn as Partial<FolderDocument>;
    // Deep-merge nested objects so a future field added to `iconDefaults` loads
    // its default instead of `undefined` on an older snapshot (ST-08).
    // `pattern` is deep-merged so a snapshot predating a field (or the whole
    // Hero Patterns rework) loads that field's default instead of `undefined`.
    // Elements are validated individually — the legacy path already did this,
    // but new-format snapshots used to pass straight through, so one corrupt
    // element could blank or crash the whole design instead of being skipped.
    const elements = (snap.elements ?? []).filter(isValidElement);
    const dropped = (snap.elements ?? []).length - elements.length;
    if (dropped > 0) {
      notify.error(
        `${dropped} element${dropped === 1 ? "" : "s"} couldn't be loaded`,
        "They were missing required fields and have been skipped; the rest of the design loaded normally.",
      );
    }
    const merged: FolderDocument = {
      ...doc,
      ...snap,
      elements,
      // The image-span default flipped to "front"; a snapshot predating the
      // field was authored as full-span, so pin it rather than restyling it.
      windowsImageMode: snap.windowsImageMode ?? "full",
      macImageMode: snap.macImageMode ?? "full",
      material: { ...doc.material, ...snap.material },
      pattern: {
        ...doc.pattern,
        ...snap.pattern,
        id: normalizePatternId(snap.pattern?.id),
      },
      patternLayerZ: Number(snap.patternLayerZ ?? sn.textureLayerZ ?? 0),
      iconDefaults: { ...doc.iconDefaults, ...snap.iconDefaults },
      v: doc.v,
    };
    // The pre-rework `texture` object would otherwise ride `...snap` onto the
    // live document and back into the next save; its motif ids are long gone.
    delete (merged as Partial<Record<"texture", unknown>>).texture;
    reseedIds(maxIdSuffix(merged.elements.map((e) => e.id)));
    return merged;
  }

  doc.baseShape = typeof sn.baseShape === "string" ? sn.baseShape : "classic";
  doc.folderFillMode = "color";
  if (sn.colorMode === "gradient") {
    const stops = normalizeStops(
      sn.gradStops ?? [
        { id: 0, pos: 0, hue: sn.gH1 ?? 200, sat: sn.gS1 ?? 0.8, bri: sn.gB1 ?? 0.9 },
        { id: 1, pos: 1, hue: sn.gH2 ?? 160, sat: sn.gS2 ?? 0.6, bri: sn.gB2 ?? 0.7 },
      ],
    );
    doc.folderColor = {
      kind: sn.gradType === "radial" ? "radial" : "linear",
      angle: Number(sn.gradAngle ?? 180),
      stops,
    };
  } else {
    doc.folderColor = getHex(
      Number(sn.hue ?? 45),
      Number(sn.sat ?? 0.85),
      Number(sn.bri ?? 0.96),
    );
  }

  doc.iconDefaults = {
    stroke: Number(sn.iconStroke ?? 1.5),
    color: normalizeColor(sn.iconColor, "#ffffff"),
  };

  const rawElements: Legacy[] = Array.isArray(sn.elements) ? sn.elements : [];
  doc.elements = rawElements
    .map((e, i) => normalizeElement(e, i))
    .filter((e): e is FolderElement => e !== null);
  if (doc.elements.length < rawElements.length) {
    const dropped = rawElements.length - doc.elements.length;
    notify.error(
      `${dropped} element${dropped === 1 ? "" : "s"} couldn't be loaded`,
      "They were missing required fields and have been skipped; the rest of the design loaded normally.",
    );
  }
  // Legacy snapshots don't persist patternLayerZ; default to bottom-of-stack.
  doc.patternLayerZ = 0;

  reseedIds(maxIdSuffix(doc.elements.map((e) => e.id)));
  return doc;
}
