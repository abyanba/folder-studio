/**
 * PanelDock precedence (IN-13): a multi-selection overrides an element panel,
 * but an explicit Layers/Gallery choice stays reachable. When Layers wins, its
 * own inline "N selected" group-edit section renders alongside the list (rather
 * than the standalone MultiSelectPanel replacing it).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PanelDock } from "@/components/layout/PanelDock";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

function renderDock() {
  return render(
    <TooltipProvider>
      <PanelDock />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useDocumentStore.getState().reset();
  useSelectionStore.getState().clear();
  useUiStore.getState().setActivePanel("shape");
});

describe("PanelDock", () => {
  function selectTwo() {
    const s = useDocumentStore.getState();
    useSelectionStore.getState().setMany([s.addShape("rect"), s.addShape("star")]);
  }

  it("shows the multi-select panel over an element panel", () => {
    selectTwo();
    useUiStore.getState().setActivePanel("shape");
    renderDock();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Base Shape" })).toBeNull();
  });

  it("keeps Layers reachable during a multi-selection (IN-13), with an inline group section", () => {
    selectTwo();
    useUiStore.getState().setActivePanel("layers");
    renderDock();
    // The Layers panel is NOT replaced by the standalone MultiSelectPanel...
    expect(screen.getByRole("heading", { name: "Layers" })).toBeInTheDocument();
    // ...but its own inline "N selected" group-edit section renders alongside it.
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});
