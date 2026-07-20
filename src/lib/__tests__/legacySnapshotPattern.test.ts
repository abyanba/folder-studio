// @vitest-environment node
/**
 * Users' galleries still hold snapshots saved before the Hero Patterns rework —
 * with the pre-rename flat `texture*` fields, or a `pattern` object naming one
 * of the 33 retired hand-written motifs. Those must load cleanly and must not
 * leave the document pointing at artwork that no longer exists.
 */

import { describe, expect, it } from "vitest";
import { normalizeLegacySnapshot } from "@/lib/legacySnapshot";
import { PATTERN_CATALOG } from "@/data/patterns";

describe("snapshots saved before the Hero Patterns rework", () => {
  it("resets a retired motif id to none rather than pointing at missing artwork", () => {
    const doc = normalizeLegacySnapshot({
      v: 2,
      baseShape: "windows",
      folderColor: "#f5c542",
      pattern: { id: "stars", scale: 2, rotation: 30 },
      patternLayerZ: 1,
      elements: [],
    });
    // "stars" was one of the hand-written motifs; it has no baked body now.
    expect(doc.pattern.id).toBe("none");
    // The other settings still ride through, so re-picking a pattern keeps them.
    expect(doc.pattern.scale).toBe(2);
    expect(doc.pattern.rotation).toBe(30);
    expect(doc.patternLayerZ).toBe(1);
  });

  it("keeps a pattern id that still exists in the catalog", () => {
    const keep = PATTERN_CATALOG[0].key;
    const doc = normalizeLegacySnapshot({
      v: 2,
      baseShape: "windows",
      folderColor: "#f5c542",
      pattern: { id: keep },
      elements: [],
    });
    expect(doc.pattern.id).toBe(keep);
  });

  it("fills defaults for fields a pre-rework snapshot never had", () => {
    const doc = normalizeLegacySnapshot({
      v: 2,
      baseShape: "windows",
      folderColor: "#f5c542",
      pattern: { id: "none" },
      elements: [],
    });
    expect(doc.pattern.span).toBe("front");
    expect(doc.pattern.bgColor).toBe("#000000");
    expect(doc.pattern.bgOpacity).toBe(0);
    expect(typeof doc.pattern.fgOpacity).toBe("number");
  });

  it("drops the pre-rename texture object instead of carrying it back into the next save", () => {
    const doc = normalizeLegacySnapshot({
      v: 2,
      baseShape: "windows",
      folderColor: "#f5c542",
      texture: { id: "dots", opacity: 0.5 },
      elements: [],
    });
    expect("texture" in doc).toBe(false);
  });

  it("loads a pre-rename legacy snapshot whose pattern lived in flat texture* fields", () => {
    const doc = normalizeLegacySnapshot({
      baseShape: "classic",
      colorMode: "solid",
      texture: "dots",
      textureOpacity: 0.5,
      elements: [{ type: "shape", shapeType: "rect", id: "1", x: 10, y: 10, width: 50, height: 50 }],
    });
    expect(doc.elements).toHaveLength(1);
    expect(doc.pattern.id).toBe("none");
    expect(doc.patternLayerZ).toBe(0);
  });
});
