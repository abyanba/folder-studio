// @vitest-environment node
/**
 * The pattern feature was removed, but users' galleries still hold snapshots
 * that carry `pattern`/`texture` settings. They must load cleanly and must not
 * drag the retired fields back onto the live document.
 */

import { describe, expect, it } from "vitest";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";

describe("snapshots saved while patterns existed", () => {
  it("loads a new-format snapshot and drops the retired pattern fields", () => {
    const doc = normalizeLegacySnapshot({
      v: 2,
      baseShape: "windows",
      // `folderColor` + an elements array is what marks a snapshot new-format.
      folderColor: "#f5c542",
      pattern: { id: "stars", opacity: 0.4, scale: 1, seed: 7 },
      patternLayerZ: 1,
      elements: [],
    });
    expect(doc.baseShape).toBe("windows");
    expect("pattern" in doc).toBe(false);
    // The layer slot itself is kept for the Hero Patterns work.
    expect(doc.patternLayerZ).toBe(1);
  });

  it("loads a pre-rename legacy snapshot whose pattern lived in flat texture* fields", () => {
    const doc = normalizeLegacySnapshot({
      baseShape: "classic",
      colorMode: "solid",
      texture: "dots",
      textureOpacity: 0.5,
      textureScale: 2,
      elements: [{ type: "shape", shape: "rect", x: 10, y: 10, w: 50, h: 50 }],
    });
    expect(doc.elements).toHaveLength(1);
    expect("pattern" in doc).toBe(false);
    expect("texture" in doc).toBe(false);
    expect(doc.patternLayerZ).toBe(0);
  });
});
