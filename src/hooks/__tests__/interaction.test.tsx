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

describe("useInteraction — move", () => {
  it("selects on mousedown and commits a drag as one undo entry", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;

    fireEvent.mouseDown(node, { clientX: 100, clientY: 100 });
    expect(useSelectionStore.getState().selectedId).toBe(shape.id);

    fireEvent.mouseMove(window, { clientX: 130, clientY: 110 });
    fireEvent.mouseUp(window);

    const el = useDocumentStore.getState().doc.elements[0];
    expect(Math.round(el.x)).toBe(230); // 200 + 30
    expect(Math.round(el.y)).toBe(110); // 100 + 10
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("undo restores the pre-drag position", () => {
    const shape = seedRect();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.mouseDown(node, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 25, clientY: 0 });
    fireEvent.mouseUp(window);
    expect(Math.round(useDocumentStore.getState().doc.elements[0].x)).toBe(225);
    act(() => useDocumentStore.temporal.getState().undo());
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
  });

  it("does not start a drag on a locked element", () => {
    const shape = seedRect();
    useDocumentStore.getState().updateElement(shape.id, { locked: true });
    useDocumentStore.temporal.getState().clear();
    render(<Workspace />);
    const node = document.querySelector(`[data-element-id="${shape.id}"]`)!;
    fireEvent.mouseDown(node, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(window);
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(200);
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(0);
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
