/**
 * Renders one folder element as DOM inside the workspace content rect. For
 * icon/shape/draw it injects the *same* SVG string the Phase-3 `elementSvg`
 * builders produce (via `dangerouslySetInnerHTML`) so the editor and the export
 * canvas share one code path — no divergent second renderer. Text stays bespoke
 * (contentEditable + CSS), since the canvas draws it with `fillText` instead.
 */

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { hexA, textGradientCss } from "@/lib/color";
import { isGradient } from "@/types/gradient";
import type { FolderElement, TextElement } from "@/types/element";
import { buildDrawSvg, buildIconSvg, buildShapeSvg } from "@/lib/export/elementSvg";
import { getIconBody, useIconCacheVersion } from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { LiveOverride } from "@/hooks/useInteraction";

interface Props {
  el: FolderElement;
  override?: LiveOverride;
  onPointerDown: (e: ReactPointerEvent, id: string) => void;
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
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    textDecoration: el.underline ? "underline" : "none",
    textAlign: el.align,
    letterSpacing: `${el.letterSpacing}px`,
    lineHeight: el.lineHeight,
    display: "flex",
    // Vertical anchor is ALWAYS center — the export centers text in the box, so
    // keying this off horizontal align top-anchored left/right text (EXP-03).
    alignItems: "center",
    justifyContent:
      el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "hidden",
    outline: "none",
    cursor: editing ? "text" : "grab",
    userSelect: editing ? "text" : "none",
    pointerEvents: editing ? "auto" : "none",
    background: grad ? textGradientCss(grad, el.width, el.height) : "none",
    WebkitBackgroundClip: grad ? "text" : "unset",
    backgroundClip: grad ? "text" : "unset",
    WebkitTextFillColor: grad ? "transparent" : "unset",
    color: grad ? "transparent" : (el.color as string),
    WebkitTextStroke:
      el.stroke && el.stroke.width > 0
        ? `${el.stroke.width * (el.stroke.position === "center" ? 1 : 2)}px ${el.stroke.color}`
        : "unset",
    paintOrder: el.stroke?.position === "outside" ? "stroke fill" : "fill stroke",
    textShadow: el.shadow
      ? `${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${hexA(el.shadow.color, el.shadow.opacity)}`
      : "none",
  };
  return (
    <div
      ref={divRef}
      contentEditable={editing}
      suppressContentEditableWarning
      style={style}
      onMouseDown={(e) => {
        if (editing) e.stopPropagation();
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
  );
}

export function ElementView({ el, override, onPointerDown }: Props) {
  const x = override?.x ?? el.x;
  const y = override?.y ?? el.y;
  const width = override?.width ?? el.width;
  const height = override?.height ?? el.height;
  const rotation = override?.rotation ?? el.rotation;
  const hasShadow =
    (el.type === "shape" || el.type === "icon" || el.type === "image") && el.dropShadow;
  // Re-render when a fetched icon body lands in the cache.
  useIconCacheVersion();
  // Live-preview of a hovered blend mode (image panel) on the selected image.
  const blendPreview = useUiStore((s) =>
    el.type === "image" ? s.blendPreview : null,
  );
  const isSelected = useSelectionStore((s) => s.selectedId === el.id);
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
    const html = svgHtml(el, width, height);
    content = html ? (
      <div
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 4 }} />
    );
  }

  return (
    <div
      data-element-id={el.id}
      style={style}
      onPointerDown={(e) => {
        if (el.type === "text" && useUiStore.getState().editingTextId === el.id) return;
        onPointerDown(e, el.id);
      }}
      onDoubleClick={
        el.type === "text"
          ? (e) => {
              e.stopPropagation();
              useUiStore.getState().setEditingTextId(el.id);
            }
          : undefined
      }
    >
      {content}
    </div>
  );
}
