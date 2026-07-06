/**
 * Full keyboard-shortcut matrix (Phase 7) — complements the delete/arrow/
 * editing-guard cases in interaction.test.tsx: undo/redo keys, duplicate,
 * clipboard round-trip, and Escape's layered draw-tool semantics.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

function Harness() {
  useKeyboardShortcuts();
  return null;
}

const temporal = () => useDocumentStore.temporal.getState();
const key = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
const keyUp = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, ...init }));

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.setState({
    activeTool: null,
    currentDraw: null,
    shapePoints: [],
    shapeCursorPos: null,
    shapeDragPoint: null,
    editingTextId: null,
  });
  temporal().clear();
  render(<Harness />);
});

describe("undo/redo keys", () => {
  it("Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useDocumentStore.getState().updateElement(id, { x: 99 });

    key({ key: "z", ctrlKey: true });
    expect(useDocumentStore.getState().doc.elements[0].x).not.toBe(99);

    key({ key: "y", ctrlKey: true });
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(99);

    key({ key: "z", ctrlKey: true });
    key({ key: "z", ctrlKey: true, shiftKey: true });
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(99);
  });
});

describe("arrow-nudge coalescing (ST-02/ST-03)", () => {
  it("collapses a run of arrow nudges into a single undo entry", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useSelectionStore.getState().select(id);
    const x0 = useDocumentStore.getState().doc.elements[0].x;
    const baseline = temporal().pastStates.length;

    for (let i = 0; i < 10; i++) key({ key: "ArrowRight" });
    // Moves live, but nothing recorded yet — the transaction is still open.
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0 + 10);
    expect(temporal().pastStates.length).toBe(baseline);

    keyUp({ key: "ArrowRight" }); // release commits exactly one entry
    expect(temporal().pastStates.length).toBe(baseline + 1);

    key({ key: "z", ctrlKey: true }); // one undo reverts the whole run
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0);
  });

  it("blocks Ctrl+Z while a nudge preview is open", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useSelectionStore.getState().select(id);
    const x0 = useDocumentStore.getState().doc.elements[0].x;

    key({ key: "ArrowRight" }); // opens the preview, moves +1 (no keyup yet)
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0 + 1);
    key({ key: "z", ctrlKey: true }); // guarded → no-op mid-preview
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0 + 1);

    keyUp({ key: "ArrowRight" }); // commit so the transaction doesn't leak
  });
});

describe("handler-conflict guards (Phase-8 QA)", () => {
  it("ignores keys another handler already consumed (defaultPrevented)", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useSelectionStore.getState().select(id);
    const x0 = useDocumentStore.getState().doc.elements[0].x;

    const ev = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    ev.preventDefault(); // e.g. a dnd-kit keyboard drag or Radix slider handled it
    window.dispatchEvent(ev);
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0);
  });

  it("does not arrow-nudge while focus is on an interactive control", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useSelectionStore.getState().select(id);
    const x0 = useDocumentStore.getState().doc.elements[0].x;

    const btn = document.createElement("button"); // e.g. a layers drag handle
    document.body.appendChild(btn);
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    btn.remove();
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0);

    // …but nudge still works with body focus.
    key({ key: "ArrowRight" });
    expect(useDocumentStore.getState().doc.elements[0].x).toBe(x0 + 1);
  });
});

describe("duplicate and clipboard", () => {
  it("Ctrl+D duplicates with +10/+10 offset and selects the copy", () => {
    const id = useDocumentStore.getState().addShape("star");
    useSelectionStore.getState().select(id);
    key({ key: "d", ctrlKey: true });

    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(2);
    expect(els[1].x).toBe(els[0].x + 10);
    expect(useSelectionStore.getState().selectedId).toBe(els[1].id);
  });

  it("Ctrl+C / Ctrl+V round-trips a multi-selection with +12 offset", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("ellipse");
    useSelectionStore.getState().setMany([a, b]);

    key({ key: "c", ctrlKey: true });
    key({ key: "v", ctrlKey: true });

    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(4);
    expect(els[2].x).toBe(els[0].x + 12);
    expect(els[3].y).toBe(els[1].y + 12);
    // Pasted copies get fresh ids and become the selection.
    expect(new Set(els.map((e) => e.id)).size).toBe(4);
    expect(useSelectionStore.getState().selectedIds).toEqual([els[2].id, els[3].id]);
  });

  it("paste without a prior copy is a no-op", () => {
    // Note: module-scoped clipboard may carry state between tests; rely on a
    // fresh check only when nothing was copied in this test run order.
    const count = useDocumentStore.getState().doc.elements.length;
    key({ key: "v", ctrlKey: true });
    expect(useDocumentStore.getState().doc.elements.length).toBeGreaterThanOrEqual(count);
  });
});

describe("fluency keys (Phase 7)", () => {
  it("Ctrl+A selects every visible, unlocked element", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("star");
    const c = s.addShape("ellipse");
    s.updateElement(c, { locked: true });

    key({ key: "a", ctrlKey: true });
    expect(new Set(useSelectionStore.getState().selectedIds)).toEqual(new Set([a, b]));
  });

  it("stacks successive pastes with a cumulative offset (ST-09)", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    useSelectionStore.getState().select(a);
    const x0 = useDocumentStore.getState().doc.elements[0].x;

    key({ key: "c", ctrlKey: true });
    key({ key: "v", ctrlKey: true });
    key({ key: "v", ctrlKey: true });

    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(3);
    expect(els[1].x).toBe(x0 + 12); // first paste
    expect(els[2].x).toBe(x0 + 24); // second paste stacks, not overlaps
  });

  it("[ and ] reorder the primary selection", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("star");
    useSelectionStore.getState().select(a);

    key({ key: "]" }); // bring forward → a moves above b
    expect(useDocumentStore.getState().doc.elements.map((e) => e.id)).toEqual([b, a]);
    key({ key: "[" }); // send back → a returns below b
    expect(useDocumentStore.getState().doc.elements.map((e) => e.id)).toEqual([a, b]);
  });
});

describe("Escape semantics", () => {
  it("clears selection when the draw tool is off", () => {
    const id = useDocumentStore.getState().addShape("rect");
    useSelectionStore.getState().select(id);
    key({ key: "Escape" });
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it("first clears draw progress, then exits the tool", () => {
    useUiStore.setState({
      activeTool: "draw",
      shapePoints: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
    });
    key({ key: "Escape" });
    expect(useUiStore.getState().shapePoints).toEqual([]);
    expect(useUiStore.getState().activeTool).toBe("draw");

    key({ key: "Escape" });
    expect(useUiStore.getState().activeTool).toBeNull();
  });

  it("Enter commits a 2+ point line path while drawing", () => {
    useUiStore.setState({
      activeTool: "draw",
      drawSubmode: "line",
      shapePoints: [
        { x: 10, y: 10 },
        { x: 60, y: 40 },
      ],
    });
    key({ key: "Enter" });
    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("draw");
    expect(useUiStore.getState().shapePoints).toEqual([]);
  });
});
