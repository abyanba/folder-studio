/**
 * The left icon-rail tools → docked panels. `id` doubles as the `activePanel`
 * key in the UI store. `isTool` marks tools that also toggle a canvas mode
 * (draw) — that behavior wires up with its panel in Phase 5; here every entry
 * just toggles its panel.
 */

export interface ToolDef {
  id: string;
  label: string;
  isTool?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "shape", label: "Shape" },
  { id: "color", label: "Color" },
  { id: "image", label: "Image" },
  { id: "logos", label: "Logos" },
  { id: "icon", label: "Icons" },
  { id: "shapes", label: "Shapes" },
  { id: "text", label: "Text" },
  { id: "draw", label: "Free Draw", isTool: true },
  { id: "texture", label: "Texture" },
  { id: "layers", label: "Layers" },
  { id: "gallery", label: "Gallery" },
];
