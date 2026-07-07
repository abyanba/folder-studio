import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { Workspace } from "@/components/workspace/Workspace";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { createShapeElement } from "@/lib/elementFactories";
import { createEmptyDocument } from "@/types/document";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

function reset() {
  useDocumentStore.getState().reset();
  useDocumentStore.temporal.getState().clear();
  useSelectionStore.getState().clear();
  useUiStore.getState().setActivePanel("shape");
  useUiStore.getState().setEditingTextId(null);
}

/** Load a doc with a single rect and clear history so counts start at 0. */
function seedRect() {
  const shape = createShapeElement("rect", "R");
  shape.x = 200;
  shape.y = 100;
  shape.width = 40;
  shape.height = 40;
  useDocumentStore.getState().loadDocument({ ...createEmptyDocument(), elements: [shape] });
  useDocumentStore.temporal.getState().clear();
  return shape;
}

beforeEach(reset);

describe("useInteraction — move (PointerEvents, IN-01/02)", () => {
  it("selects on pointerdown and commits a drag as one undo entry", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;

    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 });
    expect(useSelectionStore.getState().selectedId).toBe(shape.id);

    fireEvent.pointerMove(window, { clientX: 130, clientY: 110, buttons: 1 });
    fireEvent.pointerUp(window);

    const el = useDocumentStore.getState().doc.elements[0];
    expect(Math.round(el.x)).toBe(230); // 200 + 30
    expect(Math.round(el.y)).toBe(110); // 100 + 10
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("undo restores the pre-drag position", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 25, clientY: 0, buttons: 1 });
    fireEvent.pointerUp(window);
    expect(Math.round(useDocumentStore.getState().doc.elements[0].x)).toBe(225);
    act(() => useDocumentStore.temporal.getState().undo());
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
  });

  it("ignores a non-primary (right/middle) button press", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.pointerDown(node, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200, buttons: 2 });
    fireEvent.pointerUp(window);
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(0);
  });

  it("ends the gesture when the button is released off-window (buttons=0)", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 30, clientY: 0, buttons: 1 });
    // A move with no buttons held commits and detaches — no more tracking after.
    fireEvent.pointerMove(window, { clientX: 60, clientY: 0, buttons: 0 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 0, buttons: 1 });
    expect(Math.round(useDocumentStore.getState().doc.elements[0].x)).toBe(230);
  });

  it("does not start a drag on a locked element", () => {
    const shape = seedRect();
    useDocumentStore.getState().updateElement(shape.id, { locked: true });
    useDocumentStore.temporal.getState().clear();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200, buttons: 1 });
    fireEvent.pointerUp(window);
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(0);
  });

  it("Alt-drag duplicates the element and drags the copy as one undo entry", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;

    fireEvent.pointerDown(node, { button: 0, altKey: true, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 110, buttons: 1, altKey: true });
    fireEvent.pointerUp(window);

    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(2);
    expect(els[0].x).toBe(200); // original stays put
    expect(Math.round(els[1].x)).toBe(230); // the copy moved (200 + 30)
    expect(Math.round(els[1].y)).toBe(110);
    expect(useSelectionStore.getState().selectedId).toBe(els[1].id); // copy is selected
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(1); // clone + move = 1 entry

    act(() => useDocumentStore.temporal.getState().undo());
    expect(useDocumentStore.getState().doc.elements).toHaveLength(1);
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
  });

  it("Alt-click without dragging leaves no duplicate behind", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;

    fireEvent.pointerDown(node, { button: 0, altKey: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);

    expect(useDocumentStore.getState().doc.elements).toHaveLength(1);
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(0);
  });

  it("switches the panel on a click without drag, but not while Layers is open (IN-11)", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;

    // Plain click → opens the element's panel.
    useUiStore.getState().setActivePanel("shape");
    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);
    expect(useUiStore.getState().activePanel).toBe("shapes");

    // While Layers is open, a click must not yank it away.
    useUiStore.getState().setActivePanel("layers");
    fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);
    expect(useUiStore.getState().activePanel).toBe("layers");
  });
});

function KbHost() {
  useKeyboardShortcuts();
  return null;
}

describe("useKeyboardShortcuts", () => {
  it("deletes the selection and undo restores it", () => {
    const shape = seedRect();
    useSelectionStore.getState().select(shape.id);
    render(<KbHost />);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(useDocumentStore.getState().doc.elements).toHaveLength(0);

    act(() => useDocumentStore.temporal.getState().undo());
    expect(useDocumentStore.getState().doc.elements).toHaveLength(1);
  });

  it("nudges the selection with arrow keys, coalescing a run into one entry (ST-03)", () => {
    const shape = seedRect();
    useSelectionStore.getState().select(shape.id);
    render(<KbHost />);
    const baseline = useDocumentStore.temporal.getState().pastStates.length;

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(201);
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(211);
    // Still one open transaction — nothing recorded until the key is released.
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(baseline);

    act(() => fireEvent.keyUp(window, { key: "ArrowRight" }));
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(baseline + 1);
  });

  it("ignores shortcuts while editing text", () => {
    const shape = seedRect();
    useSelectionStore.getState().select(shape.id);
    useUiStore.getState().setEditingTextId("some-text-id");
    render(<KbHost />);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(useDocumentStore.getState().doc.elements).toHaveLength(1);
  });
});
