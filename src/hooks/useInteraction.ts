/**
 * Pointer-driven interaction state machine for the workspace: move, resize,
 * rotate, and marquee-select. Ported from the legacy `startMove`/`startResize`/
 * `startRotate` + `onMove`/`onUp` (public/legacy.html L659-700), reusing the pure
 * math in `geometry.ts` / `workspaceGeometry.ts`.
 *
 * Phase 4 migrated this from window MouseEvents to PointerEvents with pointer
 * capture (IN-01/02): gestures survive the pointer leaving the window, only the
 * primary button starts them, a lost button/`pointercancel` ends them cleanly,
 * and Escape cancels a drag. Selecting still happens on press, but the docked
 * panel only switches on a click-without-drag (IN-11), and a plain click inside a
 * multi-selection collapses it to the clicked element (IN-07).
 *
 * Undo model — commit-once: during a drag the in-progress transform lives in
 * ephemeral React state (`state.overrides`) and the workspace renders it, but the
 * tracked document store is written exactly once on release.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
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
/** Pointer travel (px) before a press counts as a drag rather than a click. */
const MOVE_SLOP = 3;

/**
 * Module-level "a canvas gesture is live" flag — the single source of truth used
 * by the keyboard handler to block history ops mid-drag (ST-02) and to defer
 * Escape to the drag-cancel path (IN-03). Set when a begin* attaches its
 * listeners, cleared on drop/cancel/unmount.
 */
let interactionActive = false;
export function isInteractionActive(): boolean {
  return interactionActive;
}

/** Panel a given element type routes to when clicked (IN-11). */
const PANEL_BY_TYPE: Record<string, string> = {
  image: "image",
  icon: "icon",
  text: "text",
  draw: "draw",
  shape: "shapes",
};

type Drag =
  | {
      kind: "move";
      startX: number;
      startY: number;
      movingEls: IdRect[];
      others: IdRect[];
      downId: string;
      panelType?: string;
      /** A plain click (no drag) collapses a multi-selection to this element. */
      collapseOnClick: boolean;
      didMove: boolean;
    }
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
  beginMove: (e: ReactPointerEvent, id: string) => void;
  beginResize: (e: ReactPointerEvent, handle: ResizeHandle) => void;
  beginRotate: (e: ReactPointerEvent) => void;
  beginMarquee: (e: ReactPointerEvent) => void;
}

