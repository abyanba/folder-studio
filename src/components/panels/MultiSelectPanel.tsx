/**
 * Multi-select editor: overrides the docked panel whenever 2+ elements are
 * selected (legacy L1974-2004), UNLESS a management panel (Layers/Gallery) is
 * active — in which case the same controls render inline in the Layers panel's
 * collapsible section instead. The shared body lives in `MultiSelectControls`.
 */

import { useSelectionStore } from "@/store/selectionStore";
import { MultiSelectControls } from "./MultiSelectControls";
import { PanelHeader } from "./PanelHeader";

export function MultiSelectPanel() {
  const count = useSelectionStore((s) => s.selectedIds.length);
  if (count < 2) return null;
  return (
    <div>
      <PanelHeader title={`${count} selected`} />
      <div className="p-3">
        <MultiSelectControls />
      </div>
    </div>
  );
}
