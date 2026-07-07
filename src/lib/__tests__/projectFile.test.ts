// @vitest-environment node
/**
 * Project-file round-trip (Phase 8): serialize → parse restores the design, and
 * parse rejects junk with a user-readable error. Migration itself is covered by
 * the legacySnapshot suite — here we just prove parse routes through it.
 */

import { describe, expect, it } from "vitest";
import { parseProject, serializeProject } from "@/lib/projectFile";
import { createShapeElement } from "@/lib/elementFactories";
import { DOCUMENT_VERSION, createEmptyDocument } from "@/types/document";

describe("serializeProject / parseProject", () => {
  it("round-trips folder settings and elements", () => {
    const doc = createEmptyDocument();
    doc.folderColor = "#123456";
    doc.clipToFolder = true;
    doc.elements = [createShapeElement("star", "Star")];

    const text = serializeProject(doc);
    expect(JSON.parse(text).v).toBe(DOCUMENT_VERSION);

    const back = parseProject(text);
    expect(back.folderColor).toBe("#123456");
    expect(back.clipToFolder).toBe(true);
    expect(back.elements).toHaveLength(1);
    expect(back.elements[0].type).toBe("shape");
  });

  it("rejects text that isn’t valid JSON", () => {
    expect(() => parseProject("not json {")).toThrow(/JSON/i);
  });

  it("rejects JSON that isn’t a project file", () => {
    expect(() => parseProject(JSON.stringify({ hello: "world" }))).toThrow(/project file/i);
    expect(() => parseProject("null")).toThrow(/project file/i);
  });
});
