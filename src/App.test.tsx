import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconRail } from "@/components/layout/IconRail";
import { PanelDock } from "@/components/layout/PanelDock";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

// renderCanvas is browser-only (jsdom can't rasterize SVG onto a canvas);
// the toolbar save button goes through it to build the gallery thumbnail.
vi.mock("@/lib/export/renderCanvas", () => ({
  buildExportCanvas: vi.fn(async () => ({
    toDataURL: () => "data:image/png;base64,stub",
  })),
}));

function resetStores() {
  useDocumentStore.getState().reset();
  useDocumentStore.temporal.getState().clear();
  useSelectionStore.getState().clear();
  useUiStore.getState().setActivePanel("shape");
  useUiStore.getState().setEditingTextId(null);
}

beforeEach(resetStores);

describe("App shell", () => {
  it("renders the toolbar brand and undo/redo controls", () => {
    render(<App />);
    expect(screen.getByText("Folder Studio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("toggles clipping (undoable doc state) from the toolbar", () => {
    render(<App />);
    const btn = screen.getByRole("button", { name: "Clip to folder" });
    expect(useDocumentStore.getState().doc.clipToFolder).toBe(true);
    fireEvent.click(btn);
    expect(useDocumentStore.getState().doc.clipToFolder).toBe(false);
    fireEvent.click(btn);
    expect(useDocumentStore.getState().doc.clipToFolder).toBe(true);
  });

  it("toggles the light canvas preview from the toolbar", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Light canvas" }));
    expect(useUiStore.getState().canvasLight).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Dark canvas" }));
    expect(useUiStore.getState().canvasLight).toBe(false);
  });

  it("saves the current design to the gallery from the toolbar", async () => {
    localStorage.removeItem("fs_gallery");
    useGalleryStore.setState({ items: [] });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Save to gallery" }));
    await waitFor(() => expect(useGalleryStore.getState().items).toHaveLength(1));
    expect(useGalleryStore.getState().items[0].thumb).toMatch(/^data:image\/png/);
  });

  it("switches the docked panel when a rail tool is clicked", () => {
    render(
      <TooltipProvider>
        <IconRail />
        <PanelDock />
      </TooltipProvider>,
    );
    // default active panel is "shape"
    expect(screen.getByRole("heading", { name: "Base Shape" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    expect(screen.getByRole("heading", { name: "Folder Color" })).toBeInTheDocument();
    // clicking the active tool again closes the panel
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    expect(screen.queryByRole("heading", { name: "Folder Color" })).not.toBeInTheDocument();
  });
});
