/**
 * Pointer-driven interaction state machine for the workspace: move, resize,
 * rotate, and marquee-select. Ported from the legacy `startMove`/`startResize`/
 * `startRotate` + `onMove`/`onUp` (docs/index.html L659-700), reusing the pure
 * math in `geometry.ts` / `workspaceGeometry.ts`.
 *
 * Undo model — commit-once: during a drag the in-progress transform lives in
 * ephemeral React state (`state.overrides`) and the workspace renders it, but the
 * tracked document store is written exactly once on mouse-up, so each gesture is
 * a single undo entry (matching the legacy start/end snapshot pattern).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { resizeElement, rotateAngle, snapMove } from "@/lib/geometry";
import type { Rect } from "@/lib/geometry";
import {
  elementCenterClient,
  groupMoveSnap,
  marqueeHits,
  marqueeToContent,
} from "@/lib/workspaceGeometry";
import type { IdRect } from "@/lib/workspaceGeometry";
import type { ResizeHandle } from "@/types/interaction";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

/** Per-element live transform applied to the render during a drag. */
export interface LiveOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface SnapGuides {
  v: boolean;
  h: boolean;
  vx: number | null;
  hy: number | null;
}

export interface InteractionState {
  overrides: Record<string, LiveOverride>;
  marquee: Rect | null;
  snap: SnapGuides;
  dragging: boolean;
}

const NO_SNAP: SnapGuides = { v: false, h: false, vx: null, hy: null };
const IDLE: InteractionState = { overrides: {}, marquee: null, snap: NO_SNAP, dragging: false };

type Drag =
  | { kind: "move"; startX: number; startY: number; movingEls: IdRect[]; others: IdRect[] }
  | {
      kind: "resize";
      handle: ResizeHandle;
      startX: number;
      startY: number;
      el: IdRect & { rotation: number };
    }
  | { kind: "rotate"; el: IdRect; wsRect: DOMRect }
  | { kind: "marquee"; startX: number; startY: number; wsRect: DOMRect };

function toIdRect(e: { id: string; x: number; y: number; width: number; height: number }): IdRect {
  return { id: e.id, x: e.x, y: e.y, width: e.width, height: e.height };
}

export interface Interaction {
  state: InteractionState;
  beginMove: (e: ReactMouseEvent, id: string) => void;
  beginResize: (e: ReactMouseEvent, handle: ResizeHandle) => void;
  beginRotate: (e: ReactMouseEvent) => void;
  beginMarquee: (e: ReactMouseEvent) => void;
}

