/**
 * Placeholder panel body shown in the dock during Phase 4. Each tool's real UI
 * (color/gradient picker, sliders, layer list, etc.) is built in Phase 5.
 */

import { TOOLS } from "@/components/layout/tools";

export function PanelStub({ id }: { id: string }) {
  const label = TOOLS.find((t) => t.id === id)?.label ?? id;
  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold">{label}</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        This panel’s controls arrive in Phase 5. The workspace, selection,
        interaction, undo/redo, and export are wired up now.
      </p>
    </div>
  );
}
