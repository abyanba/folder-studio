/**
 * Workspace interactive flows (Phase 7): the contentEditable text-editing
 * lifecycle on ElementView, and the element context menu's store effects.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElementView } from "@/components/workspace/ElementView";
import { ElementContextMenu } from "@/components/workspace/ElementContextMenu";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { TextElement } from "@/types/element";

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.setState({ editingTextId: null, blendPreview: null });
  useDocumentStore.temporal.getState().clear();
});

function renderTextElement() {
  const id = useDocumentStore.getState().addText();
  const el = useDocumentStore.getState().doc.elements[0] as TextElement;
  const { container, rerender } = render(
    <ElementView el={el} onPointerDown={() => {}} />,
  );
  return { id, el, container, rerender };
}

describe("text editing lifecycle", () => {
  it("a double press enters editing mode and focuses the contentEditable", () => {
    const { container } = renderTextElement();
    const node = container.querySelector("[data-element-id]")!;
    // Editing is entered from two quick pointerdowns, NOT the DOM `dblclick`
    // event: pointer capture on the workspace plus the selecting click between
    // the two presses make `dblclick` unreliable, while pointerdown always
    // reaches the element. Two presses within DBL_MS = enter edit mode.
    fireEvent.pointerDown(node);
    fireEvent.pointerDown(node);
    expect(useUiStore.getState().editingTextId).toBe(
      useDocumentStore.getState().doc.elements[0].id,
    );
    // Without an explicit focus, keystrokes after entering edit mode go
    // nowhere (Phase-8 QA regression).
    const editable = container.querySelector("[contenteditable=true]") as HTMLElement;
    expect(editable).toBeTruthy();
    expect(document.activeElement).toBe(editable);
  });

  it("a single press selects but does not enter editing", () => {
    const { container } = renderTextElement();
    fireEvent.pointerDown(container.querySelector("[data-element-id]")!);
    expect(useUiStore.getState().editingTextId).toBeNull();
  });

  it("blur commits the edited text as one patch", () => {
    const { id, container } = renderTextElement();
    useUiStore.getState().setEditingTextId(id);
    const editable = container.querySelector("[contenteditable]") as HTMLElement;
    editable.innerText = "Renamed";
    fireEvent.blur(editable);

    const el = useDocumentStore.getState().doc.elements[0] as TextElement;
    expect(el.text).toBe("Renamed");
    expect(useUiStore.getState().editingTextId).toBeNull();
  });

  it("blurring with empty text removes the element", () => {
    const { id, container } = renderTextElement();
    useUiStore.getState().setEditingTextId(id);
    const editable = container.querySelector("[contenteditable]") as HTMLElement;
    editable.innerText = "   ";
    fireEvent.blur(editable);
    expect(useDocumentStore.getState().doc.elements).toHaveLength(0);
  });
});

describe("element context menu", () => {
  function setup() {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("star");
    render(
      <ElementContextMenu>
        <div>
          <div data-element-id={a}>rect target</div>
          <div data-element-id={b}>star target</div>
        </div>
      </ElementContextMenu>,
    );
    return { a, b };
  }

  it("right-click selects the target and Duplicate clones it", async () => {
    const user = userEvent.setup();
    const { a } = setup();
    fireEvent.contextMenu(screen.getByText("rect target"));
    expect(useSelectionStore.getState().selectedId).toBe(a);

    await user.click(await screen.findByText("Duplicate"));
    const els = useDocumentStore.getState().doc.elements;
    expect(els).toHaveLength(3);
    expect(useSelectionStore.getState().selectedId).toBe(els[2].id);
  });

  it("z-order, lock, hide, and delete all hit the store", async () => {
    const user = userEvent.setup();
    const { a, b } = setup();

    fireEvent.contextMenu(screen.getByText("rect target"));
    await user.click(await screen.findByText("Bring to front"));
    expect(useDocumentStore.getState().doc.elements.map((e) => e.id)).toEqual([b, a]);

    fireEvent.contextMenu(screen.getByText("rect target"));
    await user.click(await screen.findByText("Lock"));
    expect(useDocumentStore.getState().doc.elements.find((e) => e.id === a)!.locked).toBe(true);

    fireEvent.contextMenu(screen.getByText("star target"));
    await user.click(await screen.findByText("Hide"));
    expect(useDocumentStore.getState().doc.elements.find((e) => e.id === b)!.visible).toBe(false);

    fireEvent.contextMenu(screen.getByText("star target"));
    await user.click(await screen.findByText("Delete"));
    expect(useDocumentStore.getState().doc.elements.map((e) => e.id)).toEqual([a]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });
});
