/**
 * The preview transaction behind slider/pad/picker drags: live store updates
 * during the gesture, exactly one undo entry on commit, and the entry's
 * "before" state is the document at gesture START (not the last preview).
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  beginDocPreview,
  endDocPreview,
  isDocPreviewActive,
  useDocumentStore,
} from "@/store/documentStore";
import { createShapeElement } from "@/lib/elementFactories";

const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  useDocumentStore.getState().reset();
  temporal().clear();
});

function addTestShape(): string {
  const el = createShapeElement("rect");
  useDocumentStore.getState().addElement(el);
  return el.id;
}

describe("doc preview transaction", () => {
  it("collapses many live updates into one undo entry with the pre-gesture doc", () => {
    const id = addTestShape();
    const baseline = temporal().pastStates.length;

    beginDocPreview();
    expect(isDocPreviewActive()).toBe(true);
    for (let v = 1; v <= 30; v++) {
      useDocumentStore.getState().updateElement(id, { opacity: 0.05 + (v / 30) * 0.45 });
    }
    endDocPreview();

    expect(isDocPreviewActive()).toBe(false);
    // Live final value stuck.
    const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(el.opacity).toBeCloseTo(0.5);
    // Exactly one new entry.
    expect(temporal().pastStates.length).toBe(baseline + 1);

    // Undo restores the PRE-GESTURE opacity (the factory default, 1).
    temporal().undo();
    const undone = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(undone.opacity).toBe(1);
  });

  it("undo after commit restores the gesture-start value, not the last preview", () => {
    const id = addTestShape();
    useDocumentStore.getState().updateElement(id, { rotation: 45 });

    beginDocPreview();
    useDocumentStore.getState().updateElement(id, { rotation: 90 });
    useDocumentStore.getState().updateElement(id, { rotation: 135 });
    endDocPreview();

    temporal().undo();
    const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(el.rotation).toBe(45);
  });

  it("records nothing when the gesture ends where it started", () => {
    const id = addTestShape();
    const baseline = temporal().pastStates.length;

    beginDocPreview();
    useDocumentStore.getState().updateElement(id, { opacity: 0.5 });
    useDocumentStore.getState().updateElement(id, { opacity: 1 });
    endDocPreview();

    expect(temporal().pastStates.length).toBe(baseline);
  });

  it("cancelling discards the preview entirely", () => {
    const id = addTestShape();
    const baseline = temporal().pastStates.length;

    beginDocPreview();
    useDocumentStore.getState().updateElement(id, { opacity: 0.25 });
    endDocPreview(false);

    const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(el.opacity).toBe(1);
    expect(temporal().pastStates.length).toBe(baseline);
  });

  it("nested begin calls don't restart the transaction", () => {
    const id = addTestShape();
    beginDocPreview();
    useDocumentStore.getState().updateElement(id, { opacity: 0.3 });
    beginDocPreview(); // should be a no-op, not re-snapshot at 0.3
    useDocumentStore.getState().updateElement(id, { opacity: 0.6 });
    endDocPreview();

    useDocumentStore.temporal.getState().undo();
    const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(el.opacity).toBe(1);
  });
});
