/**
 * Draw-tool interaction (5d): freehand stroke → one element/one undo entry,
 * eraser gesture → one undo entry, line anchors + Enter/commit, Escape
 * semantics, and clearDrawings' textureLayerZ clamp.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DrawOverlay } from "@/components/workspace/DrawOverlay";
import { commitShapePoints } from "@/hooks/useDrawTool";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

const temporal = () => useDocumentStore.temporal.getState();
const ui = () => useUiStore.getState();

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.setState({
    activeTool: "draw",
    drawMode: "pen",
    drawSubmode: "freehand",
    drawColor: "#ffffff",
    drawSize: 8,
    drawOpacity: 1,
    currentDraw: null,
    shapePoints: [],
    shapeCursorPos: null,
    shapeDragPoint: null,
  });
  temporal().clear();
});

function overlay() {
  const { container } = render(<DrawOverlay />);
  const el = container.querySelector("[data-draw-overlay]") as HTMLElement;
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 305, height: 200, right: 305, bottom: 200, x: 0, y: 0 }) as DOMRect;
  return el;
}

describe("freehand", () => {
  it("draws a stroke and commits ONE element and ONE undo entry on release", () => {
    const target = overlay();
    const baseline = temporal().pastStates.length;

    fireEvent.pointerDown(target, { clientX: 20, clientY: 20, buttons: 1, pointerId: 1 });
    expect(ui().currentDraw?.points).toHaveLength(1);
    fireEvent.pointerMove(target, { clientX: 40, clientY: 30, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 41, clientY: 31, buttons: 1, pointerId: 1 }); // <3px, dropped
    fireEvent.pointerMove(target, { clientX: 70, clientY: 20, buttons: 1, pointerId: 1 });
    expect(ui().currentDraw?.points).toHaveLength(3);
    fireEvent.pointerUp(target, { pointerId: 1 });

    expect(ui().currentDraw).toBeNull();
    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("draw");
    expect(els[0].name).toBe("Drawing 1");
    expect(temporal().pastStates.length).toBe(baseline + 1);
  });

  it("drops sub-2-point taps", () => {
    const target = overlay();
    fireEvent.pointerDown(target, { clientX: 20, clientY: 20, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(useDocumentStore.getState().doc.elements).toHaveLength(0);
  });
});

describe("eraser", () => {
  it("erases hit drawings in one undo entry per swipe", () => {
    // Two drawings: one whose stroke spans (10..60, 10..30), one far away. The
    // paths must actually span their bbox — IN-09 measures to the path, not the box.
    useDocumentStore.getState().addDrawElement(
      { x: 10, y: 10, width: 50, height: 20, origWidth: 50, origHeight: 20, svgPath: "M 0 0 L 50 20", strokeColor: "#fff", strokeSize: 4 },
    );
    useDocumentStore.getState().addDrawElement(
      { x: 200, y: 150, width: 30, height: 20, origWidth: 30, origHeight: 20, svgPath: "M 0 0 L 30 20", strokeColor: "#fff", strokeSize: 4 },
    );
    useUiStore.setState({ drawMode: "eraser" });
    const target = overlay();
    const baseline = temporal().pastStates.length;

    fireEvent.pointerDown(target, { clientX: 30, clientY: 20, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 35, clientY: 22, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(target, { pointerId: 1 });

    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(1);
    expect(els[0].x).toBe(200);
    expect(temporal().pastStates.length).toBe(baseline + 1);

    temporal().undo();
    expect(useDocumentStore.getState().doc.elements).toHaveLength(2);
  });
});

describe("line tool", () => {
  it("accumulates anchors on click and commits via commitShapePoints", () => {
    useUiStore.setState({ drawSubmode: "line" });
    const target = overlay();

    fireEvent.pointerDown(target, { clientX: 10, clientY: 10, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(target, { pointerId: 1 });
    fireEvent.pointerDown(target, { clientX: 80, clientY: 60, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(ui().shapePoints).toHaveLength(2);

    commitShapePoints();
    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(1);
    expect(els[0].name).toBe("Line 1");
    expect(ui().shapePoints).toHaveLength(0);
  });
});

describe("escape + clear", () => {
  it("clearDrawings removes draws and clamps textureLayerZ", () => {
    const s = useDocumentStore.getState();
    s.addDrawElement({ x: 0, y: 0, width: 10, height: 10, origWidth: 10, origHeight: 10, svgPath: "M 0 0 L 1 1", strokeColor: "#fff", strokeSize: 2 });
    s.addShape("rect");
    s.addDrawElement({ x: 0, y: 0, width: 10, height: 10, origWidth: 10, origHeight: 10, svgPath: "M 0 0 L 1 1", strokeColor: "#fff", strokeSize: 2 });
    // texture above all three elements
    useDocumentStore.setState((st) => ({ doc: { ...st.doc, textureLayerZ: 3 } }));

    useDocumentStore.getState().clearDrawings();
    const doc = useDocumentStore.getState().doc;
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0].type).toBe("shape");
    expect(doc.textureLayerZ).toBe(1);
  });
});