export function useInteraction(wsRef: RefObject<HTMLDivElement | null>): Interaction {
  const [state, setState] = useState<InteractionState>(IDLE);
  const dragRef = useRef<Drag | null>(null);
  const liveRef = useRef<InteractionState>(IDLE);

  const apply = useCallback((next: InteractionState) => {
    liveRef.current = next;
    setState(next);
  }, []);

  const onMove = useCallback(
    (e: globalThis.MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "move") {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (d.movingEls.length > 1) {
          const r = groupMoveSnap(d.movingEls, dx, dy);
          apply({
            overrides: r.overrides,
            marquee: null,
            snap: { v: r.snapV, h: r.snapH, vx: r.snapVX, hy: r.snapHY },
            dragging: true,
          });
        } else {
          const el = d.movingEls[0];
          const r = snapMove(el, d.others, dx, dy);
          apply({
            overrides: { [el.id]: { x: r.x, y: r.y } },
            marquee: null,
            snap: { v: r.snapV, h: r.snapH, vx: r.snapVX, hy: r.snapHY },
            dragging: true,
          });
        }
      } else if (d.kind === "resize") {
        const rect = resizeElement(d.el, d.handle, e.clientX - d.startX, e.clientY - d.startY);
        apply({ overrides: { [d.el.id]: rect }, marquee: null, snap: NO_SNAP, dragging: true });
      } else if (d.kind === "rotate") {
        const { cx, cy } = elementCenterClient(d.wsRect, d.el);
        const rotation = rotateAngle(cx, cy, e.clientX, e.clientY);
        apply({ overrides: { [d.el.id]: { rotation } }, marquee: null, snap: NO_SNAP, dragging: true });
      } else {
        const rect = marqueeToContent(d.wsRect, d.startX, d.startY, e.clientX, e.clientY);
        apply({ overrides: {}, marquee: rect, snap: NO_SNAP, dragging: true });
      }
    },
    [apply],
  );

  const onUp = useCallback(() => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    const d = dragRef.current;
    dragRef.current = null;
    const live = liveRef.current;
    if (d) {
      if (d.kind === "marquee") {
        if (d.startX !== undefined && live.marquee) {
          const doc = useDocumentStore.getState().doc;
          const hits = marqueeHits(
            doc.elements.filter((e) => e.visible !== false).map(toIdRect),
            live.marquee,
          );
          useSelectionStore.getState().setMany(hits);
        }
      } else if (Object.keys(live.overrides).length > 0) {
        useDocumentStore.getState().updateElements(live.overrides);
      }
    }
    apply(IDLE);
  }, [apply, onMove]);

  const attach = useCallback(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onMove, onUp]);

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    },
    [onMove, onUp],
  );

  const beginMove = useCallback(
    (e: ReactMouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      const doc = useDocumentStore.getState().doc;
      const el = doc.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      const sel = useSelectionStore.getState();

      let ids: string[];
      if (e.ctrlKey || e.metaKey) {
        const has = sel.selectedIds.includes(id);
        const next = has ? sel.selectedIds.filter((x) => x !== id) : [...sel.selectedIds, id];
        sel.setMany(next);
        if (has) return; // toggled off → selection change only, no drag
        ids = next;
      } else if (!sel.selectedIds.includes(id)) {
        ids = [id];
        sel.select(id);
      } else {
        ids = sel.selectedIds;
      }
      useUiStore.getState().setEditingTextId(null);

      // Legacy startMove: grabbing an element opens its type's panel (SVG
      // data-URL images count as icons/logos → the icon panel doesn't apply;
      // they edit in the image panel here, see ImagePanel).
      const panelByType: Record<string, string> = {
        image: "image",
        icon: "icon",
        text: "text",
        draw: "draw",
        shape: "shapes",
      };
      const panel = panelByType[el.type];
      if (panel) useUiStore.getState().setActivePanel(panel);

      const movingEls = ids
        .map((i) => doc.elements.find((x) => x.id === i))
        .filter((x): x is NonNullable<typeof x> => Boolean(x) && !x!.locked)
        .map(toIdRect);
      const moving = new Set(movingEls.map((m) => m.id));
      const others = doc.elements
        .filter((x) => !moving.has(x.id) && x.visible !== false)
        .map(toIdRect);

      dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, movingEls, others };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach();
    },
    [apply, attach],
  );

  const beginResize = useCallback(
    (e: ReactMouseEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      const doc = useDocumentStore.getState().doc;
      const id = useSelectionStore.getState().selectedId;
      const el = doc.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      dragRef.current = {
        kind: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        el: { ...toIdRect(el), rotation: el.rotation },
      };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach();
    },
    [apply, attach],
  );

  const beginRotate = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const doc = useDocumentStore.getState().doc;
      const id = useSelectionStore.getState().selectedId;
      const el = doc.elements.find((x) => x.id === id);
      const wsRect = wsRef.current?.getBoundingClientRect();
      if (!el || el.locked || !wsRect) return;
      dragRef.current = { kind: "rotate", el: toIdRect(el), wsRect };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach();
    },
    [apply, attach, wsRef],
  );

  const beginMarquee = useCallback(
    (e: ReactMouseEvent) => {
      const wsRect = wsRef.current?.getBoundingClientRect();
      if (!wsRect) return;
      useSelectionStore.getState().clear();
      useUiStore.getState().setEditingTextId(null);
      dragRef.current = { kind: "marquee", startX: e.clientX, startY: e.clientY, wsRect };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach();
    },
    [apply, attach, wsRef],
  );

  return { state, beginMove, beginResize, beginRotate, beginMarquee };
}