export function useInteraction(wsRef: RefObject<HTMLDivElement | null>): Interaction {
  const [state, setState] = useState<InteractionState>(IDLE);
  const dragRef = useRef<Drag | null>(null);
  const liveRef = useRef<InteractionState>(IDLE);
  const pointerIdRef = useRef<number | null>(null);
  const finishRef = useRef<(commit: boolean) => void>(() => {});

  const apply = useCallback((next: InteractionState) => {
    liveRef.current = next;
    setState(next);
  }, []);

  const onMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // Ignore a second pointer's stream. Lenient: only reject when both ids are
      // present and differ (jsdom may leave pointerId undefined).
      if (pointerIdRef.current != null && e.pointerId != null && e.pointerId !== pointerIdRef.current) {
        return;
      }
      // Insurance against a mouseup lost off-window: if the primary button is no
      // longer down, end the gesture where it stands.
      if ((e.buttons & 1) === 0) {
        finishRef.current(true);
        return;
      }
      if (d.kind === "move") {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.didMove && Math.hypot(dx, dy) > MOVE_SLOP) d.didMove = true;
        const noSnap = e.altKey; // Alt bypasses snapping (IN-05)
        if (d.movingEls.length > 1) {
          const r = groupMoveSnap(d.movingEls, dx, dy, noSnap);
          apply({
            overrides: r.overrides,
            marquee: null,
            snap: { v: r.snapV, h: r.snapH, vx: r.snapVX, hy: r.snapHY },
            dragging: true,
          });
        } else {
          const el = d.movingEls[0];
          const r = snapMove(el, d.others, dx, dy, noSnap);
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

  const onUp = useCallback(() => finishRef.current(true), []);
  const onCancel = useCallback(() => finishRef.current(false), []);
  const onKey = useCallback((e: globalThis.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      finishRef.current(false);
    }
  }, []);

  const detach = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
  }, [onMove, onUp, onCancel, onKey]);

  const finish = useCallback(
    (commit: boolean) => {
      detach();
      interactionActive = false;
      const pid = pointerIdRef.current;
      pointerIdRef.current = null;
      if (pid !== null) {
        try {
          wsRef.current?.releasePointerCapture(pid);
        } catch {
          // Capture may already be gone (pointercancel); ignore.
        }
      }
      const d = dragRef.current;
      dragRef.current = null;
      const live = liveRef.current;
      if (d) {
        if (d.kind === "marquee") {
          if (commit && live.marquee) {
            const doc = useDocumentStore.getState().doc;
            const hits = marqueeHits(
              doc.elements.filter((e) => e.visible !== false).map(toIdRect),
              live.marquee,
            );
            useSelectionStore.getState().setMany(hits);
          }
        } else if (d.kind === "move") {
          if (d.didMove) {
            if (commit && Object.keys(live.overrides).length > 0) {
              useDocumentStore.getState().updateElements(live.overrides);
            }
          } else if (commit) {
            // Click, no drag: collapse a multi-selection (IN-07) and open the
            // element's panel — but never yank away from Layers/Gallery (IN-11).
            if (d.collapseOnClick) useSelectionStore.getState().select(d.downId);
            const active = useUiStore.getState().activePanel;
            if (d.panelType && active !== "layers" && active !== "gallery") {
              useUiStore.getState().setActivePanel(d.panelType);
            }
          }
        } else if (commit && Object.keys(live.overrides).length > 0) {
          useDocumentStore.getState().updateElements(live.overrides);
        }
      }
      apply(IDLE);
    },
    [apply, detach, wsRef],
  );
  finishRef.current = finish;

  const attach = useCallback(
    (e: ReactPointerEvent) => {
      interactionActive = true;
      pointerIdRef.current = e.pointerId;
      try {
        wsRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // jsdom / no-capture environments — window listeners still fire.
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
    },
    [onMove, onUp, onCancel, onKey, wsRef],
  );

  useEffect(
    () => () => {
      interactionActive = false;
      detach();
    },
    [detach],
  );

  const beginMove = useCallback(
    (e: ReactPointerEvent, id: string) => {
      if (e.button !== 0) return; // primary button only (IN-02)
      e.stopPropagation();
      e.preventDefault();
      const doc = useDocumentStore.getState().doc;
      const el = doc.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      const sel = useSelectionStore.getState();

      let ids: string[];
      let collapseOnClick = false;
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
        // Pressing an already-selected element inside a multi-selection: a drag
        // moves the group, but a plain click collapses to just this element.
        collapseOnClick = sel.selectedIds.length > 1;
      }
      useUiStore.getState().setEditingTextId(null);

      const movingEls = ids
        .map((i) => doc.elements.find((x) => x.id === i))
        .filter((x): x is NonNullable<typeof x> => Boolean(x) && !x!.locked)
        .map(toIdRect);
      const moving = new Set(movingEls.map((m) => m.id));
      const others = doc.elements
        .filter((x) => !moving.has(x.id) && x.visible !== false)
        .map(toIdRect);

      dragRef.current = {
        kind: "move",
        startX: e.clientX,
        startY: e.clientY,
        movingEls,
        others,
        downId: id,
        panelType: PANEL_BY_TYPE[el.type],
        collapseOnClick,
        didMove: false,
      };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach(e);
    },
    [apply, attach],
  );

  const beginResize = useCallback(
    (e: ReactPointerEvent, handle: ResizeHandle) => {
      if (e.button !== 0) return;
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
      attach(e);
    },
    [apply, attach],
  );

  const beginRotate = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const doc = useDocumentStore.getState().doc;
      const id = useSelectionStore.getState().selectedId;
      const el = doc.elements.find((x) => x.id === id);
      const wsRect = wsRef.current?.getBoundingClientRect();
      if (!el || el.locked || !wsRect) return;
      dragRef.current = { kind: "rotate", el: toIdRect(el), wsRect };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach(e);
    },
    [apply, attach, wsRef],
  );

  const beginMarquee = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const wsRect = wsRef.current?.getBoundingClientRect();
      if (!wsRect) return;
      useSelectionStore.getState().clear();
      useUiStore.getState().setEditingTextId(null);
      dragRef.current = { kind: "marquee", startX: e.clientX, startY: e.clientY, wsRect };
      apply({ overrides: {}, marquee: null, snap: NO_SNAP, dragging: true });
      attach(e);
    },
    [apply, attach, wsRef],
  );

  return { state, beginMove, beginResize, beginRotate, beginMarquee };
}
