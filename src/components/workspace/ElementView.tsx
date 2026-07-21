/**
 * Renders one folder element as DOM inside the workspace content rect. For
 * icon/shape/draw it injects the *same* SVG string the Phase-3 `elementSvg`
 * builders produce (via `dangerouslySetInnerHTML`) so the editor and the export
 * canvas share one code path — no divergent second renderer. Text stays bespoke
 * (contentEditable + CSS), since the canvas draws it with `fillText` instead.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { hexA, textGradientCss } from "@/lib/color";
import { isGradient } from "@/types/gradient";
import { DEFAULT_ELEMENT_MATERIAL, elementMaterial } from "@/types/element";
import type { FolderElement, TextElement } from "@/types/element";
import { buildDrawSvg, buildIconSvg, buildShapeSvg, innerShadowFilter, shapeStrokePadPx } from "@/lib/export/elementSvg";
import { buildElementMaterialFilter } from "@/lib/export/materials";
import { getIconBody, iconStatus, useIconCacheVersion } from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { LiveOverride } from "@/hooks/useInteraction";

interface Props {
  el: FolderElement;
  override?: LiveOverride;
  onPointerDown: (e: ReactPointerEvent, id: string) => void;
}

/**
 * The element as the panel is currently previewing it: the hovered material
 * swapped in without touching the document, so browsing the dropdown costs no
 * undo entries and leaves nothing behind if you press Escape. Mirrors the
 * font/blend-mode hover previews.
 *
 * Applied to the ELEMENT rather than to each renderer, so shape, icon and text
 * all pick the preview up from one place.
 */
function withMaterialPreview<T extends FolderElement>(el: T, preview: string | null): T {
  if (preview == null) return el;
  const base = el.material ?? DEFAULT_ELEMENT_MATERIAL;
  return { ...el, material: { ...base, id: preview } };
}

function svgHtml(el: FolderElement, w: number, h: number): string | null {
  if (el.type === "shape") return buildShapeSvg(el, w, h);
  if (el.type === "draw") return buildDrawSvg(el, w, h);
  if (el.type === "icon") {
    const body = getIconBody(el.iconName, el.iconVariant);
    return body ? buildIconSvg(el, body, w, h) : null;
  }
  return null;
}

