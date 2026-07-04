/**
 * Upload paths with stubbed FileReader/Image, plus render+interaction smoke
 * for the panels the coverage report showed dark (icons, logos, draw, layer
 * rename) — Phase 7 gap tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagePanel } from "@/components/panels/ImagePanel";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { IconPanel } from "@/components/panels/IconPanel";
import { LogosPanel } from "@/components/panels/LogosPanel";
import { DrawPanel } from "@/components/panels/DrawPanel";
import { LayersPanel } from "@/components/panels/LayersPanel";
import { __resetIconCacheForTests } from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { IconElement, ImageElement } from "@/types/element";

class StubFileReader {
  onload: ((e: { target: { result: string } }) => void) | null = null;
  readAsDataURL(file: File) {
    queueMicrotask(() =>
      this.onload?.({ target: { result: `data:image/png;base64,${file.name}` } }),
    );
  }
}

class StubImage {
  onload: (() => void) | null = null;
  width = 800;
  height = 400;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.setState({ activeTool: null, editingLayerName: null });
  useDocumentStore.temporal.getState().clear();
  __resetIconCacheForTests();
  vi.stubGlobal("FileReader", StubFileReader);
  vi.stubGlobal("Image", StubImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImagePanel upload", () => {
  it("adds one clamped element per file and selects the last", async () => {
    render(<ImagePanel />);
    const input = screen.getByLabelText("Upload images") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["a"], "a.png"), new File(["b"], "b.png")],
      },
    });

    await waitFor(() =>
      expect(useDocumentStore.getState().doc.elements).toHaveLength(2),
    );
    const els = useDocumentStore.getState().doc.elements as ImageElement[];
    expect(els.map((e) => e.name)).toEqual(["Image 1", "Image 2"]);
    // 800×400 clamped to ≤55% of the content rect, aspect kept.
    expect(els[0].width).toBeLessThanOrEqual(305 * 0.55 + 0.001);
    expect(els[0].width / els[0].height).toBeCloseTo(2);
    expect(useSelectionStore.getState().selectedId).toBe(els[1].id);
    expect(input.value).toBe("");
  });
});

describe("ColorPanel background image", () => {
  it("upload sets the image + fill mode; remove reverts to color", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />);
    await user.click(screen.getByRole("tab", { name: "Image" }));
    expect(useDocumentStore.getState().doc.folderFillMode).toBe("image");

    fireEvent.change(screen.getByLabelText("Upload background image"), {
      target: { files: [new File(["bg"], "bg.png")] },
    });
    await waitFor(() =>
      expect(useDocumentStore.getState().doc.folderBgImage).toContain("bg.png"),
    );

    await user.click(screen.getByRole("button", { name: "Remove background image" }));
    const doc = useDocumentStore.getState().doc;
    expect(doc.folderBgImage).toBeNull();
    expect(doc.folderFillMode).toBe("color");
  });
});

describe("IconPanel", () => {
  it("renders the baked grid, adds an icon, and switches variants", async () => {
    const user = userEvent.setup();
    render(<IconPanel />);
    const house = await screen.findByRole("button", { name: "house" });
    await user.click(house);

    let el = useDocumentStore.getState().doc.elements[0] as IconElement;
    expect(el.type).toBe("icon");
    expect(el.iconName).toBe("house");
    expect(el.iconCacheKey).toBe("house");

    // Selected view: switch style to bold → cache key updates.
    await user.click(screen.getByRole("combobox", { name: "Icon style" }));
    await user.click(screen.getByRole("option", { name: "bold" }));
    el = useDocumentStore.getState().doc.elements[0] as IconElement;
    expect(el.iconVariant).toBe("bold");
    expect(el.iconCacheKey).toBe("house-bold");
  });

  it("search narrows the grid across categories", async () => {
    const user = userEvent.setup();
    render(<IconPanel />);
    await user.type(screen.getByRole("textbox", { name: "Search icons" }), "cloud-arrow");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "cloud-arrow-up" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "house" })).toBeNull();
    });
  });
});

describe("LogosPanel", () => {
  it("mono mode lists only simple-icons brands and adds a tintable icon", async () => {
    const user = userEvent.setup();
    render(<LogosPanel />);
    // Social: linkedin was removed from simple-icons → hidden in mono.
    expect(await screen.findByRole("button", { name: "Facebook" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "LinkedIn" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Facebook" }));
    const el = useDocumentStore.getState().doc.elements[0] as IconElement;
    expect(el.type).toBe("icon");
    expect(el.iconVariant).toBe("logo");
  });

  it("color mode shows removed brands and adds them as SVG images", async () => {
    const user = userEvent.setup();
    render(<LogosPanel />);
    await user.click(screen.getByRole("radio", { name: "Color" }));
    await user.click(screen.getByRole("button", { name: "LinkedIn" }));

    await waitFor(() => {
      const els = useDocumentStore.getState().doc.elements;
      expect(els).toHaveLength(1);
      expect(els[0].type).toBe("image");
      expect((els[0] as ImageElement).src).toContain("data:image/svg+xml");
      expect(els[0].name).toBe("LinkedIn");
    });
  });
});

describe("DrawPanel", () => {
  it("start/stop toggles the tool and mode/submode switches reset progress", async () => {
    const user = userEvent.setup();
    render(<DrawPanel />);
    await user.click(screen.getByRole("button", { name: /Start Drawing/i }));
    expect(useUiStore.getState().activeTool).toBe("draw");

    useUiStore.getState().setShapePoints([{ x: 1, y: 1 }]);
    await user.click(screen.getByRole("radio", { name: "Line" }));
    expect(useUiStore.getState().drawSubmode).toBe("line");
    expect(useUiStore.getState().shapePoints).toEqual([]);

    await user.click(screen.getByRole("radio", { name: /Eraser/i }));
    expect(useUiStore.getState().drawMode).toBe("eraser");

    await user.click(screen.getByRole("button", { name: /Stop Drawing/i }));
    expect(useUiStore.getState().activeTool).toBeNull();
  });
});

describe("LayersPanel rename", () => {
  it("double-click renames on Enter; Escape cancels", async () => {
    const user = userEvent.setup();
    const id = useDocumentStore.getState().addShape("rect");
    render(<LayersPanel />);

    await user.dblClick(screen.getByText("Shape 1"));
    const input = screen.getByRole("textbox", { name: "Layer name" });
    await user.clear(input);
    await user.type(input, "Hero{Enter}");
    expect(useDocumentStore.getState().doc.elements[0].name).toBe("Hero");

    await user.dblClick(screen.getByText("Hero"));
    const input2 = screen.getByRole("textbox", { name: "Layer name" });
    await user.clear(input2);
    await user.type(input2, "Nope{Escape}");
    expect(useDocumentStore.getState().doc.elements[0].name).toBe("Hero");
    expect(id).toBeTruthy();
  });
});
