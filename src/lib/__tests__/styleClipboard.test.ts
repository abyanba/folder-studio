// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  copyElementStyle,
  hasStyleClipboard,
  pasteElementStyle,
  __resetStyleClipboardForTests,
} from "@/lib/styleClipboard";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { createShapeElement, createTextElement } from "@/lib/elementFactories";
import type { DropShadow, TextElement } from "@/types/element";

const SHADOW: DropShadow = { x: 2, y: 4, blur: 6, color: "#000", opacity: 0.5 };

function setElements(...els: import("@/types/element").FolderElement[]) {
  useDocumentStore.setState({ doc: { ...useDocumentStore.getState().doc, elements: els } });
}

beforeEach(() => {
  __resetStyleClipboardForTests();
  useSelectionStore.getState().clear();
});

describe("style clipboard", () => {
  it("copies full style same-type and clears missing keys (replace semantics)", () => {
    const src = { ...createTextElement(), color: "#ff0000", shadow: SHADOW } as TextElement;
    const tgt = { ...createTextElement(), innerShadow: SHADOW } as TextElement;
    setElements(src, tgt);

    copyElementStyle(src);
    expect(hasStyleClipboard()).toBe(true);
    useSelectionStore.getState().setMany([tgt.id]);
    pasteElementStyle();

    const after = useDocumentStore.getState().doc.elements.find((e) => e.id === tgt.id) as TextElement;
    expect(after.color).toBe("#ff0000");
    expect(after.shadow).toEqual(SHADOW);
    expect(after.innerShadow).toBeUndefined(); // cleared: src had none
    expect(after.text).toBe(tgt.text); // content untouched
  });

  it("maps outer shadow + color across types (text -> shape)", () => {
    const src = { ...createTextElement(), color: "#00ff00", shadow: SHADOW } as TextElement;
    const tgt = createShapeElement();
    setElements(src, tgt);

    copyElementStyle(src);
    useSelectionStore.getState().setMany([tgt.id]);
    pasteElementStyle();

    const after = useDocumentStore.getState().doc.elements.find((e) => e.id === tgt.id);
    if (after?.type !== "shape") throw new Error("expected shape");
    expect(after.dropShadow).toEqual(SHADOW); // text.shadow -> shape.dropShadow
    expect(after.fill.color).toBe("#00ff00"); // text.color -> shape.fill.color
  });
});