function TextContent({ el }: { el: TextElement }) {
  const editing = useUiStore((s) => s.editingTextId === el.id);
  const divRef = useRef<HTMLDivElement>(null);
  // Live-preview of a hovered font (text panel) on the selected text element,
  // mirroring the image panel's blend-mode preview.
  const isSelected = useSelectionStore((s) => s.selectedId === el.id);
  const fontPreview = useUiStore((s) => s.fontPreview);
  const fontFamily = isSelected && fontPreview ? fontPreview : el.fontFamily;

  // contentEditable alone doesn't take focus — without this, entering edit
  // mode leaves keystrokes going nowhere. Select-all so typing replaces the
  // text (legacy behavior).
  useEffect(() => {
    const div = divRef.current;
    if (!editing || !div) return;
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);
  const grad = isGradient(el.color) ? el.color : null;
  // Shape and icon carry their material inside the SVG string this editor
  // injects, so they need nothing here. Text has no SVG form, so the same
  // filter is referenced from CSS and its def rendered alongside — a CSS
  // `filter: url(#id)` on an HTML element resolves against the document, and
  // its user space is the element's border box, i.e. workspace units, which is
  // exactly what both export paths use.
  const materialPreview = useUiStore((s) => (isSelected ? s.materialPreview : null));
  const materialId = `tmat-${el.id}`;
  // CSS has no inner-shadow for text (`box-shadow: inset` is a box, not glyphs),
  // so the editor references the very SVG filter the vector export inlines. A
  // CSS `filter: url()` resolves against the document and its user space is the
  // border box — workspace units, which is what the filter is built in.
  const innerShadowId = `tins-${el.id}`;
  const innerShadowFilterDef = useMemo(
    () => (el.innerShadow ? innerShadowFilter(innerShadowId, el.innerShadow, 1, 1) : null),
    [el.innerShadow, innerShadowId],
  );
  // Memoised: an unchanged filter string keeps React from replacing the <defs>
  // node, which lets the browser reuse the rasterised grain instead of re-running
  // the noise on every unrelated re-render (a drag frame, a selection change).
  // The material is resolved INSIDE the memo — resolving it outside rebuilds a
  // fresh object every render, which would defeat the memo exactly while the
  // dropdown is open and the noise is most expensive to re-run.
  const materialFilter = useMemo(() => {
      const material = elementMaterial(withMaterialPreview(el, materialPreview));
      return material
        ? buildElementMaterialFilter(material, materialId, 1, 1, {
            // A CSS filter's user space is the border box with its origin at
            // the top-left, so this is the same doubled box the SVG export
            // uses, shifted out of centre-relative coordinates.
            x: -el.width / 2,
            y: -el.height / 2,
            w: el.width * 2,
            h: el.height * 2,
          })
        : null;
    },
    [el, materialPreview, materialId, el.width, el.height],
  );
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    textDecoration: el.underline ? "underline" : "none",
    textAlign: el.align,
    letterSpacing: `${el.letterSpacing}px`,
    lineHeight: el.lineHeight,
    // NOT flex: a flex container puts its text in an anonymous flex item, which
    // `background-clip: text` has no text of its own to clip to — gradient text
    // then paints nothing at all. Block + `align-content` centers the same way
    // (horizontal alignment already comes from `textAlign` above).
    display: "block",
    // Vertical anchor is ALWAYS center — the export centers text in the box, so
    // keying this off horizontal align top-anchored left/right text (EXP-03).
    // `unsafe` is load-bearing: plain `center` is *safe* centering, which falls
    // back to start (top) alignment as soon as the line box is taller than the
    // element box (e.g. fontSize 42 x lineHeight 1.3 = 54.6 in a 34.3 box). The
    // canvas/SVG exports center unconditionally, so safe centering silently
    // dropped the editor's text half a line lower than the export put it —
    // invisible until `clip` started cutting at the box edge.
    // ponytail: relies on the `unsafe` box-alignment keyword (Chrome/Safari 16+/
    // Firefox). Somewhere without it drops the declaration and top-anchors ALL
    // text; swap to an explicit translateY of (boxH - contentH) / 2 if that
    // ever matters.
    alignContent: "unsafe center",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    // The box is a transform/selection frame, not a clip — glyphs overflow it
    // freely (like the draw tool / Figma) unless `clip` opts back into the old
    // clip-to-box behaviour. Mirrored by both export paths.
    overflow: el.clip ? "hidden" : "visible",
    outline: "none",
    cursor: editing ? "text" : "grab",
    userSelect: editing ? "text" : "none",
    pointerEvents: editing ? "auto" : "none",
    // `background` is a shorthand that resets background-clip to its initial
    // value (border-box) — using the backgroundImage longhand instead keeps
    // the "text" clip from being silently dropped, which was letting the
    // gradient paint the whole box instead of just the glyphs.
    backgroundImage: grad ? textGradientCss(grad, el.width, el.height) : "none",
    WebkitBackgroundClip: grad ? "text" : "unset",
    backgroundClip: grad ? "text" : "unset",
    WebkitTextFillColor: grad ? "transparent" : "unset",
    color: grad ? "transparent" : (el.color as string),
    // Only "outside" doubles the width: the fill painted over the inner half
    // then leaves a full-width band outside the glyph. "center" and "inside"
    // use the width as-is — a true inside-only stroke would need the stroke
    // clipped to the glyph outline, which -webkit-text-stroke can't do, so
    // "inside" renders like "center" rather than at double thickness.
    WebkitTextStroke:
      el.stroke && el.stroke.width > 0
        ? `${el.stroke.width * (el.stroke.position === "outside" ? 2 : 1)}px ${el.stroke.color}`
        : "unset",
    paintOrder: el.stroke?.position === "outside" ? "stroke fill" : "fill stroke",
    // `text-shadow` paints in the text layer, which is ABOVE the background
    // layer — and gradient text lives in the background (background-clip:text),
    // so the shadow landed on top of the glyphs. `filter: drop-shadow` applies
    // to the element's finished rendering instead, keeping it behind either way.
    textShadow:
      el.shadow && !grad
        ? `${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${hexA(el.shadow.color, el.shadow.opacity)}`
        : "none",
    // Both a gradient's drop-shadow and the material are `filter` values, so
    // they compose into one list rather than one silently replacing the other.
    filter:
      [
        el.shadow && grad
          ? `drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${hexA(el.shadow.color, el.shadow.opacity)})`
          : null,
        innerShadowFilterDef ? `url(#${innerShadowId})` : null,
        materialFilter ? `url(#${materialId})` : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  return (
    <>
      {(materialFilter || innerShadowFilterDef) && (
        <svg
          aria-hidden
          width="0"
          height="0"
          style={{ position: "absolute" }}
          dangerouslySetInnerHTML={{
            __html: `<defs>${innerShadowFilterDef ?? ""}${materialFilter ?? ""}</defs>`,
          }}
        />
      )}
    <div
      ref={divRef}
      contentEditable={editing}
      suppressContentEditableWarning
      style={style}
      onMouseDown={(e) => {
        if (editing) e.stopPropagation();
      }}
      onInput={(e) => {
        // Backspacing to empty commonly leaves the div non-structurally-empty
        // (a stray <br>, or two adjacent text nodes split by the deletion) —
        // normalize() merges split text nodes, and clearing innerHTML once
        // textContent is truly "" removes the leftover <br>. Without this, an
        // extra keystroke is needed before the field reads as empty (IN-05).
        // Skip mid-IME-composition so candidate insertion is never disturbed.
        if ((e.nativeEvent as InputEvent).isComposing) return;
        const div = e.currentTarget;
        div.normalize();
        if (div.textContent === "") div.innerHTML = "";
      }}
      onBlur={(e) => {
        const text = e.currentTarget.innerText;
        useUiStore.getState().setEditingTextId(null);
        if (!text.trim()) useDocumentStore.getState().removeElements([el.id]);
        else if (text !== el.text) useDocumentStore.getState().updateElement(el.id, { text });
      }}
    >
      {el.text}
    </div>
    </>
  );
}

/** Max gap (ms) between two presses on a text element that counts as a double-click. */
const DBL_MS = 500;

function ElementViewImpl({ el, override, onPointerDown }: Props) {
  // Double-click to edit text is detected from `pointerdown`, not the DOM
  // `dblclick` event. `dblclick` only fires when two clicks land on the *same*
  // node within the OS threshold, and the interaction layer (pointer capture on
  // the workspace + a click that selects/re-renders between the two presses)
  // makes that unreliable. Pointerdown always reaches this element — that's how
  // selection works — so a second press within DBL_MS enters edit mode instead.
  const lastDownRef = useRef(Number.NEGATIVE_INFINITY);
  const x = override?.x ?? el.x;
  const y = override?.y ?? el.y;
  const width = override?.width ?? el.width;
  const height = override?.height ?? el.height;
  const rotation = override?.rotation ?? el.rotation;
  const hasShadow =
    (el.type === "shape" || el.type === "icon" || el.type === "image") && el.dropShadow;
  // Re-render when a fetched icon body lands in the cache.
  const iconVersion = useIconCacheVersion();
  const isSelected = useSelectionStore((s) => s.selectedId === el.id);
  // Live-preview of a hovered material on the selected shape/icon. Text handles
  // its own preview in TextContent, where its CSS filter is built.
  const materialPreview = useUiStore((s) =>
    isSelected && (el.type === "shape" || el.type === "icon") ? s.materialPreview : null,
  );
  // Rebuild the injected SVG only when the element, its box, the icon cache or
  // the previewed material actually changed — so an unrelated drag frame
  // doesn't re-serialize it (PF-01).
  const svg = useMemo(
    () =>
      el.type === "shape" || el.type === "draw" || el.type === "icon"
        ? svgHtml(withMaterialPreview(el, materialPreview), width, height)
        : null,
    [el, width, height, iconVersion, materialPreview],
  );
  const svgPad =
    el.type === "shape" ? shapeStrokePadPx(el, width, height) : { px: 0, py: 0 };
  // Live-preview of a hovered blend mode (image panel) on the selected image.
  const blendPreview = useUiStore((s) =>
    el.type === "image" ? s.blendPreview : null,
  );
  const effectiveBlend =
    el.type === "image" ? (isSelected && blendPreview ? blendPreview : el.blendMode) : undefined;

  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    transform: `rotate(${rotation}deg) scale(${el.scaleX}, ${el.scaleY})`,
    transformOrigin: "center",
    opacity: el.visible === false ? 0 : el.opacity,
    // Touch drags must not scroll/zoom the page; hidden elements (rendered only
    // because selected) must not swallow pointer hits (IN-01/IN-04).
    touchAction: "none",
    pointerEvents: el.visible === false ? "none" : undefined,
    cursor: el.locked ? "default" : "grab",
    filter: hasShadow
      ? `drop-shadow(${el.dropShadow!.x}px ${el.dropShadow!.y}px ${el.dropShadow!.blur}px ${hexA(el.dropShadow!.color, el.dropShadow!.opacity)})`
      : undefined,
    mixBlendMode: effectiveBlend && effectiveBlend !== "normal" ? effectiveBlend : undefined,
    outline:
      el.type === "image" && el.stroke?.enabled
        ? `${el.stroke.width}px solid ${el.stroke.color}`
        : undefined,
  };

  let content;
  if (el.type === "text") {
    content = <TextContent el={el} />;
  } else if (el.type === "image") {
    content = (
      <img
        src={el.src}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block" }}
        alt=""
      />
    );
  } else {
    content = svg ? (
      <div
        // A shape's outside/center stroke paints past the element box, so the
        // injected SVG is inflated by that margin and hangs outside the box —
        // the same inflation the two export paths apply.
        style={{
          position: "absolute",
          left: -svgPad.px,
          top: -svgPad.py,
          width: `calc(100% + ${svgPad.px * 2}px)`,
          height: `calc(100% + ${svgPad.py * 2}px)`,
          pointerEvents: "none",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    ) : el.type === "icon" && iconStatus(el.iconName, el.iconVariant) === "failed" ? (
      // Resolved-but-empty: a distinct, static "unavailable" box — not the
      // pulsing loader — so a permanently-missing icon reads as failed (ST-10).
      <div
        title="Icon unavailable offline"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed rgba(255,255,255,0.25)",
          borderRadius: 4,
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
        }}
      >
        ?
      </div>
    ) : (
      // Still loading (pending / not yet requested): pulsing placeholder.
      <div
        className="animate-pulse"
        style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 4 }}
      />
    );
  }

  return (
    <div
      data-element-id={el.id}
      style={style}
      onPointerDown={(e) => {
        if (el.type === "text") {
          if (useUiStore.getState().editingTextId === el.id) return;
          const now = e.timeStamp;
          if (!el.locked && now - lastDownRef.current < DBL_MS) {
            lastDownRef.current = 0;
            // Enter edit mode without starting a drag. preventDefault stops the
            // compat mousedown from pulling focus to <body>, so the effect that
            // focuses the contentEditable wins.
            e.preventDefault();
            e.stopPropagation();
            useUiStore.getState().setEditingTextId(el.id);
            return;
          }
          lastDownRef.current = now;
        }
        onPointerDown(e, el.id);
      }}
    >
      {content}
    </div>
  );
}

// Memoized so a drag frame re-renders only the elements whose props changed
// (the dragged one's override) rather than the whole element list (PF-01).
export const ElementView = memo(ElementViewImpl);
