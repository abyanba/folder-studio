/**
 * 5e behaviors: layer-order application,
 * legacy gallery-snapshot migration, gallery persistence, and undoable
 * multi-select editing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelectPanel } from "@/components/panels/MultiSelectPanel";
import { LayersPanel, getElementLabel } from "@/components/panels/LayersPanel";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";
import { createTextElement } from "@/lib/elementFactories";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";
import { useSelectionStore } from "@/store/selectionStore";
import { isGradient, type Gradient } from "@/types/gradient";
import type { ShapeElement, TextElement } from "@/types/element";

const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  localStorage.clear();
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  temporal().clear();
});

describe("applyLayerOrder", () => {
  function seed(): string[] {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("ellipse");
    const c = s.addShape("star");
    useDocumentStore.setState((st) => ({ doc: { ...st.doc, patternLayerZ: 1 } }));
    return [a, b, c]; // bottom → top
  }

  it("derives element order and patternLayerZ from top-first keys", () => {
    const [a, b, c] = seed();
    // Current display (top-first): c, b, __pattern__, a  (tz=1 → one below).
    // Move the pattern to the very top.
    useDocumentStore.getState().applyLayerOrder(["__pattern__", c, b, a]);
    let doc = useDocumentStore.getState().doc;
    expect(doc.patternLayerZ).toBe(3);
    expect(doc.elements.map((e) => e.id)).toEqual([a, b, c]);

    // Move element c below everything, pattern to the bottom.
    useDocumentStore.getState().applyLayerOrder([b, a, c, "__pattern__"]);
    doc = useDocumentStore.getState().doc;
    expect(doc.patternLayerZ).toBe(0);
    expect(doc.elements.map((e) => e.id)).toEqual([c, a, b]);
  });

  it("is one undo entry and ignores incomplete key sets", () => {
    const [a, b, c] = seed();
    const baseline = temporal().pastStates.length;
    useDocumentStore.getState().applyLayerOrder([a, b, c, "__pattern__"]);
    expect(temporal().pastStates.length).toBe(baseline + 1);

    const before = useDocumentStore.getState().doc.elements.map((e) => e.id);
    useDocumentStore.getState().applyLayerOrder([a, b]); // missing c → no-op
    expect(useDocumentStore.getState().doc.elements.map((e) => e.id)).toEqual(before);
  });

  it("renders rows top-first", () => {
    const [a, , c] = seed();
    render(<LayersPanel />);
    const labels = screen.getAllByText(/Shape \d/).map((n) => n.textContent);
    expect(labels).toEqual(["Shape 3", "Shape 2", "Shape 1"]);
    expect(a).toBeTruthy();
    expect(c).toBeTruthy();
  });
});

describe("LayersPanel inline multi-select section", () => {
  it("hides the group section with a single selection", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    s.addShape("star");
    useSelectionStore.getState().select(a);
    render(<LayersPanel />);
    expect(screen.queryByText(/^\d+ selected$/)).toBeNull();
  });

  it("renders the group-edit controls inline once 2+ layers are selected", () => {
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("star");
    useSelectionStore.getState().setMany([a, b]);
    render(<LayersPanel />);
    // The Layers list and the inline "N selected" group section coexist.
    expect(screen.getByRole("heading", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete All \(2\)/ })).toBeInTheDocument();
  });
});

describe("getElementLabel", () => {
  it("prefers text content for default-named text elements", () => {
    const el = { ...createTextElement(), text: "Hello world this is long text" };
    expect(getElementLabel(el)).toBe("Hello world this i");
    const named: TextElement = { ...el, name: "My caption" };
    expect(getElementLabel(named)).toBe("My caption");
  });
});

describe("normalizeLegacySnapshot", () => {
  const legacySnap = {
    baseShape: "windows",
    colorMode: "gradient",
    hue: 45,
    sat: 0.85,
    bri: 0.96,
    gradStops: [
      { id: 0, pos: 0, hue: 200, sat: 0.8, bri: 0.9 },
      { id: 1, pos: 1, hue: 160, sat: 0.6, bri: 0.7 },
    ],
    gradType: "radial",
    gradAngle: 45,
    elements: [
      {
        id: 3,
        type: "shape",
        shapeType: "star",
        x: 10,
        y: 20,
        width: 80,
        height: 80,
        rotation: 15,
        opacity: 0.9,
        fillColor: {
          _g: true, type: "linear", angle: 90, stops: [
            { id: 0, pos: 0, hue: 10, sat: 1, bri: 1 },
            { id: 1, pos: 1, hue: 50, sat: 1, bri: 1 },
          ]
        },
        fillEnabled: true,
        strokeColor: "#112233",
        strokeEnabled: true,
        strokeWidth: 4,
      },
      {
        id: 7,
        type: "text",
        text: "Docs",
        x: 0,
        y: 0,
        width: 100,
        height: 30,
        rotation: 0,
        opacity: 1,
        textColor: "#ffffff",
        textAlign: "left",
        fontFamily: "Outfit",
        fontSize: 22,
        fontWeight: 700,
        fontStyle: "normal",
      },
    ],
    iconStroke: 1.5,
    iconColor: "#ffcc00",
    // Legacy on-disk format spells these `texture*` — the migration reads that
    // spelling for pre-rename snapshots (see legacySnapshot.ts).
    texture: "dots",
    textureOpacity: 0.5,
    textureScale: 2,
    textureColor: "#000000",
  };

  it("migrates folder fill, pattern, and elements into the typed document", () => {
    const doc = normalizeLegacySnapshot(legacySnap);
    expect(doc.baseShape).toBe("windows");
    expect(isGradient(doc.folderColor)).toBe(true);
    const g = doc.folderColor as Gradient;
    expect(g.kind).toBe("radial");
    expect(g.stops.map((s) => s.id)).toEqual(["0", "1"]);

    expect(doc.elements).toHaveLength(2);
    const shape = doc.elements[0] as ShapeElement;
    expect(shape.id).toBe("el3");
    expect(shape.type).toBe("shape");
    expect(isGradient(shape.fill.color)).toBe(true);
    expect(shape.stroke.enabled).toBe(true);
    expect(shape.visible).toBe(true); // filled base field
    expect(shape.scaleX).toBe(1);

    const text = doc.elements[1] as TextElement;
    expect(text.id).toBe("el7");
    expect(text.color).toBe("#ffffff");
    expect(text.align).toBe("left");
    expect(text.fontWeight).toBe("700");
  });

  it("solid mode converts hue/sat/bri to hex and garbage falls back to defaults", () => {
    const doc = normalizeLegacySnapshot({ colorMode: "solid", hue: 0, sat: 0, bri: 1, elements: [] });
    expect(doc.folderColor).toBe("#ffffff");
    expect(normalizeLegacySnapshot(null).baseShape).toBe("windows");
    expect(normalizeLegacySnapshot("junk").elements).toEqual([]);
  });

  it("passes new-format snapshots through with defaults filled", () => {
    const current = useDocumentStore.getState().doc;
    const doc = normalizeLegacySnapshot({ ...current, baseShape: "macos" });
    expect(doc.baseShape).toBe("macos");
    expect(doc.folderFillMode).toBe("color");
  });
});

describe("galleryStore", () => {
  it("adds (capped at 20), persists to fs_gallery, and removes", () => {
    const doc = useDocumentStore.getState().doc;
    for (let i = 0; i < 22; i++) {
      useGalleryStore.getState().addItem(`data:image/png;base64,${i}`, doc);
    }
    expect(useGalleryStore.getState().items).toHaveLength(20);
    const stored = JSON.parse(localStorage.getItem("fs_gallery")!);
    expect(stored).toHaveLength(20);

    const first = useGalleryStore.getState().items[0];
    useGalleryStore.getState().removeItem(first.id);
    expect(useGalleryStore.getState().items).toHaveLength(19);
  });
});

describe("MultiSelectPanel", () => {
  it("edits all selected elements as ONE undo entry (legacy was not undoable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ icons: {} }) }));
    const user = userEvent.setup();
    const s = useDocumentStore.getState();
    const a = s.addShape("rect");
    const b = s.addShape("star");
    useSelectionStore.getState().setMany([a, b]);
    render(<MultiSelectPanel />);
    const baseline = temporal().pastStates.length;

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByText(/shape × 2/i)).toBeInTheDocument();

    // Keyboard step on the opacity slider commits once for both elements.
    const sliders = screen.getAllByRole("slider");
    sliders[0].focus();
    await user.keyboard("{ArrowLeft}");
    const doc = useDocumentStore.getState().doc;
    const opacities = doc.elements.map((e) => e.opacity);
    expect(opacities[0]).toBeCloseTo(0.95);
    expect(opacities[0]).toBe(opacities[1]);
    expect(temporal().pastStates.length).toBe(baseline + 1);

    temporal().undo();
    expect(useDocumentStore.getState().doc.elements.map((e) => e.opacity)).toEqual([1, 1]);
  });
});
