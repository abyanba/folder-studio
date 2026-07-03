import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconRail } from "@/components/layout/IconRail";
import { PanelDock } from "@/components/layout/PanelDock";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

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

  it("switches the docked panel when a rail tool is clicked", () => {
    render(
      <TooltipProvider>
        <IconRail />
        <PanelDock />
      </TooltipProvider>,
    );
    // default active panel is "shape"
    expect(screen.getByRole("heading", { name: "Shape" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    expect(screen.getByRole("heading", { name: "Color" })).toBeInTheDocument();
    // clicking the active tool again closes the panel
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    expect(screen.queryByRole("heading", { name: "Color" })).not.toBeInTheDocument();
  });
});
