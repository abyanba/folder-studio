/**
 * Element-panel wiring (5c): typed add-actions (naming/numbering, one undo
 * entry, returned id), TextPanel/ShapesPanel editor flows, and the image
 * blend-mode hover preview plumbing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextPanel } from "@/components/panels/TextPanel";
import { ShapesPanel } from "@/components/panels/ShapesPanel";
import { ImagePanel } from "@/components/panels/ImagePanel";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { ShapeElement, TextElement } from "@/types/element";

const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.setState({ blendPreview: null });
  temporal().clear();
  // Silence the icon fetches some panels kick off in effects.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ icons: {} }) }));
});

describe("documentStore add actions", () => {
  it("numbers images and svg 'icons' independently (legacy naming)", () => {
    const s = useDocumentStore.getState();
    s.addImage("data:image/png;base64,x", 100, 100);
    s.addImage("data:image/png;base64,y", 100, 100);
    s.addImage("data:image/svg+xml;charset=utf-8,<svg/>", 24, 24);
    const names = useDocumentStore.getState().doc.elements.map((e) => e.name);
    expect(names).toEqual(["Image 1", "Image 2", "Icon 1"]);
  });

  it("addImage clamps to ≤55% of the content rect keeping aspect", () => {
    const s = useDocumentStore.getState();
    const id = s.addImage("data:image/png;base64,x", 1000, 500);
    const el = useDocumentStore.getState().doc.elements.find((e) => e.id === id)!;
    expect(el.width).toBeLessThanOrEqual(305 * 0.55 + 0.001);
    expect(el.width / el.height).toBeCloseTo(2);
  });

  it("each add is one undo entry and returns the new id", () => {
    const baseline = temporal().pastStates.length;
    const id = useDocumentStore.getState().addShape("star");
    expect(id).toMatch(/^el\d+$/);
    expect(temporal().pastStates.length).toBe(baseline + 1);
    temporal().undo();
    expect(useDocumentStore.getState().doc.elements).toHaveLength(0);
  });
});

describe("TextPanel", () => {
  it("adds a text element, selects it, and edits content", async () => {
    const user = userEvent.setup();
    render(<TextPanel />);
    await user.click(screen.getByRole("button", { name: /Add Text Element/i }));

    const doc = useDocumentStore.getState().doc;
    expect(doc.elements).toHaveLength(1);
    expect(useSelectionStore.getState().selectedId).toBe(doc.elements[0].id);

    const textarea = screen.getByRole("textbox", { name: "Text content" });
    await user.clear(textarea);
    await user.type(textarea, "Hi");
    const el = useDocumentStore.getState().doc.elements[0] as TextElement;
    expect(el.text).toBe("Hi");
  });

  it("bold toggle flips fontWeight 400/700", async () => {
    const user = userEvent.setup();
    render(<TextPanel />);
    await user.click(screen.getByRole("button", { name: /Add Text Element/i }));
    await user.click(screen.getByRole("button", { name: "Bold" }));
    let el = useDocumentStore.getState().doc.elements[0] as TextElement;
    expect(el.fontWeight).toBe("700");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    el = useDocumentStore.getState().doc.elements[0] as TextElement;
    expect(el.fontWeight).toBe("400");
  });
});

describe("ShapesPanel", () => {
  it("adds a shape from the grid and switches its type in the editor", async () => {
    const user = userEvent.setup();
    render(<ShapesPanel />);
    await user.click(screen.getByRole("button", { name: "Star" }));

    let el = useDocumentStore.getState().doc.elements[0] as ShapeElement;
    expect(el.shapeType).toBe("star");
    expect(el.name).toBe("Shape 1");

    // Editor replaces the grid; switch type to hexagon.
    await user.click(screen.getByRole("radio", { name: "Hexagon" }));
    el = useDocumentStore.getState().doc.elements[0] as ShapeElement;
    expect(el.shapeType).toBe("hexagon");
  });
});

describe("ImagePanel blend preview", () => {
  it("stores the hovered blend mode and clears it on select", async () => {
    const user = userEvent.setup();
    const id = useDocumentStore.getState().addImage("data:image/png;base64,x", 50, 50);
    useSelectionStore.getState().select(id);
    render(<ImagePanel />);

    await user.click(screen.getByRole("button", { name: /Normal/ }));
    const item = await screen.findByText("Multiply");
    await user.hover(item);
    expect(useUiStore.getState().blendPreview).toBe("multiply");

    await user.click(item);
    expect(useUiStore.getState().blendPreview).toBeNull();
    const el = useDocumentStore.getState().doc.elements[0];
    expect(el.type === "image" && el.blendMode).toBe("multiply");
  });
});
