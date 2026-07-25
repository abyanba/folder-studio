// @vitest-environment node
/**
 * The shapes trimmed out of the picker (`_ENABLED_SHAPES`) still render, because
 * saved designs on them must keep loading. Exercise both fill branches of each
 * so a refactor of the shared gradient/mask helpers can't silently break them.
 */
import { describe, expect, it } from "vitest";
import { buildBaseShapeSvg, getBaseShapeMask } from "@/lib/export/baseShapes";
import { createEmptyDocument } from "@/types/document";
import type { Gradient } from "@/types/gradient";

const grad = (kind: "linear" | "radial"): Gradient => ({
  kind,
  angle: 135,
  stops: [
    { id: "0", pos: 0, hue: 12, sat: 0.7, bri: 0.98 },
    { id: "1", pos: 1, hue: 200, sat: 0.5, bri: 0.6 },
  ],
});

describe.each(["glass", "minimal", "file-folder", "classic", "layered", "front", "rounded", "open"])(
  "hidden base shape %s",
  (id) => {
    const doc = (over: object = {}) => ({ ...createEmptyDocument(), baseShape: id, ...over });

    it("renders a solid fill", () => {
      const svg = buildBaseShapeSvg(doc({ folderColor: "#4488cc" }));
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("</svg>");
    });

    it("renders linear and radial gradient fills", () => {
      for (const kind of ["linear", "radial"] as const) {
        const svg = buildBaseShapeSvg(doc({ folderColor: grad(kind) }));
        expect(svg).toContain(`${kind}Gradient`);
      }
    });

    it("has a silhouette mask", () => {
      expect(getBaseShapeMask(id)).toContain("<svg");
    });
  },
);
