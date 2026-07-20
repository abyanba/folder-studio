import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { __resetIdCounterForTests } from "@/lib/id";
import { createEmptyDocument } from "@/types/document";
import {
  createShapeElement,
  createTextElement,
} from "@/lib/elementFactories";
import { CDW } from "@/lib/constants";

const store = () => useDocumentStore.getState();
const doc = () => useDocumentStore.getState().doc;
const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  __resetIdCounterForTests();
  useDocumentStore.getState().reset();
  useDocumentStore.temporal.getState().clear();
  useSelectionStore.getState().clear();
});

describe("documentStore CRUD", () => {
  it("adds and updates elements", () => {
    const el = createShapeElement();
    store().addElement(el);
    expect(doc().elements).toHaveLength(1);

    store().updateElement(el.id, { x: 123 });
    expect(doc().elements[0].x).toBe(123);
  });

  it("removes elements and adjusts patternLayerZ", () => {
    const a = createShapeElement();
    const b = createShapeElement();
    const c = createShapeElement();
    store().loadDocument({
      ...createEmptyDocument(),
      elements: [a, b, c],
      patternLayerZ: 2,
    });
    store().removeElements([a.id]);
    expect(doc().elements.map((e) => e.id)).toEqual([b.id, c.id]);
    expect(doc().patternLayerZ).toBe(1);
  });

  it("duplicates with a +10 offset and a fresh id", () => {
    const el = createShapeElement();
    store().addElement(el);
    const newId = store().duplicateElement(el.id);
    expect(newId).toBeTruthy();
    const dup = doc().elements.find((e) => e.id === newId)!;
    expect(dup.x).toBe(el.x + 10);
    expect(dup.y).toBe(el.y + 10);
    expect(dup.id).not.toBe(el.id);
  });

  it("reorders via bringToFront / sendToBack", () => {
    const a = createShapeElement();
    const b = createShapeElement();
    const c = createShapeElement();
    store().loadDocument({ ...createEmptyDocument(), elements: [a, b, c] });
    store().bringToFront(a.id);
    expect(doc().elements.map((e) => e.id)).toEqual([b.id, c.id, a.id]);
    store().sendToBack(a.id);
    expect(doc().elements.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it("aligns selected elements horizontally to center", () => {
    const el = createTextElement();
    store().addElement(el);
    store().align([el.id], "center");
    expect(doc().elements[0].x).toBe(CDW / 2 - el.width / 2);
  });

  it("flips scaleX on the horizontal axis", () => {
    const el = createShapeElement();
    store().addElement(el);
    store().flip([el.id], "h");
    expect(doc().elements[0].scaleX).toBe(-1);
  });
});

describe("documentStore undo/redo (zundo temporal)", () => {
  it("undoes and redoes an add", () => {
    const el = createShapeElement();
    store().addElement(el);
    expect(doc().elements).toHaveLength(1);
    expect(temporal().pastStates.length).toBeGreaterThan(0);

    temporal().undo();
    expect(doc().elements).toHaveLength(0);

    temporal().redo();
    expect(doc().elements).toHaveLength(1);
  });

  it("does not record a no-op update (identical-state dedupe)", () => {
    const el = createShapeElement();
    store().addElement(el);
    const before = temporal().pastStates.length;
    store().updateElement(el.id, { x: el.x }); // same value
    expect(temporal().pastStates.length).toBe(before);
  });

  it("caps history at 50 entries", () => {
    const el = createShapeElement();
    store().addElement(el);
    for (let i = 1; i <= 60; i++) store().updateElement(el.id, { x: i });
    expect(temporal().pastStates.length).toBe(50);
  });

  it("does not revert selection on undo", () => {
    useSelectionStore.getState().select("keep-me");
    store().addElement(createShapeElement());
    temporal().undo();
    expect(useSelectionStore.getState().selectedId).toBe("keep-me");
  });
});
