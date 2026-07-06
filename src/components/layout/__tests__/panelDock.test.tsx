/**
 * PanelDock precedence (IN-13): a multi-selection overrides an element panel,
 * but an explicit Layers/Gallery choice stays reachable.
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

  it("keeps Layers reachable during a multi-selection (IN-13)", () => {
    selectTwo();
    useUiStore.getState().setActivePanel("layers");
    renderDock();
    expect(screen.getByRole("heading", { name: "Layers" })).toBeInTheDocument();
    expect(screen.queryByText("2 selected")).toBeNull();
  });
});
