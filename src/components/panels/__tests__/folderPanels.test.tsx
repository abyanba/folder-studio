/**
 * Folder-panel behaviors (5b): base-shape defaults as one undo entry, fill
 * mode switching that preserves the uploaded image, texture selection/adjust,
 * and the image-pan math.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShapePanel } from "@/components/panels/ShapePanel";
import { TexturePanel } from "@/components/panels/TexturePanel";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { useDocumentStore } from "@/store/documentStore";
import { computeImagePan } from "@/lib/imagePan";
import { getHex } from "@/lib/color";
import { isGradient } from "@/types/gradient";

const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  useDocumentStore.getState().reset();
  temporal().clear();
});

describe("ShapePanel", () => {
  it("applies a shape with its defaults as one undo entry", async () => {
    const user = userEvent.setup();
    render(<ShapePanel />);
    const baseline = temporal().pastStates.length;

    await user.click(screen.getByRole("button", { name: /macOS/i }));

    const doc = useDocumentStore.getState().doc;
    expect(doc.baseShape).toBe("macos");
    expect(doc.clipToFolder).toBe(true);
    expect(doc.folderColor).toBe(getHex(203, 0.6, 0.86));
    expect(temporal().pastStates.length).toBe(baseline + 1);

    await user.click(screen.getByRole("button", { name: /Classic/i }));
    expect(useDocumentStore.getState().doc.clipToFolder).toBe(false);
    expect(useDocumentStore.getState().doc.folderColor).toBe("#ffffff");
  });
});

describe("ColorPanel fill modes", () => {
  it("switches solid → gradient → solid, preserving a sensible color", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />);

    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    let doc = useDocumentStore.getState().doc;
    expect(isGradient(doc.folderColor)).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Solid" }));
    doc = useDocumentStore.getState().doc;
    expect(doc.folderColor).toBe("#f5c542"); // first stop = the original solid
  });

  it("keeps the uploaded image when leaving image mode", () => {
    const { setFolderFill } = useDocumentStore.getState();
    setFolderFill({ folderBgImage: "data:image/png;base64,x", folderFillMode: "image" });
    setFolderFill({ folderFillMode: "color", folderColor: "#112233" });

    const doc = useDocumentStore.getState().doc;
    expect(doc.folderBgImage).toBe("data:image/png;base64,x");
    expect(doc.folderFillMode).toBe("color");
  });
});

describe("TexturePanel", () => {
  it("selects a texture, then opens adjust on second click", async () => {
    const user = userEvent.setup();
    render(<TexturePanel />);

    await user.click(screen.getByRole("button", { name: "Polka Dots" }));
    expect(useDocumentStore.getState().doc.texture.id).toBe("dots");

    await user.click(screen.getByRole("button", { name: "Polka Dots" }));
    expect(screen.getByText("Adjust Texture")).toBeInTheDocument();

    // Scatter texture → randomize toggles a non-zero seed, reroll changes it.
    await user.click(screen.getByRole("button", { name: /Randomize/i }));
    const seed1 = useDocumentStore.getState().doc.texture.seed;
    expect(seed1).not.toBe(0);
  });

  it("search filters the grid", async () => {
    const user = userEvent.setup();
    render(<TexturePanel />);
    await user.type(screen.getByRole("textbox", { name: "Search textures" }), "zig");
    expect(screen.getByRole("button", { name: "Zigzag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Polka Dots" })).toBeNull();
  });
});

describe("computeImagePan", () => {
  it("is inert at zoom 1", () => {
    expect(
      computeImagePan({ dx: 50, dy: 50, width: 200, height: 200, zoom: 1, startX: 50, startY: 50 }),
    ).toEqual({ x: 50, y: 50 });
  });

  it("pans opposite the pointer delta and clamps to 0..100", () => {
    const r = computeImagePan({
      dx: 100,
      dy: -100,
      width: 200,
      height: 200,
      zoom: 2,
      startX: 50,
      startY: 50,
    });
    expect(r.x).toBe(0); // 50 - (100/200)*100*(1/2)*2 = 0
    expect(r.y).toBe(100);

    const clamped = computeImagePan({
      dx: 1000,
      dy: 0,
      width: 200,
      height: 200,
      zoom: 2,
      startX: 50,
      startY: 50,
    });
    expect(clamped.x).toBe(0);
  });
});
