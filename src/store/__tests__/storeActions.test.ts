// @vitest-environment node
/**
 * Coverage-fill for store actions the interactive tests don't reach (Phase 7):
 * alignment/flip/z-order/toggles/folder setters on documentStore, the plain
 * uiStore setters, plus geometry handle branches and every base-shape
 * generator.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "@/store/documentStore";
import { useUiStore } from "@/store/uiStore";
import { resizeElement, rotateAngle, snapMove } from "@/lib/geometry";
import { BASE_SHAPES, buildBaseShapeSvg, getBaseShapeMask } from "@/lib/export/baseShapes";
import { createEmptyDocument } from "@/types/document";

const store = () => useDocumentStore.getState();

beforeEach(() => {
  store().reset();
  useDocumentStore.temporal.getState().clear();
});

function addRect(x: number, y: number, w = 40, h = 20): string {
  const id = store().addShape("rect");
  store().updateElement(id, { x, y, width: w, height: h });
  return id;
}

describe("documentStore alignment", () => {
  it("aligns left/center/right/top/middle/bottom within the content rect", () => {
    const id = addRect(50, 50, 40, 20);
    const cases: Array<[string, Partial<{ x: number; y: number }>]> = [
      ["left", { x: 0 }],
      ["center", { x: 305 / 2 - 20 }],
      ["right", { x: 305 - 40 }],
      ["top", { y: 0 }],
      ["middle", { y: 200 / 2 - 10 }],
      ["bottom", { y: 200 - 20 }],
    ];
    for (const [dir, want] of cases) {
      store().align([id], dir as never);
      const el = store().doc.elements[0];
      if (want.x !== undefined) expect(el.x, dir).toBeCloseTo(want.x);
      if (want.y !== undefined) expect(el.y, dir).toBeCloseTo(want.y);
    }
  });

  it("distributes horizontal/vertical gaps across 3+ elements", () => {
    const a = addRect(0, 0);
    const b = addRect(200, 100);
    const c = addRect(90, 40);
    store().align([a, b, c], "distH");
    const [, , mid] = store().doc.elements;
    // Middle element centered between outer edges: gap = (240-120)/2 = 60 → x = 100.
    expect(mid.x).toBeCloseTo(100);

    store().align([a, b, c], "distV");
    const midV = store().doc.elements.find((e) => e.id === c)!;
    expect(midV.y).toBeCloseTo(50); // (120-60)/2 = 30 gap → 20+30 = 50
  });

  it("flip toggles scale factors per axis", () => {
    const id = addRect(0, 0);
    store().flip([id], "h");
    expect(store().doc.elements[0].scaleX).toBe(-1);
    store().flip([id], "v");
    expect(store().doc.elements[0].scaleY).toBe(-1);
    store().flip([id], "h");
    expect(store().doc.elements[0].scaleX).toBe(1);
  });
});

describe("documentStore ordering and toggles", () => {
  it("moveUp/moveDown/bringToFront/sendToBack respect bounds", () => {
    const a = addRect(0, 0);
    const b = addRect(10, 10);
    const c = addRect(20, 20);
    const order = () => store().doc.elements.map((e) => e.id);

    store().moveUp(a);
    expect(order()).toEqual([b, a, c]);
    store().moveDown(c);
    expect(order()).toEqual([b, c, a]);
    store().moveUp(a); // already top → no-op
    expect(order()).toEqual([b, c, a]);
    store().moveDown(b); // already bottom → no-op
    expect(order()).toEqual([b, c, a]);
    store().bringToFront(b);
    expect(order()).toEqual([c, a, b]);
    store().sendToBack(b);
    expect(order()).toEqual([b, c, a]);
    store().reorder(b, a); // b takes a's index (splice semantics)
    expect(order()).toEqual([c, a, b]);
    store().reorder(b, b); // self → no-op
    expect(order()).toEqual([c, a, b]);
  });

  it("toggleLock/toggleVisible flip flags; removeElements adjusts patternLayerZ", () => {
    const a = addRect(0, 0);
    const b = addRect(10, 10);
    store().toggleLock(a);
    store().toggleVisible(b);
    expect(store().doc.elements[0].locked).toBe(true);
    expect(store().doc.elements[1].visible).toBe(false);

    useDocumentStore.setState((s) => ({ doc: { ...s.doc, patternLayerZ: 2 } }));
    store().removeElements([a]); // below the pattern → tz shifts down
    expect(store().doc.patternLayerZ).toBe(1);
    expect(store().doc.elements.map((e) => e.id)).toEqual([b]);
  });

  it("duplicateElement returns null for unknown ids", () => {
    expect(store().duplicateElement("nope")).toBeNull();
  });

  it("moveGroup shifts a selection as a block, keeping relative order", () => {
    const a = addRect(0, 0);
    const b = addRect(10, 10);
    const c = addRect(20, 20);
    const d = addRect(30, 30);
    const order = () => store().doc.elements.map((e) => e.id);

    // {a,c} up one: each hops past the next unselected neighbor toward front.
    store().moveGroup([a, c], "up");
    expect(order()).toEqual([b, a, d, c]);
    store().moveGroup([a, c], "front");
    expect(order()).toEqual([b, d, a, c]);
    store().moveGroup([a, c], "back");
    expect(order()).toEqual([a, c, b, d]);
    store().moveGroup([a, c], "down"); // already at back → no-op
    expect(order()).toEqual([a, c, b, d]);
  });

  it("duplicateElements clones a set in one entry, offset by 10", () => {
    const a = addRect(5, 5);
    const b = addRect(15, 15);
    const newIds = store().duplicateElements([a, b]);
    expect(newIds).toHaveLength(2);
    expect(store().doc.elements).toHaveLength(4);
    const copy = store().doc.elements.find((e) => e.id === newIds[0])!;
    expect([copy.x, copy.y]).toEqual([15, 15]);
  });
});

describe("documentStore folder setters", () => {
  it("cover the one-line folder/pattern/icon-default setters", () => {
    store().setBaseShape("macos");
    store().setFolderOpacity(0.5);
    store().setFolderBgImage("data:x");
    store().setFolderBg({ folderBgZoom: 2 });
    store().setClipToFolder(false);
    store().setWindowsGradientAlgo("echo");
    store().setWindowsImageMode("front");
    store().setFolderBgOverlay({ folderBgOverlayColor: "#112233", folderBgOverlayOpacity: 0.4 });
    store().setFolderBackColor("#3a7bd5");
    store().setFolderState("contents");
    store().setFolderPaperColor("#7ec8ff");
    store().setIconDefaults({ stroke: 2 });
    store().setFolderColor("#123456");
    const doc = store().doc;
    expect(doc.baseShape).toBe("macos");
    expect(doc.folderOpacity).toBe(0.5);
    expect(doc.folderBgImage).toBe("data:x");
    expect(doc.folderBgZoom).toBe(2);
    expect(doc.clipToFolder).toBe(false);
    expect(doc.windowsGradientAlgo).toBe("echo");
    expect(doc.windowsImageMode).toBe("front");
    expect(doc.folderBgOverlayColor).toBe("#112233");
    expect(doc.folderBgOverlayOpacity).toBe(0.4);
    expect(doc.folderBackColor).toBe("#3a7bd5");
    expect(doc.folderState).toBe("contents");
    expect(doc.folderPaperColor).toBe("#7ec8ff");
    expect(doc.iconDefaults.stroke).toBe(2);
    expect(doc.folderColor).toBe("#123456");

    store().loadDocument(createEmptyDocument());
    expect(store().doc.baseShape).toBe("windows");
  });
});

describe("uiStore setters", () => {
  it("cover the plain setters and resetDrawProgress", () => {
    const ui = useUiStore.getState();
    ui.setEditingLayerName("el1");
    ui.setContextMenu({ x: 1, y: 2, elId: "el1" });
    ui.setDrag(null);
    ui.setBlendPreview("multiply");
    ui.setLogoMode("color");
    ui.setLogoColor("#ff0000");
    ui.setDrawMode("eraser");
    ui.setDrawColor("#00ff00");
    ui.setDrawSize(12);
    ui.setDrawOpacity(0.4);
    ui.setCurrentDraw({ points: [{ x: 0, y: 0 }], color: "#fff", size: 2, opacity: 1 });
    ui.setShapeCursorPos({ x: 5, y: 5 });
    ui.setShapeDragPoint({ x: 1, y: 1 });

    let s = useUiStore.getState();
    expect(s.editingLayerName).toBe("el1");
    expect(s.contextMenu?.elId).toBe("el1");
    expect(s.blendPreview).toBe("multiply");
    expect(s.logoMode).toBe("color");
    expect(s.logoColor).toBe("#ff0000");
    expect(s.drawMode).toBe("eraser");
    expect(s.drawSize).toBe(12);
    expect(s.drawOpacity).toBe(0.4);

    s.resetDrawProgress();
    s = useUiStore.getState();
    expect(s.currentDraw).toBeNull();
    expect(s.shapeCursorPos).toBeNull();
    expect(s.shapeDragPoint).toBeNull();
  });
});

describe("geometry branches", () => {
  const el = { x: 10, y: 10, width: 100, height: 60, rotation: 0 };

  it("covers every resize handle", () => {
    for (const handle of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const) {
      const out = resizeElement(el, handle, 10, 8);
      expect(out.width).toBeGreaterThanOrEqual(20);
      expect(out.height).toBeGreaterThanOrEqual(20);
    }
    // North keeps the south edge fixed.
    const n = resizeElement(el, "n", 0, -10);
    expect(n.y + n.height).toBeCloseTo(el.y + el.height);
    // Rotated resize keeps the opposite anchor fixed (se → nw corner).
    const rot = { ...el, rotation: 45 };
    const out = resizeElement(rot, "se", 12, 12);
    expect(out.width).toBeGreaterThan(el.width);
  });

  it("rotateAngle and snapMove cover their edges", () => {
    // Pointer straight above the center → 0° (top handle).
    expect(rotateAngle(50, 50, 50, -100)).toBeCloseTo(0);
    expect(rotateAngle(50, 50, 200, 50)).toBeCloseTo(90);
    // Element center exactly on the content-rect center → both axes snap.
    const res = snapMove({ x: 305 / 2 - 50 - 3, y: 200 / 2 - 20 + 3, width: 100, height: 40 }, [], 0, 0);
    expect(res.snapV).toBe(true);
    expect(res.snapH).toBe(true);
    expect(res.x).toBeCloseTo(305 / 2 - 50);
  });
});

describe("base-shape generators", () => {
  it("build every shape in solid and gradient modes with a mask", () => {
    const gradient = {
      kind: "linear" as const,
      angle: 45,
      stops: [
        { id: "a", pos: 0, hue: 10, sat: 0.9, bri: 1 },
        { id: "b", pos: 1, hue: 200, sat: 0.7, bri: 0.8 },
      ],
    };
    for (const shape of BASE_SHAPES) {
      const solidDoc = { ...createEmptyDocument(), baseShape: shape.id, folderColor: "#f5c542" };
      const gradDoc = { ...createEmptyDocument(), baseShape: shape.id, folderColor: gradient };
      const solid = buildBaseShapeSvg(solidDoc);
      const grad = buildBaseShapeSvg(gradDoc);
      expect(solid, shape.id).toContain("<svg");
      expect(solid).not.toContain("__COLOR__");
      expect(grad, shape.id).toContain("Gradient");
      expect(getBaseShapeMask(shape.id), shape.id).toContain("<svg");
    }
    // Unknown ids fall back gracefully.
    expect(getBaseShapeMask("nope")).toContain("<svg");
  });
});
