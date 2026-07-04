/**
 * Pointer state machine for the draw tool (freehand / line / arc / eraser),
 * ported from the legacy `startDrawEvent` + the `drawing`/`erasing`/`shaping`
 * branches of `onMove`/`onUp` (docs/index.html L698-712, L998).
 *
 * The returned handlers go on the draw overlay covering the content rect, so
 * pointer coordinates are already content-space. Freehand strokes and line/arc
 * anchors accumulate in ephemeral ui state (rendered live by `DrawOverlay`);
 * commits create one draw element = one undo entry. Erasing wraps the whole
 * gesture in a doc-preview transaction (one undo entry per swipe).
 */

import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  computeFreehandCommit,
  computeShapeCommit,
  eraseHitIds,
  symmetricHandles,
} from "@/lib/draw";
import {
  beginDocPreview,
  endDocPreview,
  useDocumentStore,
} from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

const DOUBLE_TAP_MS = 340;
const DOUBLE_TAP_DIST = 12;
const MIN_POINT_DIST = 3;

export interface DrawToolHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

/** Commit the current line/arc anchors as a draw element (also used by Enter). */
export function commitShapePoints(): void {
  const ui = useUiStore.getState();
  const input = computeShapeCommit(
    ui.shapePoints,
    ui.drawSubmode === "arc" ? "arc" : "line",
    ui.drawColor,
    ui.drawSize,
    ui.drawOpacity,
  );
  ui.resetDrawProgress();
  if (!input) return;
  useDocumentStore
    .getState()
    .addDrawElement(input, ui.drawSubmode === "arc" ? "Arc" : "Line");
}

export function useDrawTool(): DrawToolHandlers {
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const shapingFrom = useRef<{ x: number; y: number } | null>(null);
  const erasing = useRef(false);

  const toLocal = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ui = useUiStore.getState();
    const { x, y } = toLocal(e);

    if (ui.drawMode === "eraser") {
      erasing.current = true;
      beginDocPreview();
      const hits = eraseHitIds(useDocumentStore.getState().doc.elements, x, y, ui.drawSize);
      if (hits.length) useDocumentStore.getState().removeElements(hits);
      return;
    }

    if (ui.drawSubmode === "line" || ui.drawSubmode === "arc") {
      const now = Date.now();
      const lt = lastTap.current;
      const isDouble =
        lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(x - lt.x, y - lt.y) < DOUBLE_TAP_DIST;
      lastTap.current = { t: now, x, y };
      if (isDouble && ui.shapePoints.length >= 1) {
        // The first tap of the double-click added an anchor — drop it.
        if (ui.shapePoints.length > 1) ui.setShapePoints(ui.shapePoints.slice(0, -1));
        commitShapePoints();
        return;
      }
      if (ui.drawSubmode === "line") {
        ui.setShapePoints([...ui.shapePoints, { x, y, h1x: x, h1y: y, h2x: x, h2y: y }]);
      } else {
        shapingFrom.current = { x, y };
        ui.setShapeDragPoint({ x, y, h1x: x, h1y: y, h2x: x, h2y: y });
      }
      return;
    }

    // Freehand
    useSelectionStore.getState().clear();
    ui.setCurrentDraw({
      points: [{ x, y }],
      color: ui.drawColor,
      size: ui.drawSize,
      opacity: ui.drawOpacity,
    });
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const ui = useUiStore.getState();
    const { x, y } = toLocal(e);
    const buttonDown = (e.buttons & 1) === 1;

    if (erasing.current && buttonDown) {
      const hits = eraseHitIds(useDocumentStore.getState().doc.elements, x, y, ui.drawSize);
      if (hits.length) useDocumentStore.getState().removeElements(hits);
      return;
    }

    if (ui.currentDraw && buttonDown) {
      const pts = ui.currentDraw.points;
      const last = pts[pts.length - 1];
      if (Math.hypot(x - last.x, y - last.y) >= MIN_POINT_DIST) {
        ui.setCurrentDraw({ ...ui.currentDraw, points: [...pts, { x, y }] });
      }
      return;
    }

    if (shapingFrom.current && buttonDown && ui.shapeDragPoint) {
      const from = shapingFrom.current;
      if (Math.hypot(x - from.x, y - from.y) >= MIN_POINT_DIST) {
        ui.setShapeDragPoint(symmetricHandles(from, { x, y }));
      }
      return;
    }

    if (ui.drawSubmode === "line" || ui.drawSubmode === "arc") {
      ui.setShapeCursorPos({ x, y });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const ui = useUiStore.getState();

    if (erasing.current) {
      erasing.current = false;
      endDocPreview();
      return;
    }

    if (ui.currentDraw) {
      const input = computeFreehandCommit(ui.currentDraw);
      ui.setCurrentDraw(null);
      if (input) useDocumentStore.getState().addDrawElement(input, "Drawing");
      return;
    }

    if (shapingFrom.current && ui.shapeDragPoint) {
      shapingFrom.current = null;
      ui.setShapePoints([...ui.shapePoints, ui.shapeDragPoint]);
      ui.setShapeDragPoint(null);
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    useUiStore.getState().setShapeCursorPos(null);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
